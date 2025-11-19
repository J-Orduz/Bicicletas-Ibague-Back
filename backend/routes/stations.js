import { Router } from "express";
import * as stationController from "../controllers/stationController.js";
const router = Router();

// === RUTAS PÚBLICAS (sin autenticación) ===
router.get("/", stationController.getEstaciones);
router.post("/add", stationController.addEstacion);


export default router;