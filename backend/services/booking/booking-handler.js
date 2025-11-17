// services/booking/booking-handler.js
import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

const reservaTable = "Reserva";
const bikeTable = "Bicicleta";

export const ReservaStatus = {
  ACTIVA: 'activa',
  COMPLETADA: 'completada', 
  CANCELADA: 'cancelada',
  EXPIRADA: 'expirada'
};

export const MotivoFinalizacion = {
  INICIO_VIAJE: 'inicio_viaje',
  CANCELACION_USUARIO: 'cancelacion_usuario',
  EXPIRACION_TIEMPO: 'expiracion_tiempo'
};

export const BikeStatus = {
  EN_USO: 'En_Viaje',
  DISPONIBLE: 'Disponible',
  RESERVADA: 'Reservada'
};

class BookingHandler {
  constructor() {}

  // === MÉTODOS DE RESERVA ===

  async reservarBicicleta(bikeId, usuarioId) {
    try {
      console.log(`📋 Solicitud de reserva - BikeID: ${bikeId}, Usuario: ${usuarioId}`);
      
      // Verificar que el usuario no tenga ya una reserva activa
      const tieneReservaActiva = await this.verificarReservaActivaExistente(usuarioId);
      if (tieneReservaActiva) {
        throw new Error('Ya tienes una reserva activa. Debes cancelarla o completarla antes de hacer una nueva reserva.');
      }

      // 1. Verificar que la bicicleta existe y está disponible
      const { data: bicicleta, error: bikeError } = await supabase
        .from(bikeTable)
        .select("*")
        .eq("id", bikeId)
        .single();
      
      if (bikeError || !bicicleta) {
        throw new Error('Bicicleta no encontrada');
      }

      if (bicicleta.estado !== BikeStatus.DISPONIBLE) {
        throw new Error(`La bicicleta no está disponible para reservar. Estado actual: ${bicicleta.estado}`);
      }

      // 2. Calcular timestamps de expiración (10 minutos)
      const ahora = new Date();
      const expiracion = new Date(ahora.getTime() + 10 * 60 * 1000);

      // 3. Crear registro en tabla Reserva
      const { data: nuevaReserva, error: reservaError } = await supabase
        .from(reservaTable)
        .insert({
          usuario_id: usuarioId,
          bicicleta_id: bikeId,
          numero_serie: bicicleta.numero_serie,
          estado_reserva: ReservaStatus.ACTIVA,
          timestamp_reserva: ahora.toISOString(),
          timestamp_expiracion: expiracion.toISOString()
        })
        .select()
        .single();

      if (reservaError) {
        throw new Error(`Error al crear reserva: ${reservaError.message}`);
      }

      // 4. Actualizar estado de la bicicleta a "Reservada"
      const { data: bicicletaActualizada, error: updateError } = await supabase
        .from(bikeTable)
        .update({ 
          estado: BikeStatus.RESERVADA,
          reserva_usuario_id: usuarioId,
          reserva_timestamp: ahora.toISOString(),
          reserva_expiracion: expiracion.toISOString()
        })
        .eq("id", bikeId)
        .select()
        .single();

      if (updateError) {
        await supabase.from(reservaTable).delete().eq('id', nuevaReserva.id);
        throw new Error(`Error al reservar bicicleta: ${updateError.message}`);
      }

      // 5. Publicar evento de reserva
      await eventBus.publish(CHANNELS.RESERVAS, {
        type: "bicicleta_reservada",
        data: {
          bikeId: bicicleta.id,
          usuarioId: usuarioId,
          numero_serie: bicicleta.numero_serie,
          reservaId: nuevaReserva.id,
          timestamp: ahora.toISOString(),
          expiracion: expiracion.toISOString(),
          tiempo_reserva: 10
        }
      });

      console.log(`✅ Bicicleta reservada exitosamente: ${bicicleta.numero_serie}`);
      
      return {
        success: true,
        bicicleta: bicicletaActualizada,
        reserva: nuevaReserva,
        tiempo_reserva: 10,
        expiracion: expiracion.toISOString(),
        mensaje: 'Bicicleta reservada exitosamente. Tienes 10 minutos para retirarla.'
      };

    } catch (error) {
      console.error('❌ Error reservando bicicleta:', error.message);
      throw error;
    }
  }

