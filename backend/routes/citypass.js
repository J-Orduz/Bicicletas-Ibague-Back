// routes/citypass.js
import express from 'express';
import {
  vincularTarjetaConAuth,
  consultarSaldoConAuth,
  procesarPagoConAuth
} from '../controllers/citypassController.js';

const router = express.Router();

// Vincular tarjeta CityPass (POST /api/citypass/vincular)
router.post('/vincular', vincularTarjetaConAuth);

// Consultar saldo (GET /api/citypass/saldo)
router.get('/saldo', consultarSaldoConAuth);

// Procesar pago (POST /api/citypass/pago)
router.post('/pago', procesarPagoConAuth);

export default router;