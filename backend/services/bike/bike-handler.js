// Lógica de gestión de bicicletas y estaciones
import { supabase } from "../../shared/supabase/client.js"
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

const bikeChannel = CHANNELS.BICICLETAS;
const bikeTable = "Bicicleta";
const dockTable = "Docks";
const reservaTable = "Reserva";

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
  BLOQUEADA: 'Bloqueada',
  MANTENIMIENTO: 'Mantenimiento',
  RESERVADA: 'Reservada',
  ABANDONADA: 'Abandonada'
};

// TODO: implementar manejo para los eventos desbloqueada, enlazada,
// reportada_abandonada, bicicleta_descargada
class BikeHandler {
  constructor() {}

  async linkBike(bikeId, dockId) {}


  async getBikeBySerial(serialNumber) {
    const { data, error } = await supabase
      .from(bikeTable)
      .select("*")
      .eq("numero_serie", serialNumber)
      .single();
    
    if (error) {
      throw new Error(`Bicicleta no encontrada: ${error.message}`);
    }
    return data;
  }

  async getBike(bikeId) {
    const { data, error } = await supabase
      .from(bikeTable)
      .select("*")
      .eq("id", bikeId)
      .single();
    if (error) {
      throw new Error(`Supabase falló en obtener la bicicleta: ${error.message}`);
    }
    return data;
  }

  async getDock(dockId) {
    const { data, error } = await supabase
      .from(dockTable)
      .select("*")
      .eq("id", dockId)
      .single();
    if (error) {
      throw new Error(`Supabase falló en obtener el dock: ${error.message}`);
    }
    return data;
  }

  async registerBike(bike) {
    const { data, error } = await supabase
      .from(bikeTable).insert([bike]).select().single();
    if (error)
      throw new Error(`Supabase falló en registrar la bicicleta: ${error.message}`);
    await eventBus.publish(bikeChannel, {
      type: "bicicleta_registrada",
      data: data
    });
    return data;
  }

  async updatePosition(bikeId, newPos) {
    const { data, error } = await supabase
      .from(bikeTable)
      .update({ newPos })
      .eq("id", bikeId)
      .select()
      .single();
    if (error)
      throw new Error(`Supabase falló en actualizar la posición de la bicicleta: ${error.message}`);
    await eventBus.publish(bikeChannel, {
      type: "posicion_actualizada",
      data: { bikeId: bikeId, newPos: newPos }
    });
    return data;
  }

