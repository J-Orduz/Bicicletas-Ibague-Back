import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";
import { tripHandler } from "../trip/trip-handler.js";

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
  RESERVADA: 'Reservada',
  EN_REDISTRIBUCION: 'En_Redistribucion'
};
export const tipoBicicleta = {
  ELECTRICA: 'Electrica',
  MECANICA: 'Mecanica'
}

class BookingHandler {
  constructor() { }

  // === MÉTODOS DE RESERVA ===

  async verificarUsuarioPuedeReservar(usuarioId) {
    try {
      console.log(`🔍 Verificando estado del usuario para reserva: ${usuarioId}`);

      // 1. Verificar saldo en la tabla profiles
      const { data: perfil, error: perfilError } = await supabase
        .from('profiles')
        .select('saldo')
        .eq('id', usuarioId)
        .single();

      if (perfilError) {
        console.error('❌ Error consultando perfil del usuario:', perfilError);
        throw new Error('Error al verificar el estado de la cuenta');
      }

      if (!perfil) {
        throw new Error('Perfil de usuario no encontrado');
      }

      // Verificar si el saldo es negativo
      if (perfil.saldo < 0) {
        console.log(`❌ Usuario ${usuarioId} tiene saldo negativo: ${perfil.saldo}`);
        return {
          puedeReservar: false,
          motivo: 'SALDO_NEGATIVO',
          detalles: `Saldo actual: COP $${perfil.saldo}. Recargue su cuenta para realizar reservas.`
        };
      }

      // 2. Verificar multas pendientes
      const { data: multasPendientes, error: multasError } = await supabase
        .from('multas')
        .select('id, motivo, monto, fecha_creacion')
        .eq('usuario_id', usuarioId)
        .eq('estado', 'pendiente');

      if (multasError) {
        console.error('❌ Error consultando multas del usuario:', multasError);
        throw new Error('Error al verificar el estado de multas');
      }

      if (multasPendientes && multasPendientes.length > 0) {
        console.log(`❌ Usuario ${usuarioId} tiene ${multasPendientes.length} multa(s) pendiente(s)`);
        const totalMultas = multasPendientes.reduce((sum, multa) => sum + multa.monto, 0);

        return {
          puedeReservar: false,
          motivo: 'MULTAS_PENDIENTES',
          detalles: `Tiene ${multasPendientes.length} multa(s) pendiente(s) por un total de COP $${totalMultas}. Regularice su situación para realizar reservas.`,
          multas: multasPendientes
        };
      }

      // 3. Si pasa todas las verificaciones
      console.log(`✅ Usuario ${usuarioId} puede realizar reservas. Saldo: COP $${perfil.saldo}`);
      return {
        puedeReservar: true,
        saldo: perfil.saldo,
        multasPendientes: 0
      };

    } catch (error) {
      console.error('❌ Error en verificarUsuarioPuedeReservar:', error);
      throw error;
    }
  }


