import express from "express";
import * as paymentController from "../controllers/paymentController.js";

const router = express.Router();

// Crear PaymentIntent (cliente llama con amount en centavos)
router.post(
  "/create-payment-intent",
  express.json(),
  paymentController.createPaymentIntent
);

// Validate card details (Luhn + optional Stripe/mock validation)
router.post("/validate-card", express.json(), paymentController.validateCard);

// Confirm a payment using a token/payment_method (server-side confirm)
router.post(
  "/confirm-with-token",
  express.json(),
  paymentController.confirmWithToken
);

// Webhook endpoint (Stripe requires raw body; for mock mode it's ok)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.webhookHandler
);

// Obtener PaymentIntent por id (para polling desde frontend)
router.get("/:id", paymentController.getPaymentIntent);

export default router;
