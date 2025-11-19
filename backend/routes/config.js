import { Router } from "express";
import configController from "../controllers/configController.js";

const router = Router();

// Devuelve la publishable key para el frontend
router.get("/stripe-pk", configController.getStripePublishableKey);

export default router;