  async reservarBicicleta(bikeId, usuarioId) {
    try {
      console.log(`📋 Solicitud de reserva - BikeID: ${bikeId}, Usuario: ${usuarioId}`);

      // Verificar que no tenga viajes activos
      const estadoViaje = await this.verificarViajesActivos(usuarioId);
      if (estadoViaje && estadoViaje.tiene_viajes_activos) {
        throw new Error(estadoViaje.mensaje);
      }

      const estadoUsuario = await this.verificarUsuarioPuedeReservar(usuarioId);
      if (!estadoUsuario.puedeReservar) {
        throw new Error(`No puede realizar reservas: ${estadoUsuario.detalles}`);
      }

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

      // 1. Verificar que la bicicleta existe y está reservada POR ESTE USUARIO
      const { data: bicicleta, error: bikeError } = await supabase
        .from(bikeTable)
        .select("*")
        .eq("id", bikeId)
        .single();

      if (bikeError || !bicicleta) {
        throw new Error('Bicicleta no encontrada');
      }

      console.log(`🚲 Estado bicicleta: ${bicicleta.estado}, Usuario reserva: ${bicicleta.reserva_usuario_id}`);

      // ✅ VERIFICACIÓN SIMPLIFICADA: Solo importa que esté reservada por este usuario
      if (bicicleta.estado !== BikeStatus.RESERVADA) {
        throw new Error(`La bicicleta no está reservada. Estado actual: ${bicicleta.estado}`);
      }

      if (bicicleta.reserva_usuario_id !== usuarioId) {
        throw new Error('No puedes cancelar una reserva que no te pertenece');
      }

      // 2. Buscar CUALQUIER reserva reciente para esta bicicleta y usuario (sin importar estado)
      const { data: reserva, error: reservaError } = await supabase
        .from(reservaTable)
        .select('*')
        .eq('bicicleta_id', bikeId)
        .eq('usuario_id', usuarioId)
        .order('timestamp_reserva', { ascending: false })
        .limit(1)
        .single();

      if (reservaError || !reserva) {
        console.log('⚠️ No se encontró registro de reserva, pero la bicicleta está reservada. Procediendo con cancelación...');
        // Continuamos igual, porque la bicicleta SÍ está reservada por este usuario
      }

      // 3. Si existe reserva, actualizarla a "cancelada"
      let reservaActualizada = null;
      if (reserva) {
        const { data: reservaUpdate, error: updateReservaError } = await supabase
          .from(reservaTable)
          .update({
            estado_reserva: ReservaStatus.CANCELADA,
            timestamp_finalizacion: new Date().toISOString(),
            motivo_finalizacion: MotivoFinalizacion.CANCELACION_USUARIO
          })
          .eq('id', reserva.id)
          .select()
          .single();

        if (updateReservaError) {
          console.error('❌ Error actualizando reserva:', updateReservaError);
          // No lanzamos error aquí, porque lo importante es liberar la bicicleta
        } else {
          reservaActualizada = reservaUpdate;
        }
      }

      // 4. ACTUALIZAR BICICLETA A "DISPONIBLE" (esto es lo más importante)
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
          reservaId: reserva?.id || 'sin_registro',
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

      // Verificar que no tenga viajes activos
      const estadoViaje = await this.verificarViajesActivos(usuarioId);
      if (estadoViaje && estadoViaje.tiene_viajes_activos) {
        throw new Error(estadoViaje.mensaje);
      }

      // Verificar si el usuario puede reservar
      const estadoUsuario = await this.verificarUsuarioPuedeReservar(usuarioId);
      if (!estadoUsuario.puedeReservar) {
        throw new Error(`No puede realizar reservas: ${estadoUsuario.detalles}`);
      }

      // Validar fecha futura
      const fechaProgramada = new Date(fechaHoraProgramada);
      const ahora = new Date();

      if (fechaProgramada <= ahora) {
        throw new Error('La fecha de reserva debe ser futura');
      }

      // Verificar que no tenga NINGUNA reserva activa o programada
      const tieneReservaActiva = await this.verificarReservaActivaExistente(usuarioId);
      if (tieneReservaActiva) {
        throw new Error('Ya tienes una reserva activa o programada. Debes cancelarla o completarla antes de hacer una nueva reserva.');
      }

      // 1. Verificar que la bicicleta existe Y ESTÁ DISPONIBLE
      const { data: bicicleta, error: bikeError } = await supabase
        .from(bikeTable)
        .select("*")
        .eq("id", bikeId)
        .single();

      if (bikeError || !bicicleta) {
        throw new Error('Bicicleta no encontrada');
      }

      // ✅ VERIFICAR QUE LA BICICLETA ESTÉ DISPONIBLE
      if (bicicleta.estado !== BikeStatus.DISPONIBLE) {
        throw new Error(`La bicicleta no está disponible para reservar. Estado actual: ${bicicleta.estado}`);
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
          estado_reserva: ReservaStatus.PROGRAMADA,
          timestamp_reserva: ahora.toISOString(),
          timestamp_programada: timestampActivacion,
          timestamp_expiracion: expiracion.toISOString(),
          tipo_reserva: 'programada'
        })
        .select()
        .single();

      if (reservaError) {
        throw new Error(`Error al crear reserva programada: ${reservaError.message}`);
      }

      // 4. ACTUALIZAR BICICLETA A "RESERVADA" INMEDIATAMENTE
      const { data: bicicletaActualizada, error: updateBiciError } = await supabase
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

      if (updateBiciError) {
        // Si falla la actualización de la bicicleta, eliminar la reserva creada
        await supabase.from(reservaTable).delete().eq('id', nuevaReserva.id);
        throw new Error(`Error al reservar bicicleta: ${updateBiciError.message}`);
      }

      // 5. Programar la activación de la reserva
      this.programarActivacionReserva(nuevaReserva.id, fechaProgramada);

      // 6. Publicar evento de reserva programada
      await eventBus.publish(CHANNELS.RESERVAS, {
        type: "reserva_programada",
        data: {
          bikeId: bicicleta.id,
          usuarioId: usuarioId,
          numero_serie: bicicleta.numero_serie,
          reservaId: nuevaReserva.id,
          timestamp_programada: timestampActivacion,
          timestamp_creacion: ahora.toISOString(),
          estado_bicicleta: BikeStatus.RESERVADA
        }
      });

      console.log(`✅ Reserva programada exitosamente: ${bicicleta.numero_serie} para ${fechaProgramada}`);
      console.log(`🚲 Bicicleta actualizada a estado: ${BikeStatus.RESERVADA}`);

      return {
        success: true,
        reserva: nuevaReserva,
        bicicleta: bicicletaActualizada,
        tiempo_restante: fechaProgramada.getTime() - ahora.getTime(),
        mensaje: `Reserva programada exitosamente para ${fechaProgramada.toLocaleString()}. La bicicleta ya está reservada.`
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

      if (bicicleta.estado !== BikeStatus.RESERVADA) {
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

      // NO actualizar bicicleta (ya está en estado RESERVADA)
      // 4. Solo actualizar el timestamp de reserva para reflejar la activación
      const { error: bikeUpdateError } = await supabase
        .from(bikeTable)
        .update({
          reserva_timestamp: new Date().toISOString() // Actualizar timestamp de activación
        })
        .eq('id', reserva.bicicleta_id);

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

  async iniciarViajeConSerial(serialNumber, bikeId, usuarioId, estacionFin) {
    try {
      console.log(`🎯 Solicitud de inicio de viaje - BikeID: ${bikeId}, Serial: ${serialNumber}, Usuario: ${usuarioId}, EstacionFin: ${estacionFin}`);

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

      //merequetengue

      /*   if (bicicleta.tipo ===tipoBicicleta.ELECTRICA && bicicleta.) {
           throw new Error(`La bicicleta no está disponible. Estado actual: ${bicicleta.estado}`);
         }*/



      // VERIFICAR Y USAR SUSCRIPCIÓN 
      let usoSubscripcion = false;
      let suscripcionActualizada = null;

      // Verificar si el usuario tiene suscripción activa
      const { data: suscripcion, error: errorSuscripcion } = await supabase
        .from('suscripciones')
        .select('*')
        .eq('usuario_id', usuarioId)
        .in('estado', ['activa', 'sin_viajes'])
        .order('fecha_inicio', { ascending: false })
        .limit(1)
        .single();

      if (!errorSuscripcion && suscripcion) {
        // Verificar que la suscripción no esté vencida
        const ahora = new Date();
        const vencimiento = new Date(suscripcion.fecha_vencimiento);

        if (ahora <= vencimiento && suscripcion.viajes_disponibles > 0) {
          console.log(`🎫 Usuario tiene suscripción activa. Viajes disponibles: ${suscripcion.viajes_disponibles}`);

          // Calcular nuevos valores
          const nuevosViajesDisponibles = suscripcion.viajes_disponibles - 1;
          const nuevosViajesUtilizados = suscripcion.viajes_utilizados + 1;
          const nuevoEstado = nuevosViajesDisponibles === 0 ? 'sin_viajes' : 'activa';

          // Actualizar la suscripción
          const { data: suscripcionUpdate, error: updateError } = await supabase
            .from('suscripciones')
            .update({
              viajes_disponibles: nuevosViajesDisponibles,
              viajes_utilizados: nuevosViajesUtilizados,
              estado: nuevoEstado,
              updated_at: ahora.toISOString()
            })
            .eq('id', suscripcion.id)
            .select()
            .single();

          if (updateError) {
            console.error('❌ Error actualizando suscripción:', updateError);
          } else {
            usoSubscripcion = true;
            suscripcionActualizada = suscripcionUpdate;
            console.log(`✅ Viaje de suscripción utilizado. Quedan: ${nuevosViajesDisponibles} viajes`);
          }
        } else if (ahora > vencimiento) {
          console.log('ℹ️ Suscripción encontrada pero está vencida');
          // Marcar suscripción como inactiva si está vencida
          await supabase
            .from('suscripciones')
            .update({
              estado: 'inactiva',
              updated_at: new Date().toISOString()
            })
            .eq('id', suscripcion.id);
        } else if (suscripcion.viajes_disponibles <= 0) {
          console.log('ℹ️ Suscripción encontrada pero sin viajes disponibles');
        }
      } else {
        console.log('ℹ️ Usuario no tiene suscripción activa o hubo error:', errorSuscripcion?.message);
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
          idEstacion: null,
          reserva_usuario_id: null,
          reserva_timestamp: null,
          reserva_expiracion: null
        })
        .eq("id", bikeId)
        .select()
        .single();

      // Obtener la estación de inicio de la bicicleta
      const estacionInicioId = bicicleta.idEstacion;

      if (estacionInicioId) {
          await tripHandler.actualizarContadorEstacion(estacionInicioId, 'decrementar');
      } else {
          console.log('⚠️ Bicicleta no tiene estación de inicio asignada');
      }

      if (updateError) {
        throw new Error(`Error al iniciar viaje: ${updateError.message}`);
      }


      // OBTENER LA RESERVA ACTIVA PARA CREAR EL VIAJE
      const { data: reservaActiva, error: reservaError } = await supabase
        .from(reservaTable)
        .select('id, bicicleta_id, usuario_id')
        .eq('bicicleta_id', bikeId)
        .eq('usuario_id', usuarioId)
        .eq('estado_reserva', ReservaStatus.ACTIVA)
        .single();

      if (reservaError || !reservaActiva) {
        throw new Error('No se pudo encontrar la reserva activa para crear el viaje');
      }

      // CREAR REGISTRO EN LA TABLA VIAJE
      const ahora = new Date();
      const { data: nuevoViaje, error: viajeError } = await supabase
        .from('Viaje')
        .insert({
          idReserva: reservaActiva.id,
          fechacomienzo: ahora.toISOString(),
          estado_viaje: 'iniciado', // Estado inicial
          estacionInicio: bicicleta.idEstacion,
          estacionFin: estacionFin, // Asumiendo que la bicicleta tiene estación
          tipo_viaje: 'MILLA', // Valor por defecto
          estadoPago: 'PENDIENTE' // Valor por defecto
        })
        .select()
        .single();

      if (viajeError) {
        console.error('❌ Error creando registro de viaje:', viajeError);
        // No lanzamos error aquí para no interrumpir el flujo, pero lo registramos
      } else {
        console.log(`✅ Registro de viaje creado: ${nuevoViaje.id}`);
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
          viajeId: nuevoViaje?.id, // ID del viaje creado
          timestamp: new Date().toISOString(),
          tiempoDesbloqueo: desbloqueoExitoso.tiempo,
          estacionFin: estacionFin,
          usoSubscripcion: usoSubscripcion,
          suscripcion: suscripcionActualizada ? {
            id: suscripcionActualizada.id,
            viajes_disponibles: suscripcionActualizada.viajes_disponibles,
            viajes_utilizados: suscripcionActualizada.viajes_utilizados,
            estado: suscripcionActualizada.estado
          } : null
        }
      });

      console.log(`🚀 Viaje iniciado exitosamente para bicicleta: ${serialNumber} con destino a estación: ${estacionFin}`);

      return {
        success: true,
        bicicleta: bicicletaActualizada,
        viaje: nuevoViaje,
        tiempoDesbloqueo: desbloqueoExitoso.tiempo,
        estacionFin: estacionFin,
        usoSubscripcion: usoSubscripcion,
        suscripcion: suscripcionActualizada,
        mensaje: usoSubscripcion
          ? `Viaje iniciado usando suscripción. Te quedan ${suscripcionActualizada.viajes_disponibles} viajes disponibles.`
          : 'Viaje iniciado exitosamente (se cobrará al finalizar el viaje)'
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


  // === MÉTODOS PARA VERIFICAR VIAJES ACTIVOS ===

  async verificarViajesActivos(usuarioId) {
    try {
      console.log(`🔍 Verificando viajes activos para usuario: ${usuarioId}`);

      const { data: estadoViaje, error } = await supabase
        .rpc('puede_hacer_reservas', { usuario_id: usuarioId });

      if (error) {
        console.error('❌ Error verificando viajes activos:', error);
        throw new Error('Error al verificar el estado de viajes');
      }

      console.log(`📊 Estado de viajes activos:`, estadoViaje);

      return estadoViaje;

    } catch (error) {
      console.error('❌ Error en verificarViajesActivos:', error);
      throw error;
    }
  }

  async tieneViajeActivo(usuarioId) {
    try {
      const { data: tieneViaje, error } = await supabase
        .rpc('tiene_viaje_activo', { usuario_id: usuarioId });

      if (error) {
        console.error('❌ Error verificando viaje activo:', error);
        return false; // Por seguridad, asumimos que no tiene viaje activo
      }

      return tieneViaje;

    } catch (error) {
      console.error('❌ Error en tieneViajeActivo:', error);
      return false;
    }
  }

  async obtenerViajeActivo(usuarioId) {
    try {
      const { data: viajeActivo, error } = await supabase
        .rpc('obtener_viaje_activo', { usuario_id: usuarioId });

      if (error) {
        console.error('❌ Error obteniendo viaje activo:', error);
        return null;
      }

      return viajeActivo;

    } catch (error) {
      console.error('❌ Error en obtenerViajeActivo:', error);
      return null;
    }
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

  // === MÉTODOS PARA HISTORIAL DE VIAJES ===

  async obtenerHistorialViajesCompleto(usuarioId) {
    try {
      console.log(`📊 Obteniendo historial completo de viajes para usuario: ${usuarioId}`);

      // Consulta para obtener todos los viajes del usuario con información relacionada
      const { data: viajes, error } = await supabase
        .from('Viaje')
        .select(`
    id,
    idReserva,
    fechacomienzo,
    fechafin,
    tiempoViaje,
    precioSubtotal,
    tipo_viaje,
    estacionFin,
    estacionInicio,
    distanciaRecorrida,
    estadoPago,
    estado_viaje,
    tiempoExtra,
    impuesto,
    precioTotal,
    Reserva:Viaje_idReserva_fkey!inner(
      id,
      bicicleta_id,
      numero_serie,
      Bicicleta(
        id,
        marca,
        tipo,
        numero_serie,
        idEstacion,
        Estacion(
          id,
          nombre,
          posicion
        )
      )
    )
  `)
        .eq('Reserva.usuario_id', usuarioId)
        .order('fechacomienzo', { ascending: false });
      if (error) {
        console.error('❌ Error obteniendo historial de viajes:', error);
        throw new Error(`Error al obtener el historial de viajes: ${error.message}`);
      }

      // Formatear los datos para la respuesta
      const historialFormateado = viajes.map(viaje => ({
        id: viaje.id,
        reserva: {
          id: viaje.idReserva,
          bicicleta_id: viaje.Reserva.bicicleta_id,
          numero_serie: viaje.Reserva.numero_serie
        },
        bicicleta: {
          id: viaje.Reserva.Bicicleta?.id,
          marca: viaje.Reserva.Bicicleta?.marca || 'N/A',
          tipo: viaje.Reserva.Bicicleta?.tipo || 'N/A',
          numero_serie: viaje.Reserva.Bicicleta?.numero_serie || 'N/A',
          estacion_inicio: {
            id: viaje.Reserva.Bicicleta?.idEstacion,
            nombre: viaje.Reserva.Bicicleta?.Estacion?.nombre || 'N/A',
            posicion: viaje.Reserva.Bicicleta?.Estacion?.posicion || null
          }
        },
        fechas: {
          inicio: viaje.fechacomienzo,
          fin: viaje.fechafin
        },
        duracion: viaje.tiempoViaje,
        distancia: viaje.distanciaRecorrida,
        precio: viaje.precioTotal,
        precioTiempoExtra: viaje.tiempoExtra,
        subtotal: viaje.precioSubtotal,
        impuesto: viaje.impuesto,
        tipo_viaje: viaje.tipo_viaje,
        estado_viaje: viaje.estado_viaje,
        estado_pago: viaje.estadoPago,
        estaciones: {
          inicio: viaje.estacionInicio,
          fin: viaje.estacionFin
        }
      }));

      console.log(`✅ Historial de viajes obtenido: ${historialFormateado.length} viajes encontrados`);

      return historialFormateado;

    } catch (error) {
      console.error('❌ Error en obtenerHistorialViajesCompleto:', error);
      throw error;
    }
  }

  async obtenerViajeActivoCompleto(usuarioId) {
    try {
      console.log(`🔍 Buscando viaje activo completo para usuario: ${usuarioId}`);

      const { data: viajeActivo, error } = await supabase
        .from('Viaje')
        .select(`
        id,
        idReserva,
        fechacomienzo,
        tiempoViaje,
        precioSubtotal,
        tipo_viaje,
        estacionInicio,
        distanciaRecorrida,
        estadoPago,
        estado_viaje,
        Reserva!inner(
          id,
          bicicleta_id,
          numero_serie,
          Bicicleta(
            id,
            marca,
            tipo,
            numero_serie,
            idEstacion,
            Estacion(
              id,
              nombre,
              posicion
            )
          )
        )
      `)
        .eq('Reserva.usuario_id', usuarioId)
        .eq('estado_viaje', 'iniciado')
        .order('fechacomienzo', { ascending: false })
        .limit(1)
        .single();

      if (error?.code === 'PGRST116') {
        console.log('ℹ️ No se encontró viaje activo para el usuario');
        return null;
      }

      if (error) {
        console.error('❌ Error obteniendo viaje activo:', error);
        throw new Error(`Error al obtener el viaje activo: ${error.message}`);
      }

      const viajeFormateado = {
        id: viajeActivo.id,
        reserva: {
          id: viajeActivo.idReserva,
          bicicleta_id: viajeActivo.Reserva.bicicleta_id,
          numero_serie: viajeActivo.Reserva.numero_serie
        },
        bicicleta: {
          id: viajeActivo.Reserva.Bicicleta?.id,
          marca: viajeActivo.Reserva.Bicicleta?.marca || 'N/A',
          tipo: viajeActivo.Reserva.Bicicleta?.tipo || 'N/A',
          numero_serie: viajeActivo.Reserva.Bicicleta?.numero_serie || 'N/A',
          estacion_inicio: {
            id: viajeActivo.Reserva.Bicicleta?.idEstacion,
            nombre: viajeActivo.Reserva.Bicicleta?.Estacion?.nombre || 'N/A',
            posicion: viajeActivo.Reserva.Bicicleta?.Estacion?.posicion || null
          }
        },
        fecha_inicio: viajeActivo.fechacomienzo,
        duracion_actual: this.calcularDuracionDesdeInicio(viajeActivo.fechacomienzo),
        tipo_viaje: viajeActivo.tipo_viaje,
        estado_viaje: viajeActivo.estado_viaje,
        estado_pago: viajeActivo.estadoPago,
        estacion_inicio: viajeActivo.estacionInicio,
        distancia_recorrida: viajeActivo.distanciaReco,
        precio_subtotal: viajeActivo.precioSubtotal
      };

      console.log(`✅ Viaje activo encontrado: ${viajeFormateado.id}`);
      return viajeFormateado;

    } catch (error) {
      console.error('❌ Error en obtenerViajeActivoCompleto:', error);
      return null;
    }
  }


  // Método auxiliar para calcular duración desde el inicio
  calcularDuracionDesdeInicio(fechaInicio) {
    if (!fechaInicio) return null;

    const inicio = new Date(fechaInicio);
    const ahora = new Date();
    const duracionMs = ahora.getTime() - inicio.getTime();

    const minutos = Math.floor(duracionMs / (1000 * 60));
    const horas = Math.floor(minutos / 60);

    if (horas > 0) {
      return `${horas}h ${minutos % 60}m`;
    }
    return `${minutos}m`;
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
      timestamp_programada,
      timestamp_activacion,
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