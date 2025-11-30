import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";
import { consumedEvents } from "./events-consumed.js";

export const initializeStationService = () => {
  console.log("🚀 Inicializando servicio de estaciones...");
  
  // Suscribirse a eventos del canal ESTACIONES
  eventBus.subscribe(CHANNELS.ESTACIONES, async (event) => {
    console.log(`📥 [ESTACIONES] Evento recibido:`, event.type);
    
    const handler = consumedEvents[event.type];
    if (handler) {
      try {
        await handler(event);
        console.log(`✅ [ESTACIONES] Evento ${event.type} procesado exitosamente`);
      } catch (error) {
        console.error(`❌ [ESTACIONES] Error procesando evento ${event.type}:`, error);
      }
    } else {
      console.log(`⚠️ [ESTACIONES] No hay handler para evento: ${event.type}`);
    }
  });
  
  console.log("✅ Servicio de estaciones inicializado correctamente");
};