import { paymentHandler } from "../services/payment/index.js";
import { eventBus } from "../event-bus/index.js";
import { CHANNELS } from "../event-bus/channels.js";
import {
  basicCardChecks,
  maskNumber,
} from "../services/payment/card-validator.js";
import crypto from "crypto";

export async function createPaymentIntent(req, res, next) {
  try {
    const { amount, currency = "usd", metadata } = req.body;
    if (!amount)
      return res.status(400).json({ error: "Missing amount (in cents)" });

    const pi = await paymentHandler.createPaymentIntent({
      amount,
      currency,
      metadata,
    });

    // Stripe returns client_secret, mock may return different shape
    return res.json({ paymentIntent: pi });
  } catch (err) {
    next(err);
  }
}

export async function validateCard(req, res, next) {
  try {
    const { number, exp_month, exp_year, cvc, metadata } = req.body;

    const MODE = process.env.PAYMENT_MODE || "sandbox";
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
    // If running in sandbox but stripe key is missing, give a clear error
    if (MODE === "sandbox" && !STRIPE_SECRET_KEY) {
      return res.status(400).json({
        valid: false,
        error:
          "Stripe no configurado. Configure STRIPE_SECRET_KEY en .env o use PAYMENT_MODE=mock para probar con un mock.",
      });
    }

    // If token is present (client-side tokenization), skip PAN checks
    if (!req.body.token) {
      // Basic Luhn + expiry + cvc checks
      const checks = basicCardChecks({ number, exp_month, exp_year, cvc });
      if (!checks.valid) {
        return res.status(400).json({ valid: false, errors: checks.errors });
      }

      // Do not log full card number in any case
      const masked = maskNumber(number);
      console.log(
        `Validating card (masked=${masked}) via ${
          process.env.PAYMENT_MODE || "sandbox"
        }`
      );
    }

    try {
      const result = await paymentHandler.validateCard({
        number,
        exp_month,
        exp_year,
        cvc,
        token: req.body.token,
        metadata,
      });
      // Stripe token/object returned or mock response
      return res.json({ valid: true, result });
    } catch (err) {
      // Map Stripe errors (if any) to friendly codes
      const message = err && err.message ? err.message : String(err);
      console.error("Card validation error:", message);
      // Detect Stripe policy that blocks sending raw PANs directly
      if (
        message.includes(
          "Sending credit card numbers directly to the Stripe API is generally unsafe"
        )
      ) {
        return res.status(400).json({
          valid: false,
          error:
            "Stripe ha bloqueado el envío directo de números de tarjeta. Use Stripe Elements (client-side) para tokenizar la tarjeta o configure PAYMENT_MODE=mock para pruebas locales.",
        });
      }
      const mapped = mapStripeError(err);
      return res
        .status(mapped.http || 402)
        .json({ valid: false, error: mapped.code, message: mapped.message });
    }
  } catch (err) {
    next(err);
  }
}

function mapStripeError(err) {
  // Normalize some common Stripe error codes
  const defaultResp = {
    code: "PAYMENT_ERROR",
    message: err && err.message ? err.message : String(err),
    http: 402,
  };
  if (!err) return defaultResp;
  const code =
    err.code || (err.type === "StripeCardError" ? "card_error" : null) || null;
  switch (code) {
    case "card_declined":
      return {
        code: "CARD_DECLINED",
        message: "La tarjeta fue rechazada.",
        http: 402,
      };
    case "incorrect_cvc":
      return { code: "INCORRECT_CVC", message: "CVC incorrecto.", http: 402 };
    case "expired_card":
      return { code: "EXPIRED_CARD", message: "La tarjeta expiró.", http: 402 };
    case "invalid_number":
      return {
        code: "INVALID_NUMBER",
        message: "Número de tarjeta inválido.",
        http: 400,
      };
    default:
      return defaultResp;
  }
}

export async function confirmWithToken(req, res, next) {
  try {
    const { token, amount, currency = "usd", metadata = {} } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });
    if (!amount)
      return res.status(400).json({ error: "Missing amount (in cents)" });

    try {
      const pi = await paymentHandler.confirmWithToken({
        token,
        amount,
        currency,
        metadata,
      });
      return res.json({ paymentIntent: pi });
    } catch (err) {
      const mapped = mapStripeError(err);
      return res
        .status(mapped.http || 402)
        .json({ error: mapped.code, message: mapped.message });
    }
  } catch (err) {
    next(err);
  }
}

