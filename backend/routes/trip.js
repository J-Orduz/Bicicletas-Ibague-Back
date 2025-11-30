import { Router } from "express";
import * as tripController from "../controllers/tripController.js";

const router = Router();

router.post("/finalizar", tripController.finalizarViajeAuth);

router.get("/viajes", tripController.getViajesAuth);
router.post("/pagoExito",tripController.setPagoViajeExitosoAuth);

router.post("/canjear-puntos", tripController.canjearPuntosDescuentoAuth);


export default router;