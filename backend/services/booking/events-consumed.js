import { bookingHandler } from "./booking-handler.js";

export const consumedEvents = {
  // Eventos que el servicio de booking consume de otros servicios
  bicicleta_liberada: async (event) => {
    // Si una bicicleta se libera, podemos cancelar reservas asociadas
    const { bikeId } = event.data;
    await bookingHandler.liberarReservasBicicleta(bikeId);
  },

  usuario_suspendido: async (event) => {
    // Si un usuario es suspendido, cancelar sus reservas activas
    const { usuarioId } = event.data;
    await bookingHandler.cancelarReservasUsuario(usuarioId);
  },
  buscar_reserva: async (event) => {
    // Consulta si existe esa reserva y envía la ID de la bicicleta
    const { estacionDestino, reservaId } = event.data;

    await bookingHandler.getBicicletaViaje(estacionDestino, reservaId);
  }
};