// backend/services/bike/index.js
import { consumedEvents } from "./events-consumed.js";
import { producedEvents } from "./events-produced.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";

// se espera que sea llamada durante la instanciación del servidor.
export function initBikeService() {
  console.log("[servicio-bicicletas] Inicializando servicio de bicicletas...");

  eventBus.subscribe(CHANNELS.BICICLETAS, async (event) => {
    const handler = consumedEvents[event.type];
    if (handler) {
      try {
        console.log(`[servicio-bicicletas] Manejando evento: ${event.type}`);
        await handler(event);
      } catch (err) {
        console.error(`[servicio-bicicletas] Error manejando evento ${event.type}`, err);
      }
    } else {
      // optionally ignore or log
      console.log(`[servicio-bicicletas] No se especificó un manejo para: ${event.type}`);
    }
  });

  console.log("[servicio-bicicletas] Suscrito al canal", CHANNELS.BICICLETAS);
  console.log("[servicio-bicicletas] Produce los eventos:", Object.keys(producedEvents));
}