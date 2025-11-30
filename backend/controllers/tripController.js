
import { tripHandler } from "../services/trip/trip-handler.js";
import { supabase } from "../shared/supabase/client.js";
import { ESTADO_PAGO } from "../services/trip/trip-handler.js";




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


export const setPagoViajeExitoso = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { viajeId } = req.body;

    if (!viajeId) {
      return res.status(400).json({
        success: false,
        message: 'El ID del viaje es obligatorio'
      });
    }

    console.log(`💳 Procesando pago exitoso para viaje: ${viajeId}, usuario: ${usuarioId}`);

    // Cambiar estado de pago a PAGADO
    const viajeActualizado = await tripHandler.changeStatus(viajeId, ESTADO_PAGO.PAGADO);

    if (!viajeActualizado) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el viaje o no fue posible actualizar el estado'
      });
    }

    //Sumar 2 puntos al perfil del usuario
    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles')
      .select('puntos')
      .eq('id', usuarioId)
      .single();

    if (errorPerfil) {
      console.error('❌ Error obteniendo perfil:', errorPerfil);
      // No retornes error aquí, solo loguea el error
    } else {
      // Actualizar puntos sumando 2
      const nuevosPuntos = (perfil.puntos || 0) + 2;
      
      const { error: errorUpdate } = await supabase
        .from('profiles')
        .update({ 
          puntos: nuevosPuntos,
          updated_at: new Date().toISOString()
        })
        .eq('id', usuarioId);

      if (errorUpdate) {
        console.error('❌ Error actualizando puntos:', errorUpdate);
      } else {
        console.log(`✅ Puntos actualizados: usuario ${usuarioId} ahora tiene ${nuevosPuntos} puntos`);
      }
    }  

    res.status(200).json({
      success: true,
      message: 'Pago registrado exitosamente',
      data: viajeActualizado
    });

  } catch (error) {
    console.error('❌ Error registrando pago del viaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar el pago del viaje'
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

// Controlador para canjear puntos por descuento
export const canjearPuntosDescuento = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { viajeId } = req.body;

    if (!viajeId) {
      return res.status(400).json({
        success: false,
        message: 'El ID del viaje es obligatorio'
      });
    }

    console.log(`🔄 Canjeando puntos para viaje: ${viajeId}, usuario: ${usuarioId}`);

    // 1. Obtener el perfil del usuario para verificar puntos
    const { data: perfil, error: errorPerfil } = await supabase
      .from('profiles')
      .select('puntos')
      .eq('id', usuarioId)
      .single();

    if (errorPerfil || !perfil) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el perfil del usuario'
      });
    }

    const puntosUsuario = perfil.puntos || 0;

    // 2. Verificar si tiene puntos suficientes (mínimo 10 puntos)
    if (puntosUsuario < 10) {
      return res.status(400).json({
        success: false,
        message: 'Puntos insuficientes para canjear. Mínimo 10 puntos requeridos.',
        puntosActuales: puntosUsuario
      });
    }

    // 3. Obtener el viaje para ver el precioTotal actual
    const { data: viaje, error: errorViaje } = await supabase
      .from('Viaje')
      .select('precioTotal, estadoPago')
      .eq('id', viajeId)
      .single();

    if (errorViaje || !viaje) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el viaje'
      });
    }

    // 4. Verificar que el viaje esté en estado PENDIENTE
    if (viaje.estadoPago !== 'PENDIENTE') {
      return res.status(400).json({
        success: false,
        message: 'Solo se pueden canjear puntos en viajes con estado PENDIENTE'
      });
    }

    const precioOriginal = viaje.precioTotal || 0;

    // 5. Calcular máximo descuento posible basado en puntos y precio
    const maxPuntosCanjeables = Math.floor(puntosUsuario / 10) * 10; // Múltiplos de 10
    const maxDescuentoPosible = (maxPuntosCanjeables / 10) * 1000; // 10 puntos = 1.000 descuento

    // El descuento no puede ser mayor al precio total
    const descuentoAplicar = Math.min(maxDescuentoPosible, precioOriginal);
    
    // Calcular puntos a utilizar (redondeado a múltiplos de 10)
    const puntosUtilizar = Math.floor(descuentoAplicar / 1000) * 10;
    
    // Nuevo precio después del descuento
    const nuevoPrecioTotal = Math.max(0, precioOriginal - descuentoAplicar);
    
    // Nuevos puntos del usuario
    const nuevosPuntos = puntosUsuario - puntosUtilizar;
    
    // Determinar si el viaje queda completamente pagado
    const viajeCompletamentePagado = nuevoPrecioTotal === 0;
    const nuevoEstadoPago = viajeCompletamentePagado ? ESTADO_PAGO.PAGADO : viaje.estadoPago;

    // 6. Actualizar el viaje con el nuevo precio
    const { data: viajeActualizado, error: errorActualizarViaje } = await supabase
      .from('Viaje')
      .update({
        precioTotal: nuevoPrecioTotal,
        estadoPago: nuevoEstadoPago
      })
      .eq('id', viajeId)
      .select()
      .single();

    if (errorActualizarViaje) {
      console.error('❌ Error actualizando viaje:', errorActualizarViaje);
      return res.status(500).json({
        success: false,
        message: 'Error al actualizar el precio del viaje'
      });
    }

    // 7. Actualizar los puntos del usuario
    const { error: errorActualizarPuntos } = await supabase
      .from('profiles')
      .update({
        puntos: nuevosPuntos,
        updated_at: new Date().toISOString()
      })
      .eq('id', usuarioId);

    if (errorActualizarPuntos) {
      console.error('❌ Error actualizando puntos:', errorActualizarPuntos);
      // No retornamos error aquí para no dejar inconsistencia
    }

    console.log(`✅ Canje exitoso: ${puntosUtilizar} puntos → $${descuentoAplicar} descuento`);

    res.status(200).json({
      success: true,
      message: 'Puntos canjeados exitosamente',
      data: {
        viaje: viajeActualizado,
        descuentoAplicado: descuentoAplicar,
        puntosUtilizados: puntosUtilizar,
        puntosRestantes: nuevosPuntos,
        precioOriginal: precioOriginal,
        precioFinal: nuevoPrecioTotal
      }
    });

  } catch (error) {
    console.error('❌ Error canjeando puntos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al canjear puntos'
    });
  }
};



export const canjearPuntosDescuentoAuth = [extractUserFromToken, canjearPuntosDescuento];
export const finalizarViajeAuth = [extractUserFromToken, finalizarViaje];
export const getViajesAuth = [extractUserFromToken, getViajes];
export const setPagoViajeExitosoAuth=[extractUserFromToken, setPagoViajeExitoso];