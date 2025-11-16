// Lógica de gestión de bicicletas y estaciones
import { supabase } from "../../shared/supabase/client.js"
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

const bikeChannel = CHANNELS.BICICLETAS;
const bikeTable = "Bicicleta";
const dockTable = "Docks";

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

        // 3. Actualizar estado a "Reservada"
        const bicicletaActualizada = await this.changeStatus(bikeId, BikeStatus.RESERVADA);

        // 4. Publicar evento de reserva
        await eventBus.publish(CHANNELS.RESERVAS, {
            type: "bicicleta_reservada",
            data: {
                bikeId: bicicleta.id,
                usuarioId: usuarioId,
                numero_serie: bicicleta.numero_serie,
                timestamp: new Date().toISOString(),
                tiempo_reserva: 10 // minutos de reserva
            }
        });

        console.log(`✅ Bicicleta reservada exitosamente: ${bicicleta.numero_serie} para usuario ${usuarioId}`);
        
        return {
            success: true,
            bicicleta: bicicletaActualizada,
            tiempo_reserva: 10,
            mensaje: 'Bicicleta reservada exitosamente. Tienes 10 minutos para retirarla.'
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

        // 3. Actualizar estado a "Disponible"
        const bicicletaActualizada = await this.changeStatus(bikeId, BikeStatus.DISPONIBLE);

        // 4. Publicar evento de cancelación de reserva
        await eventBus.publish(CHANNELS.RESERVAS, {
            type: "reserva_cancelada",
            data: {
                bikeId: bicicleta.id,
                usuarioId: usuarioId,
                numero_serie: bicicleta.numero_serie,
                timestamp: new Date().toISOString()
            }
        });

        console.log(`✅ Reserva cancelada exitosamente: ${bicicleta.numero_serie}`);
        
        return {
            success: true,
            bicicleta: bicicletaActualizada,
            mensaje: 'Reserva cancelada exitosamente'
        };

    } catch (error) {
        console.error('❌ Error cancelando reserva:', error.message);
        throw error;
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

      // 2. Verificar que esté disponible o reservada para este usuario
      if (bicicleta.estado !== BikeStatus.DISPONIBLE && 
          bicicleta.estado !== BikeStatus.RESERVADA) {
        throw new Error(`La bicicleta no está disponible. Estado actual: ${bicicleta.estado}`);
      }

      console.log(`✅ Bicicleta lista para viaje:`, {
        id: bicicleta.id,
        numero_serie: bicicleta.numero_serie,
        estado: bicicleta.estado
      });

      // 3. Simular desbloqueo del candado (≤ 1 segundo)
      const desbloqueoExitoso = await this.simularDesbloqueoCandado(bicicleta.id);

      if (!desbloqueoExitoso) {
        throw new Error('El candado no respondió en menos de 1 segundo');
      }

      // 4. Actualizar estado a "En_Viaje"
      console.log(`🔄 Actualizando estado con ID real: ${bicicleta.id}`);
      const bicicletaActualizada = await this.changeStatus(bicicleta.id, BikeStatus.EN_USO);

      // 5. Publicar evento de viaje iniciado
      await eventBus.publish(CHANNELS.VIAJES, {
        type: "viaje_iniciado",
        data: {
          bikeId: bicicleta.id,
          usuarioId: usuarioId,
          serialNumber: serialNumber,
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
