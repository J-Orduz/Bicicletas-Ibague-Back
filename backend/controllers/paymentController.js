import { paymentHandler } from "../services/payment/index.js";
import { eventBus } from "../event-bus/index.js";
import { CHANNELS } from "../event-bus/channels.js";

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

export async function webhookHandler(req, res, next) {
  try {
    const MODE = process.env.PAYMENT_MODE || "sandbox";
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    let event;
    if (MODE === "mock") {
      // mock payload already parsed
      event = req.body;
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

const defaultExport = { createPaymentIntent, webhookHandler, getPaymentIntent };
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
