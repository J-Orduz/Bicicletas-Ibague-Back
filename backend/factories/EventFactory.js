class EventFactory {
  // Crea un evento de reserva
  static createReservaEvent(eventType, eventData) {
    return {
      type: eventType,
      data: {
        bikeId: eventData.bikeId || null,
        usuarioId: eventData.usuarioId || null,
        numero_serie: eventData.numero_serie || null,
        reservaId: eventData.reservaId || null,
        timestamp: eventData.timestamp || new Date().toISOString(),
        ...eventData // Permite campos adicionales específicos del evento
      }
    };
  }

  //Crea un evento de bicicleta
  static createBicicletaEvent(eventType, eventData) {
    return {
      type: eventType,
      data: {
        bikeId: eventData.bikeId || eventData.id || null,
        status: eventData.status || null,
        numero_serie: eventData.numero_serie || null,
        timestamp: eventData.timestamp || new Date().toISOString(),
        ...eventData // Permite campos adicionales específicos del evento
      }
    };
  }

  //Crea un evento de viaje
  static createViajeEvent(eventType, eventData) {
    return {
      type: eventType,
      data: {
        bikeId: eventData.bikeId || null,
        usuarioId: eventData.usuarioId || null,
        reservaId: eventData.reservaId || null,
        viajeId: eventData.viajeId || null,
        timestamp: eventData.timestamp || new Date().toISOString(),
        ...eventData // Permite campos adicionales específicos del evento
      }
    };
  }

  // Crea un evento de usuario
  static createUsuarioEvent(eventType, eventData) {
    return {
      type: eventType,
      data: {
        id: eventData.id || null,
        email: eventData.email || null,
        nombre: eventData.nombre || null,
        timestamp: eventData.timestamp || new Date().toISOString(),
        ...eventData // Permite campos adicionales específicos del evento
      }
    };
  }

  // Crea un evento de pago
  static createPagoEvent(eventType, eventData) {
    return {
      type: eventType,
      data: {
        viajeId: eventData.viajeId || null,
        reservaId: eventData.reservaId || null,
        usuarioId: eventData.usuarioId || null,
        monto: eventData.monto || eventData.totalPagar || null,
        timestamp: eventData.timestamp || new Date().toISOString(),
        ...eventData // Permite campos adicionales específicos del evento
      }
    };
  }

  // Crea un evento de estación
  static createEstacionEvent(eventType, eventData) {
    return {
      type: eventType,
      data: {
        estacionId: eventData.estacionId || eventData.id || null,
        timestamp: eventData.timestamp || new Date().toISOString(),
        ...eventData // Permite campos adicionales específicos del evento
      }
    };
  }

  // Crea un evento genérico (método de respaldo)
  static createEvent(eventType, eventData) {
    return {
      type: eventType,
      data: {
        ...eventData,
        timestamp: eventData.timestamp || new Date().toISOString()
      }
    };
  }
}

export default EventFactory;

