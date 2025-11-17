// services/booking/events-produced.js
export const producedEvents = {
  // Eventos de Reserva
  bicicleta_reservada: {
    type: "bicicleta_reservada",
    data: { 
      bikeId: "", 
      usuarioId: "", 
      numero_serie: "", 
      reservaId: "",
      timestamp: "", 
      expiracion: "",
      tiempo_reserva: 0 
    }
  },
  reserva_cancelada: {
    type: "reserva_cancelada",
    data: { 
      bikeId: "", 
      usuarioId: "", 
      numero_serie: "", 
      reservaId: "",
      timestamp: "",
      motivo: "" 
    }
  },
  reserva_expirada: {
    type: "reserva_expirada",
    data: { 
      bikeId: "", 
      usuarioId: "", 
      numero_serie: "", 
      reservaId: "",
      timestamp: "", 
      expiracion_original: "" 
    }
  },
  reserva_completada: {
    type: "reserva_completada", 
    data: {
      bikeId: "",
      usuarioId: "",
      numero_serie: "",
      reservaId: "",
      timestamp: ""
    }
  },
  
  // Eventos de Viaje
  viaje_iniciado: {
    type: "viaje_iniciado",
    data: {
      bikeId: "",
      usuarioId: "",
      serialNumber: "",
      reservaId: "",
      timestamp: "",
      tiempoDesbloqueo: 0
    }
  },
  viaje_finalizado: {
    type: "viaje_finalizado",
    data: {
      bikeId: "",
      usuarioId: "",
      timestamp: "",
      duracion: 0,
      distancia: 0,
      costo: 0
    }
  }
};