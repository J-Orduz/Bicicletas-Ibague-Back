import { Router } from "express";
import * as tripController from "../controllers/tripController.js";

const router = Router();

router.post("/finalizar", tripController.finalizarViajeAuth);

router.get("/viajes", tripController.getViajesAuth);


export default router;