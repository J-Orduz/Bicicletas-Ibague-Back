import { Router } from "express";
import * as stationController from "../controllers/stationController.js";

const router = Router();

// === RUTAS PÚBLICAS (sin autenticación) ===
router.get("/getAll", stationController.getEstaciones);
router.get("/:id/estacion", stationController.getStationById);
router.post("/add", stationController.createStation);




export default router;