  async cancelarReserva(bikeId, usuarioId) {
    try {
      console.log(`❌ Solicitud de cancelación de reserva - BikeID: ${bikeId}, Usuario: ${usuarioId}`);
      
      // 1. Verificar que la bicicleta existe y está reservada
      const { data: bicicleta, error: bikeError } = await supabase
        .from(bikeTable)
        .select("*")
        .eq("id", bikeId)
        .single();
      
      if (bikeError || !bicicleta) {
        throw new Error('Bicicleta no encontrada');
      }

      if (bicicleta.estado !== BikeStatus.RESERVADA) {
        throw new Error(`La bicicleta no está reservada. Estado actual: ${bicicleta.estado}`);
      }

      if (bicicleta.reserva_usuario_id !== usuarioId) {
        throw new Error('No puedes cancelar una reserva que no te pertenece');
      }

      // 2. Buscar y actualizar la reserva activa
      const { data: reservaActiva, error: reservaError } = await supabase
        .from(reservaTable)
        .select('*')
        .eq('bicicleta_id', bikeId)
        .eq('usuario_id', usuarioId)
        .eq('estado_reserva', ReservaStatus.ACTIVA)
        .single();

      if (reservaError || !reservaActiva) {
        throw new Error('No se encontró una reserva activa para esta bicicleta');
      }

      // 3. Actualizar reserva a "cancelada"
      const { data: reservaActualizada, error: updateReservaError } = await supabase
        .from(reservaTable)
        .update({
          estado_reserva: ReservaStatus.CANCELADA,
          timestamp_finalizacion: new Date().toISOString(),
          motivo_finalizacion: MotivoFinalizacion.CANCELACION_USUARIO
        })
        .eq('id', reservaActiva.id)
        .select()
        .single();

      if (updateReservaError) {
        throw new Error(`Error al actualizar reserva: ${updateReservaError.message}`);
      }

      // 4. Actualizar bicicleta a "Disponible"
      const { data: bicicletaActualizada, error: updateBiciError } = await supabase
        .from(bikeTable)
        .update({ 
          estado: BikeStatus.DISPONIBLE,
          reserva_usuario_id: null,
          reserva_timestamp: null,
          reserva_expiracion: null
        })
        .eq("id", bikeId)
        .select()
        .single();

      if (updateBiciError) {
        throw new Error(`Error al cancelar reserva: ${updateBiciError.message}`);
      }

      // 5. Publicar evento
      await eventBus.publish(CHANNELS.RESERVAS, {
        type: "reserva_cancelada",
        data: {
          bikeId: bicicleta.id,
          usuarioId: usuarioId,
          numero_serie: bicicleta.numero_serie,
          reservaId: reservaActiva.id,
          timestamp: new Date().toISOString(),
          motivo: "cancelacion_manual"
        }
      });

      console.log(`✅ Reserva cancelada exitosamente: ${bicicleta.numero_serie}`);
      
      return {
        success: true,
        bicicleta: bicicletaActualizada,
        reserva: reservaActualizada,
        mensaje: 'Reserva cancelada exitosamente'
      };

    } catch (error) {
      console.error('❌ Error cancelando reserva:', error.message);
      throw error;
    }
  }

  // === MÉTODOS DE VIAJE ===

