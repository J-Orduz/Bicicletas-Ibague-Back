import { consumedEvents } from "./events-consumed.js";
import { producedEvents } from "./events-produced.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

export function initBikeService() {
  console.log("[servicio-bicicletas] Inicializando servicio de bicicletas...");

  // Suscribirse a eventos de booking que afectan bicicletas
  eventBus.subscribe(CHANNELS.BOOKING, async (event) => {
    const handler = consumedEvents[event.type];
    if (handler) {
      try {
        console.log(`[servicio-bicicletas] Manejando evento de booking: ${event.type}`);
        await handler(event);
      } catch (err) {
        console.error(`[servicio-bicicletas] Error manejando evento ${event.type}`, err);
      }
    }
  });

  // Suscribirse a eventos de mantenimiento
  eventBus.subscribe(CHANNELS.MANTENIMIENTO, async (event) => {
    const handler = consumedEvents[event.type];
    if (handler) {
      try {
        console.log(`[servicio-bicicletas] Manejando evento de mantenimiento: ${event.type}`);
        await handler(event);
      } catch (err) {
        console.error(`[servicio-bicicletas] Error manejando evento ${event.type}`, err);
      }
    }
  });

  console.log("[servicio-bicicletas] Suscrito a los canales:", [CHANNELS.BOOKING, CHANNELS.MANTENIMIENTO]);
  console.log("[servicio-bicicletas] Produce los eventos:", Object.keys(producedEvents));
}