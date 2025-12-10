import { consumedEvents } from "./events-consumed.js";
import { producedEvents } from "./events-produced.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

export function initTripService() {
  console.log("[servicio-trip] Inicializando servicio de viajes...");

  // Suscribirse a eventos del canal VIAJES
  eventBus.subscribe(CHANNELS.VIAJES, async (event) => {
    const handler = consumedEvents[event.type];
    if (handler) {
      try {
        console.log(`[servicio-trip] Manejando evento: ${event.type}`);
        await handler(event);
      } catch (err) {
        console.error(`[servicio-trip] Error manejando evento ${event.type}:`, err);
      }
    } else {
      console.log(`[servicio-trip] No hay handler para el evento: ${event.type}`);
    }
  });

  console.log("[servicio-trip] ✅ Suscrito al canal:", CHANNELS.VIAJES);
  console.log("[servicio-trip] 📤 Produce los eventos:", Object.keys(producedEvents));
  console.log("[servicio-trip] 📥 Consume los eventos:", Object.keys(consumedEvents));
}
