import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";
import { BikeStatus } from "./state.js"

const bikeTable = "Bicicleta";
const dockTable = "Docks";

class BikeHandler {
  constructor() { }

  // === CONSULTAS BÁSICAS ===
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
      throw new Error(`Error obteniendo bicicleta: ${error.message}`);
    }
    return data;
  }

  async getBicicletasPorEstacion(idEstacion) {
    const { data, error } = await supabase
      .from(bikeTable)
      .select("*")
      .eq("idEstacion", idEstacion);

    if (error) throw error;
    return data;
  }

  async getAllBicicletas() {
    const { data, error } = await supabase
      .from(bikeTable)
      .select("*");

    if (error) throw error;
    return data;
  }

  // === GESTIÓN DE ESTADOS ===
  async changeStatus(bikeId, status) {
    console.log(`[bike-handler] Cambiando estado de bicicleta ${bikeId} a ${status}`);

    const { data, error } = await supabase
      .from(bikeTable)
      .update({ estado: status })
      .eq("id", bikeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error actualizando estado: ${error.message}`);
    }

    // Publicar evento de estado actualizado
    await eventBus.publish(CHANNELS.BICICLETAS, {
      type: "estado_actualizado",
      data: {
        bikeId: data.id,
        status: data.estado,
        numero_serie: data.numero_serie,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Estado actualizado: ${data.numero_serie} -> ${status}`);
    return data;
  }

  // === GESTIÓN DE POSICIONES ===
  async updatePosition(bikeId, newPos) {
    const { data, error } = await supabase
      .from(bikeTable)
      .update({ newPos })
      .eq("id", bikeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error actualizando posición: ${error.message}`);
    }

    await eventBus.publish(CHANNELS.BICICLETAS, {
      type: "posicion_actualizada",
      data: {
        bikeId: bikeId,
        newPos: newPos,
        timestamp: new Date().toISOString()
      }
    });

    return data;
  }

  // === ENLACE A DOCKS ===
  async linkBike(bikeId, dockId) {
    console.log(`[bike-handler] Enlazando bicicleta ${bikeId} al dock ${dockId}`);

    const { data, error } = await supabase
      .from(bikeTable)
      .update({
        idEstacion: dockId,
        estado: BikeStatus.DISPONIBLE
      })
      .eq("id", bikeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error enlazando bicicleta: ${error.message}`);
    }

    await eventBus.publish(CHANNELS.BICICLETAS, {
      type: "bicicleta_enlazada",
      data: {
        bikeId: bikeId,
        dockId: dockId,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Bicicleta ${bikeId} enlazada al dock ${dockId}`);
    return data;
  }

  // === REGISTRO DE BICICLETAS ===
  async registerBike(bikeData) {
    const { data, error } = await supabase
      .from(bikeTable)
      .insert([bikeData])
      .select()
      .single();

    if (error) {
      throw new Error(`Error registrando bicicleta: ${error.message}`);
    }

    await eventBus.publish(CHANNELS.BICICLETAS, {
      type: "bicicleta_registrada",
      data: {
        id: data.id,
        numero_serie: data.numero_serie,
        marca: data.marca,
        tipo: data.tipo,
        timestamp: new Date().toISOString()
      }
    });

    console.log(`✅ Bicicleta registrada: ${data.numero_serie}`);
    return data;
  }

  // === REPORTES Y MANTENIMIENTO ===
  async reportarAbandonada(bikeId, ubicacion) {
    console.log(`[bike-handler] Reportando bicicleta ${bikeId} como abandonada`);

    const { data, error } = await supabase
      .from(bikeTable)
      .update({ estado: BikeStatus.ABANDONADA })
      .eq("id", bikeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error reportando bicicleta: ${error.message}`);
    }

    await eventBus.publish(CHANNELS.BICICLETAS, {
      type: "reportada_abandonada",
      data: {
        bikeId: bikeId,
        ubicacion: ubicacion,
        timestamp: new Date().toISOString()
      }
    });

    return data;
  }

  async descargarBicicleta(bikeId, motivo) {
    console.log(`[bike-handler] Descargando bicicleta ${bikeId}: ${motivo}`);

    const { data, error } = await supabase
      .from(bikeTable)
      .update({ estado: BikeStatus.MANTENIMIENTO })
      .eq("id", bikeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error descargando bicicleta: ${error.message}`);
    }

    await eventBus.publish(CHANNELS.BICICLETAS, {
      type: "bicicleta_descargada",
      data: {
        bikeId: bikeId,
        motivo: motivo,
        timestamp: new Date().toISOString()
      }
    });

    return data;
  }
  async getEstacionDeBicicleta(data) {
    const { reservaId, id } = data;
    const { estacion, error } = await supabase
      .from(bikeTable)
      .select("idEstacion")
      .eq("id", id);

    if (error) throw error;

    await eventBus.publish(CHANNELS.ESTACIONES, {
      type: "consulta_estacion",
      data: {
        idReserva: reservaId,
        idEstacion: estacion.idEstacion
      }
    });

    return data;
  }
}

export const bikeHandler = new BikeHandler();