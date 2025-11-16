import { Router } from "express";
import * as bicicletaController from "../controllers/bikeController.js";

const router = Router();

router.get("/estaciones", bicicletaController.getEstaciones);
router.get("/:id/EstacionesBici", bicicletaController.getBicicletasPorEstacion);
router.post("/reservar", bicicletaController.reservarBicicletaConAuth);
router.post("/cancelar-reserva", bicicletaController.cancelarReservaConAuth);
router.post("/iniciar-viaje", bicicletaController.iniciarViajeConSerialConAuth);
//router.get("/:id/telemetria", bicicletaController.getTelemetriaActual);
//router.get("/:id/telemetria/historico", bicicletaController.getTelemetriaHistorico);

export default router;