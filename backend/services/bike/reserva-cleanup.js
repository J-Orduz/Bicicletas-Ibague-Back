import { bikeHandler } from './bike-handler.js';

export class ReservaCleanupService {
    constructor() {
        this.interval = null;
    }

    start() {
        console.log('🕐 Iniciando servicio de limpieza de reservas expiradas...');
        
        // Ejecutar cada minuto
        this.interval = setInterval(() => {
            bikeHandler.liberarReservasExpiradas();
        }, 60 * 1000); // 1 minuto

        // Ejecutar inmediatamente al iniciar
        bikeHandler.liberarReservasExpiradas();
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            console.log('⏹️ Servicio de limpieza de reservas detenido');
        }
    }
}

export const reservaCleanupService = new ReservaCleanupService();