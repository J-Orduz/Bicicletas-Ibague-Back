export const consumedEvents = {
  redistribucion_requerida: async (event) => {
    // Aquí va la lógica para notificar al equipo
    // Email, Slack, SMS, etc.
    console.log(`📢 NOTIFICACIÓN: Redistribución requerida para estación ${event.data.estacionId}`);
    console.log(`🚲 Se necesitan ${event.data.cantidadBicicletas} bicicletas`);
    
  }
};