import fetch from "node-fetch";
import Stripe from "stripe";

const MODE = process.env.PAYMENT_MODE || "sandbox"; // 'sandbox' or 'mock'
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const MOCK_URL = process.env.PAYMENT_MOCK_URL || "http://localhost:8080";

let stripe = null;
if (MODE === "sandbox" && STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });
}

export const initPaymentHandler = () => {
  console.log(`💳 Inicializando PaymentHandler (mode=${MODE})`);
};

export async function createPaymentIntent({
  amount,
  currency = "usd",
  metadata = {},
}) {
  if (MODE === "mock") {
    // Simular llamada a WireMock o endpoint de mock
    const res = await fetch(`${MOCK_URL}/payment-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, currency, metadata }),
    });
    if (!res.ok) {
      throw new Error(`Mock payment error: ${res.statusText}`);
    }
    return res.json();
  }

  if (!stripe)
    throw new Error(
      "Stripe no configurado. Configure STRIPE_SECRET_KEY en .env"
    );

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    metadata,
  });

  return paymentIntent;
}

export async function retrievePaymentIntent(id) {
  if (MODE === "mock") {
    const res = await fetch(`${MOCK_URL}/payment-intent/${id}`);
    if (!res.ok) throw new Error("Mock retrieve failed");
    return res.json();
  }

  if (!stripe) throw new Error("Stripe no configurado.");
  return stripe.paymentIntents.retrieve(id);
}

export async function validateCard({
  number,
  exp_month,
  exp_year,
  cvc,
  token,
  metadata = {},
}) {
  // If token is provided (from Stripe Elements / client tokenization), prefer validating/retrieving it
  if (MODE === "mock") {
    if (token) {
      // In mock, accept test tokens like 'tok_visa'
      if (token === "tok_visa") return { id: token, valid: true };
      return { id: token, valid: false, error: "unknown_token" };
    }

    // Basic server-side validation and then pass to mock
    const res = await fetch(`${MOCK_URL}/validate-card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number, exp_month, exp_year, cvc, metadata }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Mock validate-card error: ${res.status} ${text}`);
    }
    return res.json();
  }

  if (!stripe) throw new Error("Stripe no configurado.");

  if (token) {
    // Try to retrieve token object (test tokens like 'tok_visa' won't be retrievable via API,
    // but real tokens created by Elements can be used directly to create charges or payment methods.)
    try {
      const tok = await stripe.tokens.retrieve(String(token));
      return tok;
    } catch (err) {
      // If retrieval not allowed, return a small object acknowledging the token
      return {
        id: token,
        note: "token passed, cannot retrieve via API (use token to create payment)",
      };
    }
  }

  // Use Stripe Tokens API to validate card details server-side (test mode only)
  try {
    const created = await stripe.tokens.create({
      card: {
        number: String(number).replace(/\s+/g, ""),
        exp_month: Number(exp_month),
        exp_year: Number(exp_year),
        cvc: String(cvc),
      },
    });
    return created;
  } catch (err) {
    // Re-throw, controller will map errors into structured responses
    throw err;
  }
}

export async function confirmWithToken({
  token,
  amount,
  currency = "usd",
  metadata = {},
}) {
  if (MODE === "mock") {
    // create a mock payment intent and simulate immediate confirmation
    const id = `pi_mock_${Math.random().toString(36).slice(2, 10)}`;
    const client_secret = id + "_secret_mock";
    const pi = {
      id,
      amount,
      currency,
      metadata,
      client_secret,
      status: "succeeded",
    };
    return pi;
  }

  if (!stripe) throw new Error("Stripe no configurado.");

  try {
    const pi = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: token,
      confirm: true,
      metadata,
    });
    return pi;
  } catch (err) {
    throw err;
  }
}

export async function handleWebhook(
  rawBody,
  sig,
  webhookSecret,
  handlers = {}
) {
  if (MODE === "mock") {
    // Mock webhook payload is already parsed by caller
    const event = rawBody;
    if (handlers[event.type]) await handlers[event.type](event);
    return { received: true };
  }

  if (!stripe) throw new Error("Stripe no configurado.");

  const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  if (handlers[event.type]) await handlers[event.type](event);
  return event;
}

export default {
  initPaymentHandler,
  createPaymentIntent,
  retrievePaymentIntent,
  validateCard,
  confirmWithToken,
  handleWebhook,
};
