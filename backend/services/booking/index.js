import { consumedEvents } from "./events-consumed.js";
import { producedEvents } from "./events-produced.js";
import { eventBus } from "../../event-bus/index.js";
import { CHANNELS } from "../../event-bus/channels.js";
import { reservaCleanupService } from "./reserva-cleanup.js";

export function initBookingService() {
  console.log("[servicio-booking] Inicializando servicio de reservas y viajes...");

  // Suscribirse a eventos
  eventBus.subscribe(CHANNELS.BICICLETAS, async (event) => {
    const handler = consumedEvents[event.type];
    if (handler) {
      try {
        console.log(`[servicio-booking] Manejando evento: ${event.type}`);
        await handler(event);
      } catch (err) {
        console.error(`[servicio-booking] Error manejando evento ${event.type}`, err);
      }
    }
  });

  eventBus.subscribe(CHANNELS.RESERVAS, async (event) => {
    const handler = consumedEvents[event.type];
    if (handler) {
      try {
        console.log(`[servicio-booking] Manejando evento del canal RESERVAS: ${event.type}`);
        await handler(event);
      } catch (err) {
        console.error(`[servicio-booking] Error manejando evento ${event.type}`, err);
      }
    }
  });

  // Iniciar servicio de limpieza de reservas
  reservaCleanupService.start();

  console.log("[servicio-booking] Suscrito a los canales:", [CHANNELS.BICICLETAS, CHANNELS.RESERVAS]);
  console.log("[servicio-booking] Produce los eventos:", Object.keys(producedEvents));
  console.log("[servicio-booking] Servicio de limpieza de reservas iniciado");
}