export const producedEvents = {
    // Eventos relacionados directamente con el estado de las bicicletas
    estacion_obtenida: {
        type: "estacion_obtenida",
        data: {
            id: data.id,
            nombre: data.nombre,
            posicion: {
                latitud: data.posicion.latitud,
                longitud: data.posicion.longitud
            },
            capacidad: data.capacidad,
            tipoEstacion: data.tipoEstacion
        }
    }
};