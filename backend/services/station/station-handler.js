import { supabase } from "../../shared/supabase/client.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

const stationTable = "estaciones";

class StationHandler {
    constructor() { }

    async getAllStations() {
        const { data, error } = await supabase
            .from(stationTable)
            .select("*");
        if (error) {
            console.error(`Error obteniendo estaciones: ${error.message}`);
            throw error;
        }
        return data;
    }
    async getStationById(reserva) {

        const idReserva = reserva?.idReserva;
        const estacionId = reserva?.idEstacion;

        if (!estacionId) {
            throw new Error("No se recibió idEstacion");
        }

        const { data: estacion, error } = await supabase
            .from(stationTable)
            .select("*")
            .eq("id", estacionId)
            .single();

        if (error || !estacion) {
            console.error(`❌ Error obteniendo estación con ID ${estacionId}:`, error);
            throw new Error("No se pudo obtener la estación");
        }

        if (idReserva) {
            await eventBus.publish(CHANNELS.VIAJES, {
                type: "estacion_obtenida",
                data: {
                    id: estacion.id,
                    idReserva: idReserva,
                    nombre: estacion.nombre,
                    posicion: {
                        latitud: estacion.posicion.latitud,
                        longitud: estacion.posicion.longitud
                    },
                    tipoEstacion: estacion.tipoEstacion
                }
            });
        }

        return estacion;
    }

    async createStation(stationData) {
        const { data, error } = await supabase
            .from(stationTable)
            .insert([stationData])
            .single();
        if (error) {
            console.error(`Error creando estaciones: ${error.message}`);
            throw error;
        }

        return data;
    }
    /*
    async updateStation(stationId, stationData) {
        const { data, error } = await supabase
            .from(stationTable)
            .update(stationData)
            .eq("id", stationId)
            .single();
        if (error) {
            console.error(`Error modificando estación con ID ${stationId}: ${error.message}`);
            throw error;
        }
        eventBus.publish(CHANNELS.STATION.UPDATED, data);
        return data;
    }
*/



}
export const stationHandler = new StationHandler();