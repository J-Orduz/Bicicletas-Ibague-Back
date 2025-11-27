import { Router } from "express";
import * as tripController from "../controllers/tripController.js";

const router = Router();

router.post("/finalizar", tripController.finalizarViaje);

router.get("/viajes", tripController.getViajes);


export default router;