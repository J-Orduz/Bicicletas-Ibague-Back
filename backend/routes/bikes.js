import { Router } from "express";
import * as bicicletaController from "../controllers/bikeController.js";

const router = Router();

router.get("/", bicicletaController.getBicicletas);
//router.get("/Bicicletatipo/", bicicletaController.getBicicletasPorTipo);
//router.get("/:id/telemetria", bicicletaController.getTelemetriaActual);
//router.get("/:id/telemetria/historico", bicicletaController.getTelemetriaHistorico);

export default router;