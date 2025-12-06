// controllers/citypassController.js
import { cityPassHandler } from "../services/citypass/citypass-handler.js";
import { supabase } from "../shared/supabase/client.js";
// Importar middleware centralizado (Chain of Responsibility)
import { extractUserFromToken } from '../middleware/auth.js';

// Vincular tarjeta CityPass
export const vincularTarjeta = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { cardNumber } = req.body;
    
    console.log(`💳 Solicitando vincular CityPass para usuario: ${usuarioId}, Tarjeta: ${cardNumber}`);
    
    if (!cardNumber) {
      return res.status(400).json({
        success: false,
        message: 'Número de tarjeta es requerido'
      });
    }
    
    const resultado = await cityPassHandler.vincularTarjeta(usuarioId, cardNumber);
    
    res.status(201).json({
      success: true,
      message: 'Tarjeta CityPass vinculada exitosamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en controlador de vinculación:', error);
    
    let statusCode = 400;
    let message = error.message;

    if (error.message.includes('Ya tienes')) {
      statusCode = 409;
    } else if (error.message.includes('Formato de tarjeta inválido') || error.message.includes('ya está en uso')) {
      statusCode = 422; // Unprocessable Entity
    }

    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};

// Consultar saldo
export const consultarSaldo = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    console.log(`💰 Consultando saldo CityPass para usuario: ${usuarioId}`);
    
    const resultado = await cityPassHandler.consultarSaldo(usuarioId);
    
    res.status(200).json({
      success: true,
      message: 'Consulta de saldo exitosa',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en controlador de consulta de saldo:', error);
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Procesar pago
export const procesarPago = async (req, res) => {
  try {
    const { monto } = req.body;
    const usuarioId = req.user.id;
    
    console.log(`💸 Procesando pago CityPass - Usuario: ${usuarioId}, Monto: $${monto}`);
    
    if (!monto || monto <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Monto válido es requerido'
      });
    }

    const resultado = await cityPassHandler.procesarPago(usuarioId, monto);
    
    res.status(200).json({
      success: true,
      message: 'Pago procesado exitosamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en controlador de pago:', error);
    
    let statusCode = 400;
    let message = error.message;

    if (error.message.includes('Saldo insuficiente')) {
      statusCode = 402; // Payment Required
    } else if (error.message.includes('No tienes')) {
      statusCode = 404;
    }

    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};

// Aplicar middleware
export const vincularTarjetaConAuth = [extractUserFromToken, vincularTarjeta];
export const consultarSaldoConAuth = [extractUserFromToken, consultarSaldo];
export const procesarPagoConAuth = [extractUserFromToken, procesarPago];