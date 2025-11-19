import { bicicletaService } from "../services/bike/bike.services.js";
import { bikeHandler } from "../services/bike/bike-handler.js";

// === CONTROLADORES DE CONSULTA ===


export const getBicicletasPorEstacion = async (req, res) => {
  try {
    const estacionId = req.params.id;
    console.log(`🚲 Obteniendo bicicletas para estación: ${estacionId}`);
    
    const data = await bicicletaService.listarBicicletasPorEstacion(estacionId);
    
    res.json(data);

  } catch (error) {
    console.error('❌ Error obteniendo bicicletas por estación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las bicicletas de la estación'
    });
  }
};

export const getAllBicicletas = async (req, res) => {
  try {
    console.log('🚲 Obteniendo todas las bicicletas...');
    const data = await bikeHandler.getAllBicicletas();
    
    res.json(data);
  } catch (error) {
    console.error('❌ Error obteniendo todas las bicicletas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las bicicletas'
    });
  }
};

export const getBicicleta = async (req, res) => {
  try {
    const bikeId = req.params.id;
    console.log(`🔍 Obteniendo bicicleta: ${bikeId}`);
    
    const data = await bikeHandler.getBike(bikeId);
    
    res.json(data);
  } catch (error) {
    console.error('❌ Error obteniendo bicicleta:', error);
    
    let statusCode = 500;
    let message = 'Error al obtener la bicicleta';
    
    if (error.message.includes('no encontrada')) {
      statusCode = 404;
      message = 'Bicicleta no encontrada';
    }
    
    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};

export const getBicicletaBySerial = async (req, res) => {
  try {
    const { serialNumber } = req.params;
    console.log(`🔍 Buscando bicicleta por serial: ${serialNumber}`);
    
    // Validar formato del número de serie
    const serialRegex = /^[0-9]{3}-[A-Z]{3}-[A-Z]{3}$/;
    if (!serialRegex.test(serialNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de número de serie inválido. Use: 123-ABC-XYZ'
      });
    }
    
    const data = await bikeHandler.getBikeBySerial(serialNumber);
    
    res.json(data);
  } catch (error) {
    console.error('❌ Error obteniendo bicicleta por serial:', error);
    
    let statusCode = 500;
    let message = 'Error al obtener la bicicleta';
    
    if (error.message.includes('no encontrada')) {
      statusCode = 404;
      message = 'Bicicleta no encontrada';
    }
    
    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};

// === CONTROLADORES DE MANTENIMIENTO (requieren autenticación de admin) ===

// Middleware para extraer usuario del token (para futuras rutas protegidas)
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

// Ejemplo de controlador protegido para administradores
export const registrarBicicleta = async (req, res) => {
  try {
    const bikeData = req.body;
    const usuarioId = req.user.id;
    
    console.log(`📝 Registrando nueva bicicleta por usuario: ${usuarioId}`, bikeData);
    
    // Validaciones básicas
    if (!bikeData.numero_serie || !bikeData.marca || !bikeData.tipo) {
      return res.status(400).json({
        success: false,
        message: 'Número de serie, marca y tipo son requeridos'
      });
    }
    
    // Validar formato del número de serie
    const serialRegex = /^[0-9]{3}-[A-Z]{3}-[A-Z]{3}$/;
    if (!serialRegex.test(bikeData.numero_serie)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de número de serie inválido. Use: 123-ABC-XYZ'
      });
    }
    
    // TODO: Verificar que el usuario tenga rol de administrador
    
    const resultado = await bikeHandler.registerBike(bikeData);
    
    res.status(201).json({
      success: true,
      message: 'Bicicleta registrada exitosamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error registrando bicicleta:', error);
    
    let statusCode = 400;
    let message = error.message;

    if (error.message.includes('duplicate key')) {
      statusCode = 409;
      message = 'El número de serie ya está registrado';
    }

    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};

export const actualizarPosicion = async (req, res) => {
  try {
    const bikeId = req.params.id;
    const { newPos } = req.body;
    const usuarioId = req.user.id;
    
    console.log(`📍 Actualizando posición de bicicleta ${bikeId} por usuario: ${usuarioId}`, newPos);
    
    if (!newPos) {
      return res.status(400).json({
        success: false,
        message: 'Nueva posición es requerida'
      });
    }
    
    // TODO: Verificar que el usuario tenga permisos
    
    const resultado = await bikeHandler.updatePosition(bikeId, newPos);
    
    res.status(200).json({
      success: true,
      message: 'Posición actualizada exitosamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error actualizando posición:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

export const reportarAbandonada = async (req, res) => {
  try {
    const bikeId = req.params.id;
    const { ubicacion } = req.body;
    const usuarioId = req.user.id;
    
    console.log(`🚨 Reportando bicicleta ${bikeId} como abandonada por usuario: ${usuarioId}`);
    
    if (!ubicacion) {
      return res.status(400).json({
        success: false,
        message: 'Ubicación es requerida'
      });
    }
    
    const resultado = await bikeHandler.reportarAbandonada(bikeId, ubicacion);
    
    res.status(200).json({
      success: true,
      message: 'Bicicleta reportada como abandonada',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error reportando bicicleta abandonada:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Aplicar middleware a las rutas protegidas
export const registrarBicicletaConAuth = [extractUserFromToken, registrarBicicleta];
export const actualizarPosicionConAuth = [extractUserFromToken, actualizarPosicion];
export const reportarAbandonadaConAuth = [extractUserFromToken, reportarAbandonada];

// === RUTAS DE TELEMETRÍA (pendientes de implementar) ===
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