import { Router } from "express";
import * as bicicletaController from "../controllers/bikeController.js";

const router = Router();

// === RUTAS PÚBLICAS (sin autenticación) ===
//router.get("/estaciones", bicicletaController.getEstaciones);
router.get("/:id/EstacionesBici", bicicletaController.getBicicletasPorEstacion);
router.get("/", bicicletaController.getAllBicicletas);
router.get("/:id", bicicletaController.getBicicleta);
router.get("/serial/:serialNumber", bicicletaController.getBicicletaBySerial);

// === RUTAS PROTEGIDAS (requieren autenticación de admin) ===
// router.post("/", bicicletaController.registrarBicicletaConAuth);
// router.put("/:id/posicion", bicicletaController.actualizarPosicionConAuth);
// router.post("/:id/reportar-abandonada", bicicletaController.reportarAbandonadaConAuth);

router.get("/:id/telemetria", bicicletaController.getTelemetriaActual);
router.get("/:id/telemetria/historico", bicicletaController.getTelemetriaHistorico);

export default router;