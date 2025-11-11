// Lógica de gestión de bicicletas y estaciones
import { supabase } from "../../shared/supabase/client.js"
import { eventBus } from "../../event-bus/channels.js";
import { CHANNELS } from "../../event-bus/channels.js";
const bikeChannel = CHANNELS.BICICLETAS;
const bikeTable = "Bicicleta";
const dockTable = "Docks";

export const BikeStatus = [
  en_uso,
  disponible,
  abandonada,
  mantenimiento,
];

// TODO: implementar manejo para los eventos desbloqueada, enlazada,
// reportada_abandonada, bicicleta_descargada
class BikeHandler {
  constructor() {}

  async linkBike(bikeId, dockId) {}

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
    const { data, error } = await supabase
      .from(this.table)
      .update({ status }) // TODO: actualizar el formato de la fila
        // conforme al esquema de tablas una vez se establezca
      .eq("id", bikeId)
      .select()
      .single();

    if (error)
      throw new Error(`Supabase change status failed: ${error.message}`);
    await eventBus.publish(bikeChannel, {
      type: "estado_actualizado",
      data: { bikeId, status }
    });
    return data;
  }
};

export const bikeHandler = new BikeHandler();
