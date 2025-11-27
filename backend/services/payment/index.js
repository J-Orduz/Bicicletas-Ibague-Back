import { initPaymentHandler } from "./payment-handler.js";

export function initPaymentService() {
  initPaymentHandler();
}

export { default as paymentHandler } from "./payment-handler.js";
