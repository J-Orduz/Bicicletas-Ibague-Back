import { bookingHandler } from "../services/booking/booking-handler.js";
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

// === CONTROLADORES DE RESERVA ===

export const reservarBicicleta = async (req, res) => {
  try {
    const { bikeId } = req.body;
    const usuarioId = req.user.id;
    
    console.log(`📋 Solicitud de reserva - BikeID: ${bikeId}, Usuario: ${usuarioId}`);
    
    if (!bikeId) {
      return res.status(400).json({
        success: false,
        message: 'ID de bicicleta es requerido'
      });
    }

    const resultado = await bookingHandler.reservarBicicleta(bikeId, usuarioId);
    
    res.status(200).json({
      success: true,
      message: 'Bicicleta reservada exitosamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en controlador de reserva:', error);
    
    let statusCode = 400;
    let message = error.message;

    if (error.message.includes('no encontrada')) {
      statusCode = 404;
    } else if (error.message.includes('no está disponible')) {
      statusCode = 409;
    } else if (error.message.includes('Ya tienes una reserva activa')) {
      statusCode = 409;
    }

    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};

export const cancelarReserva = async (req, res) => {
  try {
    const { bikeId } = req.body;
    const usuarioId = req.user.id;
    
    console.log(`❌ Solicitud de cancelación de reserva - BikeID: ${bikeId}, Usuario: ${usuarioId}`);
    
    if (!bikeId) {
      return res.status(400).json({
        success: false,
        message: 'ID de bicicleta es requerido'
      });
    }

    const resultado = await bookingHandler.cancelarReserva(bikeId, usuarioId);
    
    res.status(200).json({
      success: true,
      message: 'Reserva cancelada exitosamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en controlador de cancelación de reserva:', error);
    
    let statusCode = 400;
    let message = error.message;

    if (error.message.includes('no encontrada')) {
      statusCode = 404;
    } else if (error.message.includes('no está reservada')) {
      statusCode = 409;
    } else if (error.message.includes('no te pertenece')) {
      statusCode = 403;
    }

    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};

// === CONTROLADORES DE VIAJE ===

export const iniciarViajeConSerial = async (req, res) => {
  try {
    const { serialNumber, bikeId } = req.body;
    const usuarioId = req.user.id;
    
    console.log(`🎯 Solicitud de inicio de viaje - BikeID: ${bikeId}, Serial: ${serialNumber}, Usuario: ${usuarioId}`);
    
    if (!serialNumber || !bikeId) {
      return res.status(400).json({
        success: false,
        message: 'Número de serie e ID de bicicleta son requeridos'
      });
    }

    // Validar formato del número de serie
    const serialRegex = /^[0-9]{3}-[A-Z]{3}-[A-Z]{3}$/;
    if (!serialRegex.test(serialNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de número de serie inválido. Use: 123-ABC-XYZ'
      });
    }

    const resultado = await bookingHandler.iniciarViajeConSerial(serialNumber, bikeId, usuarioId);
    
    res.status(200).json({
      success: true,
      message: 'Viaje iniciado exitosamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en controlador de inicio de viaje:', error);
    
    let statusCode = 400;
    let message = error.message;

    if (error.message.includes('no encontrada')) {
      statusCode = 404;
    } else if (error.message.includes('no está disponible')) {
      statusCode = 409;
    } else if (error.message.includes('candado')) {
      statusCode = 503;
    } else if (error.message.includes('no corresponde')) {
      statusCode = 400;
    } else if (error.message.includes('No tienes una reserva activa')) {
      statusCode = 403;
    }

    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};

// === CONTROLADORES DE CONSULTA ===

export const obtenerReservasUsuario = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    console.log(`📋 Obteniendo reservas para usuario: ${usuarioId}`);
    
    const reservas = await bookingHandler.obtenerReservasUsuario(usuarioId);
    
    res.status(200).json({
      success: true,
      message: 'Reservas obtenidas exitosamente',
      data: reservas
    });

  } catch (error) {
    console.error('❌ Error obteniendo reservas del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener las reservas'
    });
  }
};

export const obtenerReservaActiva = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    console.log(`🔍 Buscando reserva activa para usuario: ${usuarioId}`);
    
    const reservaActiva = await bookingHandler.obtenerReservaActiva(usuarioId);
    
    res.status(200).json({
      success: true,
      message: reservaActiva ? 'Reserva activa encontrada' : 'No hay reserva activa',
      data: reservaActiva
    });

  } catch (error) {
    console.error('❌ Error obteniendo reserva activa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la reserva activa'
    });
  }
};

export const obtenerHistorialViajes = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const limite = parseInt(req.query.limite) || 10;
    
    console.log(`📊 Obteniendo historial de viajes para usuario: ${usuarioId}, límite: ${limite}`);
    
    const historial = await bookingHandler.obtenerHistorialViajes(usuarioId, limite);
    
    res.status(200).json({
      success: true,
      message: 'Historial obtenido exitosamente',
      data: historial
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial de viajes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el historial de viajes'
    });
  }
};

// === PARA RESERVA PROGRAMADA ===

