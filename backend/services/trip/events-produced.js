export const producedEvents = {
  // Eventos de Viaje
  viaje_finalizado: {
    type: "viaje_finalizado",
    data: {
      viajeId: 0,
      reservaId: 0,
      totalPagar: 0,
      estadoPago: "",
      minutosUso: 0,
      distanciaKm: 0
    }

  },
  buscar_reserva: {
    type: "buscar_reserva",
    data: {
      estacionDestino: "",
      reservaId: "",
    }

  }


};