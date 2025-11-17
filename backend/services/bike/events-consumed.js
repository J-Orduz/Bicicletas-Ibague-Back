import { bikeHandler, BikeStatus, ReservaStatus } from "./bike-handler.js";

export const consumedEvents = {
	viaje_iniciado: async event =>  {
		const { bikeId } = event.data;
		await bikeHandler.changeStatus(bikeId, BikeStatus.EN_USO);
	},
	viaje_finalizado: async event => {
		const { bikeId, dockId } = event.data;
		await bikeHandler.linkBike(bikeId, dockId);
	},
	mantenimiento_solicitado: async event => {
		const { bikeId } = event.data;
		await bikeHandler.changeStatus(bikeId, BikeStatus.mantenimiento_solicitado);
	},
	reserva_completada: async event => {
		const { bikeId, usuarioId } = event.data;
		await bikeHandler.completarReserva(bikeId, usuarioId);
	},
	reserva_expirada: async event => {
		const { bikeId } = event.data;
		await bikeHandler.changeStatus(bikeId, BikeStatus.DISPONIBLE);
	}
};