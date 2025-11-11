// Eventos que publica (BicicletaDesbloqueada, etc.)

export const producedEvents = {
  desbloqueada: {
    type: "desbloqueada",
    data: { bikeId: "", dockId: "" }
  },
  posicion_actualizada: {
    type: "posicion_actualizada",
    data: { bikeId: "", newPos: "" }
  },
  enlazada: {
    type: "enlazada",
    data: { bikeId: "", dockId: "" }
  },
  reportada_abandonada: {
    type: "reportada_abandonada",
    data: { bikeId: "" }
  },
  estado_actualizado: {
    type: "estado_actualizado",
    data: { bikeId: "", status: {} }
  },
  bicicleta_descargada: {
    type: "bicicleta_descargada",
    data: { bikeId: "" }
  },
  bicicleta_registrada: {
    type: "bicicleta_registrada",
    data: {}
  }
};
