import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

const reservaTable = "Reserva";
const bikeTable = "Bicicleta";

export const ReservaStatus = {
  ACTIVA: 'activa',
  PROGRAMADA: 'programada',
  COMPLETADA: 'completada', 
  CANCELADA: 'cancelada',
  EXPIRADA: 'expirada',
  FALLIDA: 'fallida'
};

export const MotivoFinalizacion = {
  INICIO_VIAJE: 'inicio_viaje',
  CANCELACION_USUARIO: 'cancelacion_usuario', 
  EXPIRACION_TIEMPO: 'expiracion_tiempo',
  BICICLETA_NO_DISPONIBLE: 'bicicleta_no_disponible',
  ERROR_ACTIVACION: 'error_activacion'
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
      
      // Verificar que el usuario no tenga ya una reserva activa O programada
      const tieneReservaActiva = await this.verificarReservaActivaExistente(usuarioId);
      if (tieneReservaActiva) {
        throw new Error('Ya tienes una reserva activa o programada. Debes cancelarla o completarla antes de hacer una nueva reserva.');
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

  async reservarBicicletaProgramada(bikeId, usuarioId, fechaHoraProgramada) {
    try {
      console.log(`📅 Solicitud de reserva programada - BikeID: ${bikeId}, Usuario: ${usuarioId}, Fecha: ${fechaHoraProgramada}`);
      
      // Validar fecha futura
      const fechaProgramada = new Date(fechaHoraProgramada);
      const ahora = new Date();
      
      if (fechaProgramada <= ahora) {
        throw new Error('La fecha de reserva debe ser futura');
      }

      // ✅ Verificar que no tenga NINGUNA reserva activa o programada
      const tieneReservaActiva = await this.verificarReservaActivaExistente(usuarioId);
      if (tieneReservaActiva) {
        throw new Error('Ya tienes una reserva activa o programada. Debes cancelarla o completarla antes de hacer una nueva reserva.');
      }
      // 1. Verificar que la bicicleta existe
      const { data: bicicleta, error: bikeError } = await supabase
        .from(bikeTable)
        .select("*")
        .eq("id", bikeId)
        .single();
      
      if (bikeError || !bicicleta) {
        throw new Error('Bicicleta no encontrada');
      }

      // 2. Calcular timestamps (la reserva se activa en la fecha programada)
      const timestampActivacion = fechaProgramada.toISOString();
      const expiracion = new Date(fechaProgramada.getTime() + 10 * 60 * 1000); // 10 min después

      // 3. Crear registro de reserva programada
      const { data: nuevaReserva, error: reservaError } = await supabase
        .from(reservaTable)
        .insert({
          usuario_id: usuarioId,
          bicicleta_id: bikeId,
          numero_serie: bicicleta.numero_serie,
          estado_reserva: ReservaStatus.PROGRAMADA, // ✅ NUEVO ESTADO
          timestamp_reserva: ahora.toISOString(),
          timestamp_programada: timestampActivacion, // ✅ Fecha programada
          timestamp_expiracion: expiracion.toISOString(),
          tipo_reserva: 'programada' // ✅ Tipo de reserva
        })
        .select()
        .single();

      if (reservaError) {
        throw new Error(`Error al crear reserva programada: ${reservaError.message}`);
      }

      // 4. Programar la activación de la reserva
      this.programarActivacionReserva(nuevaReserva.id, fechaProgramada);

      // 5. Publicar evento de reserva programada
      await eventBus.publish(CHANNELS.RESERVAS, {
        type: "reserva_programada",
        data: {
          bikeId: bicicleta.id,
          usuarioId: usuarioId,
          numero_serie: bicicleta.numero_serie,
          reservaId: nuevaReserva.id,
          timestamp_programada: timestampActivacion,
          timestamp_creacion: ahora.toISOString()
        }
      });

      console.log(`✅ Reserva programada exitosamente: ${bicicleta.numero_serie} para ${fechaProgramada}`);
      
      return {
        success: true,
        reserva: nuevaReserva,
        tiempo_restante: fechaProgramada.getTime() - ahora.getTime(),
        mensaje: `Reserva programada exitosamente para ${fechaProgramada.toLocaleString()}`
      };

    } catch (error) {
      console.error('❌ Error reservando bicicleta programada:', error.message);
      throw error;
    }
  }

  async programarActivacionReserva(reservaId, fechaActivacion) {
    const ahora = new Date();
    const tiempoEspera = fechaActivacion.getTime() - ahora.getTime();
    
    if (tiempoEspera <= 0) {
      // Si ya pasó la fecha, activar inmediatamente
      this.activarReservaProgramada(reservaId);
      return;
    }

    console.log(`⏰ Programando activación de reserva ${reservaId} en ${tiempoEspera}ms`);
    
    setTimeout(async () => {
      try {
        await this.activarReservaProgramada(reservaId);
      } catch (error) {
        console.error(`❌ Error activando reserva programada ${reservaId}:`, error);
      }
    }, tiempoEspera);
  }

  async activarReservaProgramada(reservaId) {
    try {
      console.log(`🔄 Activando reserva programada: ${reservaId}`);
      
      // 1. Obtener datos de la reserva
      const { data: reserva, error } = await supabase
        .from(reservaTable)
        .select('*')
        .eq('id', reservaId)
        .eq('estado_reserva', ReservaStatus.PROGRAMADA)
        .single();

      if (error || !reserva) {
        console.log(`❌ Reserva programada ${reservaId} no encontrada o ya activada`);
        return;
      }

      // 2. Verificar que la bicicleta sigue disponible
      const { data: bicicleta, error: bikeError } = await supabase
        .from(bikeTable)
        .select('*')
        .eq('id', reserva.bicicleta_id)
        .single();

      if (bikeError || !bicicleta) {
        await this.marcarReservaComoFallida(reservaId, 'Bicicleta no disponible');
        return;
      }

      if (bicicleta.estado !== BikeStatus.DISPONIBLE) {
        await this.marcarReservaComoFallida(reservaId, `Bicicleta no disponible. Estado: ${bicicleta.estado}`);
        return;
      }

      // 3. Actualizar reserva a ACTIVA
      const { data: reservaActualizada, error: updateError } = await supabase
        .from(reservaTable)
        .update({
          estado_reserva: ReservaStatus.ACTIVA,
          timestamp_activacion: new Date().toISOString()
        })
        .eq('id', reservaId)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Error activando reserva: ${updateError.message}`);
      }

      // 4. Actualizar bicicleta a RESERVADA
      const { data: bicicletaActualizada, error: bikeUpdateError } = await supabase
        .from(bikeTable)
        .update({ 
          estado: BikeStatus.RESERVADA,
          reserva_usuario_id: reserva.usuario_id,
          reserva_timestamp: new Date().toISOString(),
          reserva_expiracion: reserva.timestamp_expiracion
        })
        .eq('id', reserva.bicicleta_id)
        .select()
        .single();

      if (bikeUpdateError) {
        await this.marcarReservaComoFallida(reservaId, 'Error al reservar bicicleta');
        return;
      }

      // 5. Publicar evento de activación
      await eventBus.publish(CHANNELS.RESERVAS, {
        type: "reserva_activada",
        data: {
          bikeId: bicicleta.id,
          usuarioId: reserva.usuario_id,
          numero_serie: bicicleta.numero_serie,
          reservaId: reserva.id,
          timestamp_activacion: new Date().toISOString(),
          expiracion: reserva.timestamp_expiracion
        }
      });

      console.log(`✅ Reserva programada activada: ${reservaId}`);

    } catch (error) {
      console.error(`❌ Error activando reserva programada ${reservaId}:`, error);
      await this.marcarReservaComoFallida(reservaId, error.message);
    }
  }

  async marcarReservaComoFallida(reservaId, motivo) {
    try {

      // Mapear mensajes de error a motivos específicos
      let motivoFinalizacion = MotivoFinalizacion.ERROR_ACTIVACION;
      
      if (motivo.includes('Bicicleta no disponible')) {
        motivoFinalizacion = MotivoFinalizacion.BICICLETA_NO_DISPONIBLE;
      }

      await supabase
        .from(reservaTable)
        .update({
          estado_reserva: ReservaStatus.FALLIDA,
          motivo_finalizacion: motivo,
          timestamp_finalizacion: new Date().toISOString()
        })
        .eq('id', reservaId);

      await eventBus.publish(CHANNELS.RESERVAS, {
        type: "reserva_fallida",
        data: {
          reservaId: reservaId,
          motivo: motivo,
          timestamp: new Date().toISOString()
        }
      });

      console.log(`❌ Reserva ${reservaId} marcada como fallida: ${motivo}`);
    } catch (error) {
      console.error(`❌ Error marcando reserva como fallida ${reservaId}:`, error);
    }
  }

  async verificarReservaSolapada(usuarioId, bikeId, fechaProgramada) {
    const margen = 30 * 60 * 1000; // 30 minutos de margen
    
    const inicioBusqueda = new Date(fechaProgramada.getTime() - margen);
    const finBusqueda = new Date(fechaProgramada.getTime() + margen);

    const { data: reservasSolapadas, error } = await supabase
      .from(reservaTable)
      .select('id, timestamp_programada')
      .eq('usuario_id', usuarioId)
      .eq('bicicleta_id', bikeId)
      .in('estado_reserva', [ReservaStatus.PROGRAMADA, ReservaStatus.ACTIVA])
      .gte('timestamp_programada', inicioBusqueda.toISOString())
      .lte('timestamp_programada', finBusqueda.toISOString());

    if (error) {
      console.error('❌ Error verificando reservas solapadas:', error);
      return false;
    }

    return reservasSolapadas && reservasSolapadas.length > 0;
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
      const { data: reservasActivas, error } = await supabase
        .from(reservaTable)
        .select('id, bicicleta_id, numero_serie, estado_reserva, timestamp_expiracion, timestamp_programada')
        .eq('usuario_id', usuarioId)
        .in('estado_reserva', [ReservaStatus.ACTIVA, ReservaStatus.PROGRAMADA]) // ✅ Verificar AMBOS estados
        .order('timestamp_reserva', { ascending: false });

      if (error) {
        console.error('❌ Error verificando reservas activas:', error);
        return false;
      }

      if (!reservasActivas || reservasActivas.length === 0) {
        return false;
      }

      const ahora = new Date();

      // Verificar si hay alguna reserva ACTIVA que no haya expirado
      const reservaActivaNoExpirada = reservasActivas.find(reserva => 
        reserva.estado_reserva === ReservaStatus.ACTIVA && 
        new Date(reserva.timestamp_expiracion) > ahora
      );

      // Verificar si hay alguna reserva PROGRAMADA que esté pendiente de activación
      const reservaProgramadaPendiente = reservasActivas.find(reserva => 
        reserva.estado_reserva === ReservaStatus.PROGRAMADA && 
        new Date(reserva.timestamp_programada) > ahora
      );

      // Si existe ALGUNA reserva activa no expirada O programada pendiente, retornar true
      return !!(reservaActivaNoExpirada || reservaProgramadaPendiente);

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


  // == MÉTODOS DE HISTORIAL DE RESERVAS ==
  async obtenerHistorialReservasUsuario(usuarioId, limite = 10, pagina = 1) {
    try {
      const offset = (pagina - 1) * limite;

      console.log(`📊 Obteniendo historial de reservas - Usuario: ${usuarioId}, Límite: ${limite}, Página: ${pagina}`);

      // Consulta principal con joins para obtener datos relacionados
      const { data: reservas, error, count } = await supabase
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
        `, { count: 'exact' })
        .eq('usuario_id', usuarioId)
        .order('timestamp_reserva', { ascending: false })
        .range(offset, offset + limite - 1);

      if (error) {
        console.error('❌ Error obteniendo historial de reservas:', error);
        throw new Error(`Error al obtener el historial: ${error.message}`);
      }

      // Formatear los datos para la respuesta
      const historialFormateado = reservas.map(reserva => ({
        id: reserva.id,
        bicicleta: {
          id: reserva.bicicleta_id,
          numero_serie: reserva.numero_serie,
          marca: reserva.Bicicleta?.marca || 'N/A',
          tipo: reserva.Bicicleta?.tipo || 'N/A',
          estacion: {
            id: reserva.Bicicleta?.idEstacion || null,
            nombre: reserva.Bicicleta?.Estacion?.nombre || 'N/A'
          }
        },
        estado: reserva.estado_reserva,
        tipo: reserva.tipo_reserva || 'inmediata',
        timestamps: {
          reserva: reserva.timestamp_reserva,
          expiracion: reserva.timestamp_expiracion,
          finalizacion: reserva.timestamp_finalizacion,
          programada: reserva.timestamp_programada,
          activacion: reserva.timestamp_activacion
        },
        motivo_finalizacion: reserva.motivo_finalizacion,
        duracion: this.calcularDuracionReserva(reserva)
      }));

      return {
        reservas: historialFormateado,
        paginacion: {
          pagina_actual: pagina,
          total_paginas: Math.ceil(count / limite),
          total_reservas: count,
          por_pagina: limite
        }
      };

    } catch (error) {
      console.error('❌ Error en obtenerHistorialReservasUsuario:', error);
      throw error;
    }
  }

  // Método auxiliar para calcular duración
  calcularDuracionReserva(reserva) {
    if (!reserva.timestamp_reserva) return null;

    const inicio = new Date(reserva.timestamp_reserva);
    const fin = reserva.timestamp_finalizacion 
      ? new Date(reserva.timestamp_finalizacion) 
      : new Date();

    const duracionMs = fin.getTime() - inicio.getTime();
    const minutos = Math.floor(duracionMs / (1000 * 60));
    const horas = Math.floor(minutos / 60);

    if (horas > 0) {
      return `${horas}h ${minutos % 60}m`;
    }
    return `${minutos}m`;
  }

  // Método para obtener estadísticas del usuario
  async obtenerEstadisticasUsuario(usuarioId) {
    try {
      const { data, error } = await supabase
        .from(reservaTable)
        .select('estado_reserva, timestamp_reserva')
        .eq('usuario_id', usuarioId);

      if (error) {
        console.error('❌ Error obteniendo estadísticas:', error);
        return null;
      }

      const estadisticas = {
        total_reservas: data.length,
        reservas_activas: data.filter(r => r.estado_reserva === ReservaStatus.ACTIVA).length,
        reservas_completadas: data.filter(r => r.estado_reserva === ReservaStatus.COMPLETADA).length,
        reservas_canceladas: data.filter(r => r.estado_reserva === ReservaStatus.CANCELADA).length,
        reservas_programadas: data.filter(r => r.estado_reserva === ReservaStatus.PROGRAMADA).length,
        reservas_expiradas: data.filter(r => r.estado_reserva === ReservaStatus.EXPIRADA).length,
        primera_reserva: data.length > 0 
          ? new Date(Math.min(...data.map(r => new Date(r.timestamp_reserva)))) 
          : null
      };

      return estadisticas;

    } catch (error) {
      console.error('❌ Error en obtenerEstadisticasUsuario:', error);
      return null;
    }
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
  try {
    const { data: reserva, error } = await supabase
      .from(reservaTable)
      .select(`
        id,
        bicicleta_id,
        numero_serie,
        estado_reserva,
        timestamp_reserva,
        timestamp_expiracion,
        timestamp_programada,
        timestamp_activacion,
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
      .in('estado_reserva', [ReservaStatus.ACTIVA, ReservaStatus.PROGRAMADA]) // ✅ Incluir programadas
      .order('timestamp_reserva', { ascending: false })
      .limit(1)
      .single();

    if (error?.code === 'PGRST116') return null; // No encontrado
    if (error) {
      console.error('❌ Error obteniendo reserva activa:', error);
      throw new Error('Error al obtener la reserva activa');
    }

    // Si es una reserva activa, verificar que no haya expirado
    if (reserva.estado_reserva === ReservaStatus.ACTIVA) {
      const ahora = new Date();
      const expiracion = new Date(reserva.timestamp_expiracion);
      if (ahora > expiracion) {
        return null; // Reserva expirada
      }
    }

    return reserva;

  } catch (error) {
    console.error('❌ Error en obtenerReservaActiva:', error);
    return null;
  }
}

// Método auxiliar para obtener detalles de la reserva activa/programada
async obtenerDetallesReservaActiva(usuarioId) {
  try {
    const { data: reservas, error } = await supabase
      .from(reservaTable)
      .select(`
        id,
        bicicleta_id,
        numero_serie,
        estado_reserva,
        timestamp_reserva,
        timestamp_expiracion,
        timestamp_programada,
        timestamp_activacion,
        tipo_reserva,
        Bicicleta (
          id,
          marca,
          tipo,
          estado
        )
      `)
      .eq('usuario_id', usuarioId)
      .in('estado_reserva', [ReservaStatus.ACTIVA, ReservaStatus.PROGRAMADA])
      .order('timestamp_reserva', { ascending: false });

    if (error) {
      console.error('❌ Error obteniendo detalles de reserva:', error);
      return null;
    }

    if (!reservas || reservas.length === 0) {
      return null;
    }

    const ahora = new Date();
    
    // Encontrar la reserva válida más reciente
    const reservaValida = reservas.find(reserva => {
      if (reserva.estado_reserva === ReservaStatus.ACTIVA) {
        return new Date(reserva.timestamp_expiracion) > ahora;
      } else if (reserva.estado_reserva === ReservaStatus.PROGRAMADA) {
        return new Date(reserva.timestamp_programada) > ahora;
      }
      return false;
    });

    return reservaValida || null;

  } catch (error) {
    console.error('❌ Error en obtenerDetallesReservaActiva:', error);
    return null;
  }
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