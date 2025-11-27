
import { tripHandler } from "../services/trip/trip-handler.js";
import { supabase } from "../shared/supabase/client.js";





// Middleware para extraer usuario del token 
const extractUserFromToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token de autorización requerido'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verificar el token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Agregar usuario a la request
    req.user = user;
    next();

  } catch (error) {
    console.error('❌ Error extrayendo usuario del token:', error);
    return res.status(401).json({
      success: false,
      message: 'Error de autenticación'
    });
  }
};


export const finalizarViaje = async (req, res) => {
  const usuarioId = req.user.id;
  try {

    const { viajeId } = req.body;

    if (!viajeId) {
      return res.status(400).json({
        success: false,
        message: "ID del viaje es requerido"
      });
    }

    const resultado = await tripHandler.finalizarViaje(viajeId);
    console.log(resultado)
    return res.status(200).json({
      success: true,
      message: "Viaje finalizado correctamente",
      data: resultado
    });

  } catch (error) {

    console.error("❌ Error finalizando viaje:", error);

    let status = 500;
    let message = "Error interno del servidor";

    if (error.message.includes("no encontrado")) {
      status = 404;
      message = error.message;
    }
    else if (error.message.includes("ya fue finalizado")) {
      status = 409;
      message = error.message;
    }
    else if (error.message.includes("no se pudo actualizar")) {
      status = 500;
      message = error.message;
    }
    else {
      message = error.message;
    }

    return res.status(status).json({
      success: false,
      message
    });
  }
};





export const getViajes = async (req, res) => {
  const usuarioId = req.user.id;
  try {
    const viajes = await tripHandler.obtenerViajes();

    return res.status(200).json({
      success: true,
      count: viajes.length,
      data: viajes
    });

  } catch (error) {
    console.error("❌ Error en obtenerTodosLosViajesController:", error);

    return res.status(500).json({
      success: false,
      message: "No se pudieron obtener los viajes",
      error: error.message
    });
  }
};




export const finalizarViajeAuth = [extractUserFromToken, finalizarViaje];
export const getViajesAuth = [extractUserFromToken, getViajes];