export async function webhookHandler(req, res, next) {
  try {
    const MODE = process.env.PAYMENT_MODE || "sandbox";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    let event;
    if (MODE === "mock") {
      // mock payload already parsed
      event = req.body;
      // Idempotency: use event.id if present, otherwise hash payload
      try {
        const eventId =
          event.id ||
          (event.data && event.data.object && event.data.object.id) ||
          null;
        const dedupeKey = eventId
          ? `payment:webhook:${eventId}`
          : `payment:webhook:hash:${crypto
              .createHash("sha256")
              .update(JSON.stringify(event))
              .digest("hex")
              .slice(0, 16)}`;
        if (eventBus && eventBus.redis) {
          const already = await eventBus.redis.get(dedupeKey);
          if (already) {
            console.log("Webhook skipped (duplicate):", dedupeKey);
            return res.json({ received: true, skipped: true });
          }
          await eventBus.redis.set(dedupeKey, "1", { ex: 60 * 60 * 24 });
        }
      } catch (err) {
        console.warn("Idempotency check failed:", err.message);
      }
      // handle common events
      if (event.type === "payment_intent.succeeded") {
        // Publicar evento PagoConfirmado en event-bus
        const pi = event.data && event.data.object ? event.data.object : {};
        const payload = {
          type: "PagoConfirmado",
          data: {
            paymentId: pi.id,
            amount: pi.amount,
            currency: pi.currency,
            metadata: pi.metadata || {},
            raw: event,
          },
        };
        try {
          await eventBus.publish(CHANNELS.PAGOS, payload);
        } catch (err) {
          console.error("Error publicando event-bus (mock):", err.message);
        }
        console.log("Mock payment succeeded", pi);
      }
      return res.json({ received: true });
    }

    // For Stripe we need raw body and signature
    const sig = req.headers["stripe-signature"];
    const raw = req.body;

    // If running in sandbox (Stripe) we require the stripe-signature header
    // to verify the webhook. Provide a clear error message if it's missing
    // (common when posting manually from Postman). Use Stripe CLI or set
    // PAYMENT_MODE=mock for manual testing.
    if (MODE === "sandbox" && !sig) {
      return res.status(400).json({
        error:
          "Missing stripe-signature header. Use Stripe CLI (stripe listen --forward-to ...) to send signed webhooks, or set PAYMENT_MODE=mock to test with raw JSON.",
      });
    }

    event = await paymentHandler.handleWebhook(raw, sig, webhookSecret, {
      "payment_intent.succeeded": async (e) => {
        try {
          // Idempotency: check event id
          try {
            const eventId =
              e.id || (e.data && e.data.object && e.data.object.id) || null;
            const dedupeKey = eventId
              ? `payment:webhook:${eventId}`
              : `payment:webhook:hash:${crypto
                  .createHash("sha256")
                  .update(JSON.stringify(e))
                  .digest("hex")
                  .slice(0, 16)}`;
            if (eventBus && eventBus.redis) {
              const already = await eventBus.redis.get(dedupeKey);
              if (already) {
                console.log("Webhook skipped (duplicate):", dedupeKey);
                return;
              }
              await eventBus.redis.set(dedupeKey, "1", { ex: 60 * 60 * 24 });
            }
          } catch (err) {
            console.warn("Idempotency check failed:", err.message);
          }
          const pi = e.data && e.data.object ? e.data.object : {};
          console.log("Payment succeeded:", pi.id);
          const payload = {
            type: "PagoConfirmado",
            data: {
              paymentId: pi.id,
              amount: pi.amount,
              currency: pi.currency,
              metadata: pi.metadata || {},
              raw: e,
            },
          };
          await eventBus.publish(CHANNELS.PAGOS, payload);
        } catch (err) {
          console.error("Error publicando event-bus (succeeded):", err.message);
        }
      },
      "payment_intent.payment_failed": async (e) => {
        try {
          // Idempotency: check event id
          try {
            const eventId =
              e.id || (e.data && e.data.object && e.data.object.id) || null;
            const dedupeKey = eventId
              ? `payment:webhook:${eventId}`
              : `payment:webhook:hash:${crypto
                  .createHash("sha256")
                  .update(JSON.stringify(e))
                  .digest("hex")
                  .slice(0, 16)}`;
            if (eventBus && eventBus.redis) {
              const already = await eventBus.redis.get(dedupeKey);
              if (already) {
                console.log("Webhook skipped (duplicate):", dedupeKey);
                return;
              }
              await eventBus.redis.set(dedupeKey, "1", { ex: 60 * 60 * 24 });
            }
          } catch (err) {
            console.warn("Idempotency check failed:", err.message);
          }
          const pi = e.data && e.data.object ? e.data.object : {};
          console.log("Payment failed:", pi.id);
          const payload = {
            type: "PagoFallido",
            data: {
              paymentId: pi.id,
              amount: pi.amount,
              currency: pi.currency,
              metadata: pi.metadata || {},
              last_error: pi.last_payment_error || null,
              raw: e,
            },
          };
          await eventBus.publish(CHANNELS.PAGOS, payload);
        } catch (err) {
          console.error("Error publicando event-bus (failed):", err.message);
        }
      },
    });

    res.json({ received: true, id: event.id });
  } catch (err) {
    next(err);
  }
}

const defaultExport = {
  createPaymentIntent,
  webhookHandler,
  validateCard,
  getPaymentIntent,
};
export default defaultExport;

export async function getPaymentIntent(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Missing paymentIntent id" });
    const pi = await paymentHandler.retrievePaymentIntent(id);
    return res.json({ paymentIntent: pi });
  } catch (err) {
    next(err);
  }
}
