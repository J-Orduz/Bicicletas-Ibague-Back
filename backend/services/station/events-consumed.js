import { stationHandler } from "./station-handler.js";

export const consumedEvents = {
  // Eventos de Booking que afectan el estado de bicicletas
  consulta_estacion: async (event) => {
    await stationHandler.getStationById(event.data);
  },
  
  estacion_vacia: async (event) => {
    console.log(`🚨 Procesando estacion_vacia para estación: ${event.data.estacionId}`);
    console.log(`📋 Datos del evento:`, event.data);
    
    try {
        await stationHandler.manejarEstacionVacia(event.data.estacionId);
        console.log(`✅ estacion_vacia procesado exitosamente para estación ${event.data.estacionId}`);
    } catch (error) {
        console.error(`❌ Error crítico en estacion_vacia:`, error);
    }
  },

  redistribucion_completada: async (event) => {
    console.log(`✅ Redistribución completada para estación: ${event.data.estacionId}`);
    console.log(`📊 ${event.data.cantidad} bicicletas reasignadas:`, event.data.bicicletasReasignadas);
  }
};