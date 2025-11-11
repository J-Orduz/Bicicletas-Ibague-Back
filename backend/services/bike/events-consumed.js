import { bikeHandler, BikeStatus } from "./bike-handler";

export const consumedEvents = {
	viaje_iniciado: async event =>  {
		const { bikeId } = event.data;
		await bikeHandler.changeStatus(bikeId, BikeStatus.en_uso);
	},
	viaje_finalizado: async event => {
		const { bikeId, dockId } = event.data;
		await bikeHandler.linkBike(bikeId, dockId);
	},
	mantenimiento_solicitado: async event => {
		const { bikeId } = event.data;
		await bikeHandler.changeStatus(bikeId, BikeStatus.mantenimiento_solicitado);
	},
};