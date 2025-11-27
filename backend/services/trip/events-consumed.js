import { tripHandler, ESTADO_PAGO } from "./trip-handler.js";

export const consumedEvents = {
    // Eventos que el servicio de trip consume de otros servicios
    finalizar_viaje: async (event) => {
        //finaliza viaje
        const { idTrip } = event.data;
        await tripHandler.finalizarViaje(idTrip);
    },

    viaje_iniciado: async (event) => {
        //inicia viaje
        const { viajeId, suscripcion, estacionFin } = event.data

        await tripHandler.verificarViaje(viajeId, suscripcion, estacionFin);

    },
    /*pago_fallido: async (event) => {
        //inicia viaje
        const { viajeId } = event.data
        await tripHandler.changeStatus(viajeId, ESTADO_PAGO.FALLIDO);

    },
    pago_pagado: async (event) => {
        //inicia viaje
        const { viajeId } = event.data
        await tripHandler.changeStatus(viajeId, ESTADO_PAGO.PAGADO);

    }*/





};