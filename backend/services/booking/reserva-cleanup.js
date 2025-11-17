import { bookingHandler } from './booking-handler.js';

export class ReservaCleanupService {
  constructor() {
    this.interval = null;
  }

  start() {
    console.log('🕐 Iniciando servicio de limpieza de reservas expiradas...');
    
    // Ejecutar cada minuto
    this.interval = setInterval(() => {
      bookingHandler.liberarReservasExpiradas();
    }, 60 * 1000);

    // Ejecutar inmediatamente al iniciar
    bookingHandler.liberarReservasExpiradas();
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      console.log('⏹️ Servicio de limpieza de reservas detenido');
    }
  }
}

export const reservaCleanupService = new ReservaCleanupService();