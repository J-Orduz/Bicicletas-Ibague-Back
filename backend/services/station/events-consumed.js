import { stationHandler } from "./station-handler.js";

export const consumedEvents = {
  // Eventos de Booking que afectan el estado de bicicletas
  consulta_estacion: async (event) => {
    await stationHandler.getStationById(event.data);
  }
  
};