  async changeStatus(bikeId, status) {
    // Logging para diagnóstico
    console.log(`🔄 Intentando cambiar estado de bicicleta ${bikeId} (tipo: ${typeof bikeId}) a ${status}`);

    // Verificar que la bicicleta existe
    let bicicletaExistente;
    try {
      // 1. Primero verificar que la bicicleta existe
      bicicletaExistente = await this.getBike(bikeId);
      
      if (!bicicletaExistente) {
        throw new Error(`Bicicleta con ID ${bikeId} no existe`);
      }

      console.log(`✅ Bicicleta verificada:`, {
        id: bicicletaExistente.id,
        estado_actual: bicicletaExistente.estado,
        numero_serie: bicicletaExistente.numero_serie
      });
    } catch (error) {
      console.error(`❌ Error al verificar existencia de bicicleta ${bikeId}:`, error.message);
      throw new Error(`Supabase change status failed: bicicleta con id ${bikeId} no encontrada`);
    }

    // Actualizar sin .select().single() y luego obtener la bicicleta actualizada
    const { error: updateError } = await supabase
        .from(bikeTable)
        .update({ estado: status })
        .eq("id", bicicletaExistente.id);

    if (updateError) {
        console.error(`❌ Error en update de Supabase:`, updateError);
        throw new Error(`Error al actualizar estado: ${updateError.message}`);
    }

    // Obtener la bicicleta actualizada por separado
    const { data: bicicletaActualizada, error: selectError } = await supabase
        .from(bikeTable)
        .select("*")
        .eq("id", bicicletaExistente.id)
        .single();

    if (selectError) {
        console.error(`❌ Error al obtener bicicleta actualizada:`, selectError);
        throw new Error(`Error al obtener bicicleta actualizada: ${selectError.message}`);
    }

    if (!bicicletaActualizada) {
        throw new Error(`No se pudo obtener la bicicleta ${bikeId} después del update`);
    }

    // Publicar evento
    await eventBus.publish(bikeChannel, {
        type: "estado_actualizado",
        data: { 
          bikeId: bicicletaActualizada.id, 
          status: bicicletaActualizada.estado,
          numero_serie: bicicletaActualizada.numero_serie
        }
      });
    console.log(`✅ Estado actualizado exitosamente: ${bicicletaExistente.numero_serie} -> ${status}`);
    return bicicletaActualizada;
  }


// Reservar bicicleta
async reservarBicicleta(bikeId, usuarioId) {
    try {
        console.log(`📋 Solicitud de reserva - BikeID: ${bikeId}, Usuario: ${usuarioId}`);
        
        // 1. Verificar que la bicicleta existe
        const bicicleta = await this.getBike(bikeId);
        
        if (!bicicleta) {
            throw new Error('Bicicleta no encontrada');
        }

        // 2. Verificar que esté disponible
        if (bicicleta.estado !== BikeStatus.DISPONIBLE) {
            throw new Error(`La bicicleta no está disponible para reservar. Estado actual: ${bicicleta.estado}`);
        }

        console.log(`✅ Bicicleta disponible para reserva:`, {
            id: bicicleta.id,
            numero_serie: bicicleta.numero_serie,
            estado_actual: bicicleta.estado
        });

        // 3. Calcular timestamps de expiración (10 minutos)
        const ahora = new Date();
        const expiracion = new Date(ahora.getTime() + 10 * 60 * 1000); // 10 minutos

        // 4. Crear registro en tabla Reserva
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

        // 5. Actualizar estado de la bicicleta a "Reservada"
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
            // Revertir la creación de la reserva si falla el update
            await supabase.from(reservaTable).delete().eq('id', nuevaReserva.id);
            throw new Error(`Error al reservar bicicleta: ${updateError.message}`);
        }

        // 6. Publicar evento de reserva
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

        console.log(`✅ Bicicleta reservada exitosamente: ${bicicleta.numero_serie} para usuario ${usuarioId}`);
        console.log(`📝 Reserva ID: ${nuevaReserva.id}`);
        console.log(`⏰ La reserva expira a las: ${expiracion.toLocaleTimeString()}`);
        
        return {
            success: true,
            bicicleta: bicicletaActualizada,
            reserva: nuevaReserva,
            tiempo_reserva: 10,
            expiracion: expiracion.toISOString(),
            mensaje: 'Bicicleta reservada exitosamente. Tienes 15 minutos para retirarla.'
        };

    } catch (error) {
        console.error('❌ Error reservando bicicleta:', error.message);
        throw error;
    }
}


