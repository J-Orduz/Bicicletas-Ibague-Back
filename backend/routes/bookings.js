import { Router } from "express";
import * as bookingController from "../controllers/bookingController.js";

const router = Router();

// === RUTAS DE RESERVA ===
router.post("/reservar", bookingController.reservarBicicletaConAuth);
router.post("/cancelar-reserva", bookingController.cancelarReservaConAuth);
router.post("/reservar-programada", bookingController.reservarBicicletaProgramadaConAuth);

// === RUTAS DE VIAJE ===
router.post("/iniciar-viaje", bookingController.iniciarViajeConSerialConAuth);

// === RUTAS DE CONSULTA ===
router.get("/reservas/usuario", bookingController.obtenerReservasUsuarioConAuth);
router.get("/reservas/activa", bookingController.obtenerReservaActivaConAuth);
router.get("/historial/viajes", bookingController.obtenerHistorialViajesConAuth);

export default router;