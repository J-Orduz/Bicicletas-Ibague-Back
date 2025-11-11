import { Router } from "express";
import * as bicicletaController from "../controllers/bicicletaController.js";

const router = Router();

router.get("/", bicicletaController.getBicicletas);
router.get("/tipo/:tipo", bicicletaController.getBicicletasPorTipo);
router.get("/:id/telemetria", bicicletaController.getTelemetriaActual);
router.get("/:id/telemetria/historico", bicicletaController.getTelemetriaHistorico);

export default router;