  async iniciarViajeConSerial(serialNumber, bikeId, usuarioId) {
    try {
      console.log(`🎯 Solicitud de inicio de viaje - BikeID: ${bikeId}, Serial: ${serialNumber}, Usuario: ${usuarioId}`);
      
      // 1. Buscar bicicleta por número de serie
      const { data: bicicleta, error: bikeError } = await supabase
        .from(bikeTable)
        .select("*")
        .eq("numero_serie", serialNumber)
        .single();
      
      if (bikeError || !bicicleta) {
        throw new Error('Bicicleta no encontrada');
      }

      // 2. Validaciones
      if (bicicleta.id !== bikeId) {
        throw new Error(`El número de serie ${serialNumber} no corresponde a la bicicleta seleccionada`);
      }

      const tieneReservaActiva = await this.verificarReservaActivaUsuario(bikeId, usuarioId);
      if (!tieneReservaActiva) {
        throw new Error('No tienes una reserva activa para esta bicicleta. Debes reservarla primero.');
      }

      if (bicicleta.estado !== BikeStatus.DISPONIBLE && 
          bicicleta.estado !== BikeStatus.RESERVADA) {
        throw new Error(`La bicicleta no está disponible. Estado actual: ${bicicleta.estado}`);
      }

      // 3. Simular desbloqueo del candado
      const desbloqueoExitoso = await this.simularDesbloqueoCandado(bicicleta.id);
      if (!desbloqueoExitoso) {
        throw new Error('El candado no respondió en menos de 1 segundo');
      }

      // 4. Actualizar bicicleta a "En_Viaje"
      const { data: bicicletaActualizada, error: updateError } = await supabase
        .from(bikeTable)
        .update({ 
          estado: BikeStatus.EN_USO,
          reserva_usuario_id: null,
          reserva_timestamp: null,
          reserva_expiracion: null
        })
        .eq("id", bikeId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Error al iniciar viaje: ${updateError.message}`);
      }

      // 5. Completar la reserva
      const reservaCompletada = await this.completarReserva(bicicleta.id, usuarioId);

      // 6. Publicar evento de viaje iniciado
      await eventBus.publish(CHANNELS.VIAJES, {
        type: "viaje_iniciado",
        data: {
          bikeId: bicicleta.id,
          usuarioId: usuarioId,
          serialNumber: serialNumber,
          reservaId: reservaCompletada?.id,
          timestamp: new Date().toISOString(),
          tiempoDesbloqueo: desbloqueoExitoso.tiempo
        }
      });

      console.log(`🚀 Viaje iniciado exitosamente para bicicleta: ${serialNumber}`);
      
      return {
        success: true,
        bicicleta: bicicletaActualizada,
        tiempoDesbloqueo: desbloqueoExitoso.tiempo,
        mensaje: 'Viaje iniciado exitosamente'
      };

    } catch (error) {
      console.error('❌ Error iniciando viaje:', error.message);
      throw error;
    }
  }

  // === MÉTODOS AUXILIARES ===

  async verificarReservaActivaExistente(usuarioId) {
    try {
      const { data: reservaActiva, error } = await supabase
        .from(reservaTable)
        .select('id, bicicleta_id, numero_serie, timestamp_expiracion')
        .eq('usuario_id', usuarioId)
        .eq('estado_reserva', ReservaStatus.ACTIVA)
        .single();

      if (error?.code === 'PGRST116') return false;
      if (error) throw error;

      const ahora = new Date();
      const expiracion = new Date(reservaActiva.timestamp_expiracion);
      return ahora <= expiracion;

    } catch (error) {
      console.error('❌ Error verificando reserva activa existente:', error);
      return false;
    }
  }

  async verificarReservaActivaUsuario(bikeId, usuarioId) {
    try {
      const { data: reservaActiva, error } = await supabase
        .from(reservaTable)
        .select('id, timestamp_expiracion')
        .eq('bicicleta_id', bikeId)
        .eq('usuario_id', usuarioId)
        .eq('estado_reserva', ReservaStatus.ACTIVA)
        .single();

      if (error?.code === 'PGRST116') return false;
      if (error) throw error;

      const ahora = new Date();
      const expiracion = new Date(reservaActiva.timestamp_expiracion);
      return ahora <= expiracion;

    } catch (error) {
      console.error('❌ Error verificando reserva activa:', error);
      return false;
    }
  }

  async completarReserva(bikeId, usuarioId) {
    try {
      const { data: reservaActiva, error } = await supabase
        .from(reservaTable)
        .select('*')
        .eq('bicicleta_id', bikeId)
        .eq('usuario_id', usuarioId)
        .eq('estado_reserva', ReservaStatus.ACTIVA)
        .single();

      if (error || !reservaActiva) return null;

      const { data: reservaCompletada, error: updateError } = await supabase
        .from(reservaTable)
        .update({
          estado_reserva: ReservaStatus.COMPLETADA,
          timestamp_finalizacion: new Date().toISOString(),
          motivo_finalizacion: MotivoFinalizacion.INICIO_VIAJE
        })
        .eq('id', reservaActiva.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Error completando reserva:', updateError);
        return null;
      }

      await eventBus.publish(CHANNELS.RESERVAS, {
        type: "reserva_completada",
        data: {
          bikeId: bikeId,
          usuarioId: usuarioId,
          numero_serie: reservaActiva.numero_serie,
          reservaId: reservaActiva.id,
          timestamp: new Date().toISOString()
        }
      });

      return reservaCompletada;

    } catch (error) {
      console.error('❌ Error en completarReserva:', error);
      return null;
    }
  }

  async liberarReservasExpiradas() {
    try {
      const ahora = new Date().toISOString();
      
      const { data: reservasExpiradas, error } = await supabase
        .from(reservaTable)
        .select('id, usuario_id, bicicleta_id, numero_serie, timestamp_expiracion')
        .eq('estado_reserva', ReservaStatus.ACTIVA)
        .lt('timestamp_expiracion', ahora);

      if (error) {
        console.error('❌ Error buscando reservas expiradas:', error);
        return;
      }

      if (reservasExpiradas.length === 0) return;

      console.log(`🔄 Liberando ${reservasExpiradas.length} reservas expiradas...`);

      for (const reserva of reservasExpiradas) {
        try {
          // Actualizar reserva
          await supabase
            .from(reservaTable)
            .update({
              estado_reserva: ReservaStatus.EXPIRADA,
              timestamp_finalizacion: new Date().toISOString(),
              motivo_finalizacion: MotivoFinalizacion.EXPIRACION_TIEMPO
            })
            .eq('id', reserva.id);

          // Actualizar bicicleta
          await supabase
            .from(bikeTable)
            .update({ 
              estado: BikeStatus.DISPONIBLE,
              reserva_usuario_id: null,
              reserva_timestamp: null,
              reserva_expiracion: null
            })
            .eq('id', reserva.bicicleta_id);

          await eventBus.publish(CHANNELS.RESERVAS, {
            type: "reserva_expirada",
            data: {
              bikeId: reserva.bicicleta_id,
              usuarioId: reserva.usuario_id,
              numero_serie: reserva.numero_serie,
              reservaId: reserva.id,
              timestamp: new Date().toISOString(),
              expiracion_original: reserva.timestamp_expiracion
            }
          });

        } catch (error) {
          console.error(`❌ Error procesando reserva expirada ${reserva.id}:`, error);
        }
      }

    } catch (error) {
      console.error('❌ Error en liberarReservasExpiradas:', error);
    }
  }

  async simularDesbloqueoCandado(bikeId) {
    return new Promise((resolve) => {
      const inicio = Date.now();
      setTimeout(() => {
        const tiempoTranscurrido = Date.now() - inicio;
        resolve({
          exito: tiempoTranscurrido <= 1000,
          tiempo: tiempoTranscurrido,
          mensaje: tiempoTranscurrido <= 1000 ? 'CANDADO_DESBLOQUEADO' : 'TIMEOUT_CANDADO'
        });
      }, Math.random() * 800 + 200);
    });
  }

  // === MÉTODOS DE CONSULTA ===

async obtenerReservasUsuario(usuarioId) {
  const { data: reservas, error } = await supabase
    .from(reservaTable)
    .select(`
      id,
      bicicleta_id,
      numero_serie,
      estado_reserva,
      timestamp_reserva,
      timestamp_expiracion,
      timestamp_finalizacion,
      motivo_finalizacion,
      Bicicleta (
        id,
        marca,
        tipo,
        estado,
        idEstacion
      )
    `)
    .eq('usuario_id', usuarioId)
    .order('timestamp_reserva', { ascending: false });

  if (error) {
    console.error('❌ Error obteniendo reservas del usuario:', error);
    throw new Error('Error al obtener las reservas');
  }

  return reservas || [];
}

async obtenerReservaActiva(usuarioId) {
  const { data: reserva, error } = await supabase
    .from(reservaTable)
    .select(`
      id,
      bicicleta_id,
      numero_serie,
      timestamp_reserva,
      timestamp_expiracion,
      Bicicleta (
        id,
        marca,
        tipo,
        estado,
        idEstacion,
        Estacion (
          id,
          nombre,
          posicion
        )
      )
    `)
    .eq('usuario_id', usuarioId)
    .eq('estado_reserva', ReservaStatus.ACTIVA)
    .gt('timestamp_expiracion', new Date().toISOString())
    .single();

  if (error?.code === 'PGRST116') return null; // No encontrado
  if (error) {
    console.error('❌ Error obteniendo reserva activa:', error);
    throw new Error('Error al obtener la reserva activa');
  }

  return reserva;
}

async obtenerHistorialViajes(usuarioId, limite = 10) {
  const { data: viajes, error } = await supabase
    .from(reservaTable)
    .select(`
      id,
      bicicleta_id,
      numero_serie,
      timestamp_reserva,
      timestamp_finalizacion,
      motivo_finalizacion,
      Bicicleta (
        id,
        marca,
        tipo
      )
    `)
    .eq('usuario_id', usuarioId)
    .in('estado_reserva', [ReservaStatus.COMPLETADA, ReservaStatus.CANCELADA, ReservaStatus.EXPIRADA])
    .order('timestamp_reserva', { ascending: false })
    .limit(limite);

  if (error) {
    console.error('❌ Error obteniendo historial de viajes:', error);
    throw new Error('Error al obtener el historial de viajes');
  }

  return viajes || [];
}
}

export const bookingHandler = new BookingHandler();