import { bicicletaService } from "../services/bike/bike.services.js";
import { bikeHandler } from "../services/bike/bike-handler.js";
import { supabase } from "../shared/supabase/client.js";

export const getEstaciones = async (req, res) => {
  const data = await bicicletaService.listarEstaciones();
  res.json(data);
};


export const getBicicletasPorEstacion = async (req, res) => {
  const data = await bicicletaService.listarBicicletasPorEstacion(req.params.id);
  res.json(data);
};


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


// Endpoint para iniciar viaje con número de serie
export const iniciarViajeConSerial = async (req, res) => {
  try {
    const { serialNumber } = req.body;
    const usuarioId = req.user.id;
    
    console.log(`🎯 Solicitud de inicio de viaje - Serial: ${serialNumber}, Usuario: ${usuarioId}`);
    
    // Validaciones básicas
    if (!serialNumber) {
      return res.status(400).json({
        success: false,
        message: 'Número de serie requeridos'
      });
    }

    // Validar formato del número de serie (ejemplo: 123-ABC-XYZ)
    const serialRegex = /^[0-9]{3}-[A-Z]{3}-[A-Z]{3}$/;
    if (!serialRegex.test(serialNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de número de serie inválido. Use: 123-ABC-XYZ'
      });
    }

    // Iniciar viaje
    const resultado = await bikeHandler.iniciarViajeConSerial(serialNumber, usuarioId);
    
    res.status(200).json({
      success: true,
      message: 'Viaje iniciado exitosamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en controlador de inicio de viaje:', error);
    
    let statusCode = 400;
    let message = error.message;

    // Manejar errores específicos
    if (error.message.includes('no encontrada')) {
      statusCode = 404;
    } else if (error.message.includes('no está disponible')) {
      statusCode = 409; // Conflict
    } else if (error.message.includes('candado')) {
      statusCode = 503; // Service Unavailable
    }

    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};

//Aplicar middleware solo a la ruta de iniciarViajeConSerial
export const iniciarViajeConSerialConAuth = [extractUserFromToken, iniciarViajeConSerial];

/*
export const getTelemetriaActual = async (req, res) => {
  const data = await bicicletaService.obtenerTelemetriaActual(req.params.id);
  res.json(data);
};

export const getTelemetriaHistorico = async (req, res) => {
  const data = await bicicletaService.obtenerTelemetriaHistorico(req.params.id);
  res.json(data);
};
*/