export const reservarBicicletaProgramada = async (req, res) => {
  try {
    const { bikeId, fechaHoraProgramada } = req.body;
    const usuarioId = req.user.id;
    
    console.log(`📅 Solicitud de reserva programada - BikeID: ${bikeId}, Usuario: ${usuarioId}, Fecha: ${fechaHoraProgramada}`);
    
    if (!bikeId || !fechaHoraProgramada) {
      return res.status(400).json({
        success: false,
        message: 'ID de bicicleta y fecha/hora programada son requeridos'
      });
    }

    // Validar formato de fecha
    const fechaProgramada = new Date(fechaHoraProgramada);
    if (isNaN(fechaProgramada.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Formato de fecha/hora inválido'
      });
    }

    const resultado = await bookingHandler.reservarBicicletaProgramada(bikeId, usuarioId, fechaHoraProgramada);
    
    res.status(200).json({
      success: true,
      message: 'Bicicleta reservada programadamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en controlador de reserva programada:', error);
    
    let statusCode = 400;
    let message = error.message;

    if (error.message.includes('no encontrada')) {
      statusCode = 404;
    } else if (error.message.includes('Ya tienes una reserva')) {
      statusCode = 409;
    } else if (error.message.includes('fecha debe ser futura')) {
      statusCode = 400;
    }

    res.status(statusCode).json({
      success: false,
      message: message
    });
  }
};


// == PARA HISTORIAL DE REERVAS ==

export const obtenerHistorialReservas = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const limite = parseInt(req.query.limite) || 10;
    const pagina = parseInt(req.query.pagina) || 1;

    // Validar parámetros
    if (limite < 1 || limite > 50) {
      return res.status(400).json({
        success: false,
        message: 'El límite debe estar entre 1 y 50'
      });
    }

    if (pagina < 1) {
      return res.status(400).json({
        success: false,
        message: 'La página debe ser mayor a 0'
      });
    }

    console.log(`📊 Obteniendo historial de reservas - Usuario: ${usuarioId}, Límite: ${limite}, Página: ${pagina}`);

    const resultado = await bookingHandler.obtenerHistorialReservasUsuario(usuarioId, limite, pagina);
    
    res.status(200).json({
      success: true,
      message: 'Historial de reservas obtenido exitosamente',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial de reservas:', error);
    
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener el historial de reservas'
    });
  }
};

export const obtenerEstadisticasUsuario = async (req, res) => {
  try {
    const usuarioId = req.user.id;

    console.log(`📈 Obteniendo estadísticas para usuario: ${usuarioId}`);

    const estadisticas = await bookingHandler.obtenerEstadisticasUsuario(usuarioId);
    
    res.status(200).json({
      success: true,
      message: 'Estadísticas obtenidas exitosamente',
      data: estadisticas
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener las estadísticas'
    });
  }
};

export const obtenerReservaPorId = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const reservaId = req.params.id;

    console.log(`🔍 Obteniendo reserva específica - ID: ${reservaId}, Usuario: ${usuarioId}`);

    if (!reservaId) {
      return res.status(400).json({
        success: false,
        message: 'ID de reserva es requerido'
      });
    }

    // Obtener todas las reservas del usuario y filtrar
    const { data: reservas, error } = await supabase
      .from('Reserva')
      .select(`
        id,
        bicicleta_id,
        numero_serie,
        estado_reserva,
        timestamp_reserva,
        timestamp_expiracion,
        timestamp_finalizacion,
        motivo_finalizacion,
        timestamp_programada,
        timestamp_activacion,
        tipo_reserva,
        Bicicleta (
          id,
          marca,
          tipo,
          idEstacion,
          Estacion (
            id,
            nombre
          )
        )
      `)
      .eq('usuario_id', usuarioId)
      .eq('id', reservaId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Reserva no encontrada'
        });
      }
      throw error;
    }

    res.status(200).json({
      success: true,
      message: 'Reserva obtenida exitosamente',
      data: reservas
    });

  } catch (error) {
    console.error('❌ Error obteniendo reserva específica:', error);
    
    res.status(500).json({
      success: false,
      message: 'Error al obtener la reserva'
    });
  }
};


// === APLICAR MIDDLEWARE A LAS RUTAS ===

export const reservarBicicletaConAuth = [extractUserFromToken, reservarBicicleta];
export const cancelarReservaConAuth = [extractUserFromToken, cancelarReserva];
export const iniciarViajeConSerialConAuth = [extractUserFromToken, iniciarViajeConSerial];
export const obtenerReservasUsuarioConAuth = [extractUserFromToken, obtenerReservasUsuario];
export const obtenerReservaActivaConAuth = [extractUserFromToken, obtenerReservaActiva];
export const obtenerHistorialViajesConAuth = [extractUserFromToken, obtenerHistorialViajes];
export const reservarBicicletaProgramadaConAuth = [extractUserFromToken, reservarBicicletaProgramada];
export const obtenerHistorialReservasConAuth = [extractUserFromToken, obtenerHistorialReservas];
export const obtenerEstadisticasUsuarioConAuth = [extractUserFromToken, obtenerEstadisticasUsuario];
export const obtenerReservaPorIdConAuth = [extractUserFromToken, obtenerReservaPorId];
