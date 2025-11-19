import { consumedEvents } from "./events-consumed.js";
import { producedEvents } from "./events-produced.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

export function initStationService() {
  console.log("[servicio-estación] Inicializando servicio de Estaciones...");

  // Suscribirse a eventos de booking que afectan bicicletas
  eventBus.subscribe(CHANNELS.ESTACIONES, async (event) => {
    const handler = consumedEvents[event.type];
    if (handler) {
      try {
        console.log(`[servicio-estación] Manejando evento de: ${event.type}`);
        await handler(event);
      } catch (err) {
        console.error(`[servicio-estación] Error manejando evento ${event.type}`, err);
      }
    }
  });



  console.log("[servicio-estación] Suscrito a los canales:", [CHANNELS.ESTACIONES]);
  console.log("[servicio-estación] Produce los eventos:", Object.keys(producedEvents));
}