// Cancelar reserva
async cancelarReserva(bikeId, usuarioId) {
    try {
        console.log(`❌ Solicitud de cancelación de reserva - BikeID: ${bikeId}, Usuario: ${usuarioId}`);
        
        // 1. Verificar que la bicicleta existe
        const bicicleta = await this.getBike(bikeId);
        
        if (!bicicleta) {
            throw new Error('Bicicleta no encontrada');
        }

        // 2. Verificar que esté reservada
        if (bicicleta.estado !== BikeStatus.RESERVADA) {
            throw new Error(`La bicicleta no está reservada. Estado actual: ${bicicleta.estado}`);
        }

        if (bicicleta.reserva_usuario_id !== usuarioId) {
            throw new Error('No puedes cancelar una reserva que no te pertenece');
        }

        // 3. Buscar la reserva activa
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

        // 4. Actualizar reserva a "cancelada"
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

        // 5. Actualizar estado de la bicicleta a "Disponible"
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

        // 6. Publicar evento de cancelación de reserva
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


// Método para liberar reservas expiradas automáticamente
async liberarReservasExpiradas() {
    try {
        const ahora = new Date().toISOString();
        
        console.log(`🕐 Buscando reservas expiradas... (${ahora})`);

        // Buscar reservas activas que hayan expirado
        const { data: reservasExpiradas, error } = await supabase
            .from(reservaTable)
            .select('id, usuario_id, bicicleta_id, numero_serie, timestamp_expiracion')
            .eq('estado_reserva', ReservaStatus.ACTIVA)
            .lt('timestamp_expiracion', ahora);

        if (error) {
            console.error('❌ Error buscando reservas expiradas:', error);
            return;
        }

        if (reservasExpiradas.length === 0) {
            console.log('✅ No hay reservas expiradas');
            return;
        }

        console.log(`🔄 Liberando ${reservasExpiradas.length} reservas expiradas...`);

        for (const reserva of reservasExpiradas) {
            try {
                // Actualizar reserva a "expirada"
                const { error: updateReservaError } = await supabase
                    .from(reservaTable)
                    .update({
                        estado_reserva: ReservaStatus.EXPIRADA,
                        timestamp_finalizacion: new Date().toISOString(),
                        motivo_finalizacion: MotivoFinalizacion.EXPIRACION_TIEMPO
                    })
                    .eq('id', reserva.id);

                if (updateReservaError) {
                    console.error(`❌ Error actualizando reserva ${reserva.id}:`, updateReservaError);
                    continue;
                }

                // Actualizar bicicleta a "disponible"
                const { error: updateBiciError } = await supabase
                    .from(bikeTable)
                    .update({ 
                        estado: BikeStatus.DISPONIBLE,
                        reserva_usuario_id: null,
                        reserva_timestamp: null,
                        reserva_expiracion: null
                    })
                    .eq('id', reserva.bicicleta_id);

                if (updateBiciError) {
                    console.error(`❌ Error actualizando bicicleta ${reserva.bicicleta_id}:`, updateBiciError);
                    continue;
                }

                // Publicar evento
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

                console.log(`✅ Reserva expirada liberada: ${reserva.numero_serie} (ID: ${reserva.id})`);

            } catch (error) {
                console.error(`❌ Error procesando reserva expirada ${reserva.id}:`, error);
            }
        }

    } catch (error) {
        console.error('❌ Error en liberarReservasExpiradas:', error);
    }
}


// Completar reserva al iniciar viaje
  async completarReserva(bikeId, usuarioId) {
      try {
          console.log(`✅ Completando reserva - BikeID: ${bikeId}, Usuario: ${usuarioId}`);
          
          // Buscar reserva activa
          const { data: reservaActiva, error } = await supabase
              .from(reservaTable)
              .select('*')
              .eq('bicicleta_id', bikeId)
              .eq('usuario_id', usuarioId)
              .eq('estado_reserva', ReservaStatus.ACTIVA)
              .single();

          if (error || !reservaActiva) {
              console.log('⚠️ No se encontró reserva activa para completar');
              return null;
          }

          // Actualizar reserva a "completada"
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

          // Publicar evento de reserva completada
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

          console.log(`✅ Reserva completada: ${reservaActiva.numero_serie} (ID: ${reservaActiva.id})`);
          return reservaCompletada;

      } catch (error) {
          console.error('❌ Error en completarReserva:', error);
          return null;
      }
  }


// Iniciar viaje con número de serie
async iniciarViajeConSerial(serialNumber, bikeId, usuarioId) {
    try {
      console.log(`🎯 Solicitud de inicio de viaje - BikeID: ${bikeId}, Serial: ${serialNumber}, Usuario: ${usuarioId}`);
      
      // 1. Buscar bicicleta por número de serie
      const bicicleta = await this.getBikeBySerial(serialNumber);
      
      if (!bicicleta) {
        throw new Error('Bicicleta no encontrada');
      }

      // Verificar que el serial corresponde al bikeId
      if (bicicleta.id !== bikeId) {
        throw new Error(`El número de serie ${serialNumber} no corresponde a la bicicleta seleccionada`);
      }

      // Verificar que el usuario tiene reserva activa para esta bicicleta
        const tieneReservaActiva = await this.verificarReservaActivaUsuario(bikeId, usuarioId);
        if (!tieneReservaActiva) {
            throw new Error('No tienes una reserva activa para esta bicicleta. Debes reservarla primero.');
        }


      // 2. Verificar que esté disponible o reservada para este usuario
      if (bicicleta.estado !== BikeStatus.DISPONIBLE && 
          bicicleta.estado !== BikeStatus.RESERVADA) {
        throw new Error(`La bicicleta no está disponible. Estado actual: ${bicicleta.estado}`);
      }

      console.log(`✅ Bicicleta lista para viaje:`, {
        id: bicicleta.id,
        numero_serie: bicicleta.numero_serie,
        estado: bicicleta.estado,
        tiene_reserva_activa: true
      });

      // 3. Simular desbloqueo del candado (≤ 1 segundo)
      const desbloqueoExitoso = await this.simularDesbloqueoCandado(bicicleta.id);

      if (!desbloqueoExitoso) {
        throw new Error('El candado no respondió en menos de 1 segundo');
      }

      // 4. Actualizar estado a "En_Viaje"
      console.log(`🔄 Actualizando estado con ID real: ${bicicleta.id}`);
      const bicicletaActualizada = await this.changeStatus(bicicleta.id, BikeStatus.EN_USO);

      // 4.5. Completar la reserva (cambiar estado a "completada")
      const reservaCompletada = await this.completarReserva(bicicleta.id, usuarioId);

      // 5. Publicar evento de viaje iniciado
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

  // Método para verificar reserva activa del usuario
  async verificarReservaActivaUsuario(bikeId, usuarioId) {
      try {
          const { data: reservaActiva, error } = await supabase
              .from(reservaTable)
              .select('id, timestamp_expiracion')
              .eq('bicicleta_id', bikeId)
              .eq('usuario_id', usuarioId)
              .eq('estado_reserva', ReservaStatus.ACTIVA)
              .single();

          if (error) {
              if (error.code === 'PGRST116') { // No encontrado
                  console.log(`❌ Usuario ${usuarioId} no tiene reserva activa para bicicleta ${bikeId}`);
                  return false;
              }
              throw error;
          }

          // Verificar que la reserva no haya expirado
          const ahora = new Date();
          const expiracion = new Date(reservaActiva.timestamp_expiracion);
          
          if (ahora > expiracion) {
              console.log(`⚠️ Reserva ${reservaActiva.id} expirada para usuario ${usuarioId}`);
              return false;
          }

          console.log(`✅ Usuario ${usuarioId} tiene reserva activa para bicicleta ${bikeId}`);
          return true;

      } catch (error) {
          console.error('❌ Error verificando reserva activa:', error);
          return false;
      }
  }

  // Simular desbloqueo de candado (≤ 1 segundo)
  async simularDesbloqueoCandado(bikeId) {
    return new Promise((resolve, reject) => {
      const inicio = Date.now();
      
      // Simular comunicación con candado IoT
      setTimeout(() => {
        const tiempoTranscurrido = Date.now() - inicio;
        
        if (tiempoTranscurrido <= 1000) { // ≤ 1 segundo
          resolve({
            exito: true,
            tiempo: tiempoTranscurrido,
            mensaje: 'CANDADO_DESBLOQUEADO'
          });
        } else {
          resolve({
            exito: false,
            tiempo: tiempoTranscurrido,
            mensaje: 'TIMEOUT_CANDADO'
          });
        }
      }, Math.random() * 800 + 200); // Simular latencia entre 200-1000ms
    });
  }
};

export const bikeHandler = new BikeHandler();
