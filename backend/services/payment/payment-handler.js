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
  handleWebhook,
};
