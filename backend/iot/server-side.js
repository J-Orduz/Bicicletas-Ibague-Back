import * as bikeController from "../controllers/bikeController.js"
import { bicicletaService } from "../services/bike/bike.services.js";
import { bikeHandler }
  from "../services/bike/bike-handler.js";
import { BatteryStatus, BatteryLevel, Telemetria } from "../services/bike/state.js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mqtt = require('mqtt');

// Usar variable de entorno o localhost por defecto (para desarrollo local)
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const client = mqtt.connect(BROKER_URL, {
  reconnectPeriod: 5000, // Reintentar cada 5 segundos
  connectTimeout: 30000,  // Timeout de 30 segundos
});

async function sendTelemetry(data) {
  await bicicletaService.registrarTelemetria(data.telemetry);
}

async function updateStatus(data) {
  await bikeHandler.changeStatus(data.id, data.status);
}

import { eventBus } from "../event-bus/index.js";
import { CHANNELS } from "../event-bus/channels.js";
import { producedEvents } from "../services/booking/events-produced.js";
import { TOPICS } from "./topics.js";

export function initMqttClient() {
  console.log(`[MQTT] Conectandose al broker mqtt en ${BROKER_URL}...`);
  
  client.on('error', (err) => {
    console.error('[MQTT] Error de conexión:', err.message);
  });
  
  client.on('reconnect', () => {
    console.log('[MQTT] Intentando reconectar...');
  });
  
  client.on('connect', async () => {
    console.log("[MQTT] Successful connection to the mqtt broker");

    // el dispositivo se suscribe a los canales despues de conectarse
    // exitosamente al broker
    client.subscribe(TOPICS.BIKE.init);
    client.subscribe(TOPICS.BIKE.telemetria);
    client.subscribe(TOPICS.BIKE.fin_viaje);
    //await wait(3*1000);
    eventBus.subscribe(CHANNELS.VIAJES, async event => {
      console.log(`[MQTT] Handling redis event ${event.type} with data ${JSON.stringify(event.data)}`);
      switch (event.type) {
      case producedEvents.viaje_iniciado.type:
        let viaje = await bicicletaService.getViaje(event.data.viajeId);
        let bike = await bikeHandler.getBike(event.data.bikeId);
        let origin = await bicicletaService.getEstacion(viaje.estacionInicio);
        let target = await bicicletaService.getEstacion(viaje.estacionFin);
        console.log(`[MQTT] viaje: ${JSON.stringify(viaje)}`);
        client.publish(TOPICS.CLIENT.viaje,
          JSON.stringify({
            id: event.data.bikeId,
            bike: bike,
            usuarioId: event.data.usuarioId,
            viaje: viaje,
            originId: viaje.estacionInicio,
            origin: origin,
            targetId: event.data.estacionFin,
            target: target,
          }));
        break;
      case "viaje_finalizado":
        console.log(`[MQTT] Evento viaje_finalizado recibido desde Redis: ${JSON.stringify(event.data)}`);
        // El evento ya fue procesado por el servicio de trips (finalizarViaje)
        // Este log confirma que el ciclo se completó
        break;
      default:
        console.log(`[MQTT] Handling for redis event type ${event.type} in channel ${CHANNELS.VIAJES} not implemented.`);
        break;
      }
    });
  });

  client.on('message', async (topic, buffer) => {
    console.log(`[MQTT] Message from ${topic}`);
    const data = JSON.parse(buffer);
    switch (topic) {
    case TOPICS.BIKE.init:
      let bike = await bikeHandler.getBike(data.id);
      console.log(`[MQTT] Bike id ${bike.id}`);
      let est = bicicletaService.getEstacion(bike.idEstacion);
      if (est === null) {
        let res = await bicicletaService.getViajesEstaciones(data.id);
        console.log(`gathered: ${JSON.stringify(res)}`);
        est = bicicletaService.getEstacion(res[0].estacionInicio);
      }
      let bateria = (bike.tipo === 'Electrica')? BatteryLevel.full : null;
      let telem = new Telemetria(est.posicion.longitud,
        est.posicion.latitud, bateria, BatteryStatus.CARGADA);
      client.publish(TOPICS.CLIENT.bikedata,
        JSON.stringify({id: bike.id, telemetry: telem, bike: bike}));
      break;
    case TOPICS.BIKE.telemetria:
      bicicletaService.registrarTelemetria(data.telemetry);
      break;
    case TOPICS.BIKE.fin_viaje:
      const bufdata = data;
      console.log(`[MQTT] Fin de viaje recibido:`, JSON.stringify(bufdata));
      
      // Validar que tenemos los datos necesarios
      if (!bufdata.bike || !bufdata.bike.id) {
        console.error('[MQTT] Error: No se recibió información de la bicicleta');
        break;
      }
      
      if (!bufdata.viaje || !bufdata.viaje.id) {
        console.error('[MQTT] Error: No se recibió información del viaje');
        console.log('[MQTT] Buscando viaje activo para la bicicleta:', bufdata.bike.id);
        
        // Intentar obtener el viaje activo de la bicicleta
        try {
          const viajeActivo = await bicicletaService.getViajeActivoBicicleta(bufdata.bike.id);
          if (viajeActivo && viajeActivo.id) {
            console.log(`[MQTT] Viaje encontrado: ${viajeActivo.id}`);
            await eventBus.publish(CHANNELS.VIAJES, {
              type: "viaje_finalizado",
              data: {
                bikeId: bufdata.bike.id,
                idTrip: viajeActivo.id
              }
            });
          } else {
            console.error('[MQTT] No se encontró viaje activo para la bicicleta');
          }
        } catch (error) {
          console.error('[MQTT] Error buscando viaje activo:', error.message);
        }
        break;
      }
      
      console.log(`[MQTT] Procesando fin de viaje: bikeId=${bufdata.bike.id}, viajeId=${bufdata.viaje.id}`);
      await eventBus.publish(CHANNELS.VIAJES, {
        type: "viaje_finalizado",
        data: {
          bikeId: bufdata.bike.id,
          idTrip: bufdata.viaje.id
        }
      });
      break;
    case TOPICS.BIKE.descargada:
      console.log(`[MQTT] La bicicleta ${data.bike.id} se encuentra descargada`);
    }
  });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
