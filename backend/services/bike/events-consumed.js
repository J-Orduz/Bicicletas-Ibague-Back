import { bikeHandler, BikeStatus } from "./bike-handler.js";

export const consumedEvents = {
  // Eventos de Booking que afectan el estado de bicicletas
  viaje_iniciado: async (event) => {
    const { bikeId } = event.data;
    await bikeHandler.changeStatus(bikeId, BikeStatus.EN_USO);
  },
  
  viaje_finalizado: async (event) => {
    const { bikeId, dockId } = event.data;
    await bikeHandler.linkBike(bikeId, dockId);
  },
  
  bicicleta_reservada: async (event) => {
    const { bikeId } = event.data;
    await bikeHandler.changeStatus(bikeId, BikeStatus.RESERVADA);
  },
  
  reserva_cancelada: async (event) => {
    const { bikeId } = event.data;
    await bikeHandler.changeStatus(bikeId, BikeStatus.DISPONIBLE);
  },
  
  reserva_expirada: async (event) => {
    const { bikeId } = event.data;
    await bikeHandler.changeStatus(bikeId, BikeStatus.DISPONIBLE);
  },
  
  mantenimiento_solicitado: async (event) => {
    const { bikeId } = event.data;
    await bikeHandler.changeStatus(bikeId, BikeStatus.MANTENIMIENTO);
  },
  
  bicicleta_reportada: async (event) => {
    const { bikeId } = event.data;
    await bikeHandler.changeStatus(bikeId, BikeStatus.BLOQUEADA);
  }
};