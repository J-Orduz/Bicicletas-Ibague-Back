import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";
class StationHandler {
    constructor() { }

    // === CONSULTAS BÁSICAS === //
    async getStation(stationId) {
        const { data, error } = await supabase
            .from("Estacion")
            .select('id', stationId)
            .single

        if (error) {
            throw new Error(`Error obteniendo estación: ${error.message}`);
        }
        return data;
    }

    async getAllStations() {
        const { data, error } = await supabase
            .from("Estacion")
            .select("*")

        if (error) {
            throw new Error(`Error obteniendo estación: ${error.message}`);
        }
        return data;
    }


    //Adición de nueva estación
    async addStation(stationData) {
       
        
        const { data, error } = await supabase
            .from("Estacion")
            .insert([stationData])
            .select()
            .single();
        if (error) {
            throw new Error(`Error añadiendo estación: ${error.message}`);
        }

        await eventBus.publish(CHANNELS.ESTACIONES, {
            type: "estacion_añadida",
            data: {
                nombre: data.nombre,
                posicion: {
                    latitud: data.posicion.latitud,
                    longitud: data.posicion.longitud
                },
                capacidad: data.capacidad
            }
        });

        console.log(`Estación añadida: ${data.nombre}`);
        return data;
    }
}

export const stationHandler = new StationHandler();