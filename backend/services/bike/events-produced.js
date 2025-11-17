// services/bike/events-produced.js
export const producedEvents = {
  // Eventos relacionados directamente con el estado de las bicicletas
  estado_actualizado: {
    type: "estado_actualizado",
    data: { 
      bikeId: "", 
      status: "",
      numero_serie: "",
      timestamp: "" 
    }
  },
  
  posicion_actualizada: {
    type: "posicion_actualizada",
    data: { 
      bikeId: "", 
      newPos: "",
      timestamp: "" 
    }
  },
  
  bicicleta_enlazada: {
    type: "bicicleta_enlazada",
    data: { 
      bikeId: "", 
      dockId: "",
      timestamp: "" 
    }
  },
  
  bicicleta_registrada: {
    type: "bicicleta_registrada",
    data: {
      id: "",
      numero_serie: "",
      marca: "",
      tipo: "",
      timestamp: ""
    }
  },
  
  bicicleta_descargada: {
    type: "bicicleta_descargada",
    data: { 
      bikeId: "",
      motivo: "",
      timestamp: "" 
    }
  },
  
  reportada_abandonada: {
    type: "reportada_abandonada",
    data: { 
      bikeId: "",
      ubicacion: "",
      timestamp: "" 
    }
  }
};