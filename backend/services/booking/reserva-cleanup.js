import { bookingHandler } from './booking-handler.js';

/**
 * ReservaCleanupService Singleton
 * Garantiza una única instancia del servicio de limpieza de reservas
 * Patrón Singleton aplicado
 */
export class ReservaCleanupService {
  // Variable estática para almacenar la instancia única
  static instance = null;

  constructor() {
    // Si ya existe una instancia, retornarla en lugar de crear una nueva
    if (ReservaCleanupService.instance) {
      console.log('⚠️ ReservaCleanupService ya existe, retornando instancia existente (Singleton)');
      return ReservaCleanupService.instance;
    }

    this.interval = null;

    // Guardar la instancia
    ReservaCleanupService.instance = this;
    console.log('✅ ReservaCleanupService instanciado (Singleton)');
  }

  /**
   * Método estático para obtener la instancia única (patrón Singleton)
   * @returns {ReservaCleanupService} La instancia única del ReservaCleanupService
   */
  static getInstance() {
    if (!ReservaCleanupService.instance) {
      ReservaCleanupService.instance = new ReservaCleanupService();
    }
    return ReservaCleanupService.instance;
  }

  /**
   * Método para resetear la instancia (útil para testing)
   */
  static resetInstance() {
    if (ReservaCleanupService.instance && ReservaCleanupService.instance.interval) {
      clearInterval(ReservaCleanupService.instance.interval);
    }
    ReservaCleanupService.instance = null;
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

// Exportar la instancia única del ReservaCleanupService (Singleton)
// Se crea automáticamente al importar este módulo
export const reservaCleanupService = ReservaCleanupService.getInstance();