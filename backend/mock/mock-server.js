import express from "express";
import bodyParser from "body-parser";
import crypto from "crypto";

const app = express();
const PORT = process.env.MOCK_PORT || 8080;

app.use(bodyParser.json());

// Very small in-memory store for mock payment intents
const intents = new Map();

function genId(prefix = "pi_mock_") {
  return prefix + crypto.randomBytes(6).toString("hex");
}

app.post("/payment-intent", (req, res) => {
  const { amount, currency = "usd", metadata = {} } = req.body || {};
  if (!amount) return res.status(400).json({ error: "Missing amount" });
  const id = genId();
  const client_secret = id + "_secret_mock";
  const pi = {
    id,
    amount,
    currency,
    metadata,
    client_secret,
    status: "requires_payment_method",
  };
  intents.set(id, pi);
  // Simulate success immediately for convenience in some tests
  // but leave status as requires_payment_method to mimic Stripe
  res.json(pi);
});

app.get("/payment-intent/:id", (req, res) => {
  const id = req.params.id;
  const pi = intents.get(id);
  if (!pi) return res.status(404).json({ error: "not_found" });
  res.json(pi);
});

// validate-card endpoint used by payment-handler in mock mode
app.post("/validate-card", (req, res) => {
  const { number, exp_month, exp_year, cvc, metadata } = req.body || {};
  // Very simple validation: accept commonly used test number and Luhn
  if (!number)
    return res.status(400).json({ valid: false, error: "MISSING_NUMBER" });
  const clean = String(number).replace(/\s+/g, "");
  // Accept 4242... as success; otherwise reject
  if (clean === "4242424242424242") {
    return res.json({ valid: true, id: genId("cardtok_") });
  }
  return res
    .status(402)
    .json({
      valid: false,
      error: "card_declined",
      message: "Mock: card declined",
    });
});

app.post("/webhook", (req, res) => {
  // Accept any webhook payload and return 200
  console.log("[mock webhook] payload:", JSON.stringify(req.body));
  res.json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Mock payment server listening on http://localhost:${PORT}`);
});
