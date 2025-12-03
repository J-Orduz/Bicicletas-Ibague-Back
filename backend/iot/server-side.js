import * as bikeController from "../controllers/bikeController.js"
import { bicicletaService } from "../services/bike/bike.services.js";
import { bikeHandler }
  from "../services/bike/bike-handler.js";
import { BatteryStatus, Telemetria } from "../services/bike/state.js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mqtt = require('mqtt');

// asume que el servidor broker se ejecuta en el mismo dispositivo que el
// servidor principal
const client = mqtt.connect('mqtt://localhost:1883');

async function sendTelemetry(data) {
  await bicicletaService.registrarTelemetria(data.telemetry);
}

async function updateStatus(data) {
  await bikeHandler.changeStatus(data.id, data.status);
}

import { eventBus } from "../event-bus/index.js";
import { CHANNELS } from "../event-bus/channels.js";
import { TOPICS } from "./topics.js";

export function initMqttClient() {
  console.log("[MQTT] Conectandose al broker mqtt...");
  client.on('connect', () => {
    console.log("[MQTT] Successful connection to the mqtt broker");

    // el dispositivo se suscribe a los canales despues de conectarse
    // exitosamente al broker
    client.subscribe(TOPICS.BIKE.init);
    client.subscribe(TOPICS.BIKE.telemetria);
    client.subscribe('hello');
    client.subscribe('test');
  });

  client.on('message', async (topic, buffer) => {
    console.log(`[MQTT] Message from ${topic}`);
    const data = JSON.parse(buffer);
    switch (topic) {
    case TOPICS.BIKE.init:
      let bike = await bikeHandler.getBike(data.id);
      //console.log(`[MQTT] Bike id ${bike}`);
      let est = bicicletaService.getEstacion(bike.idEstacion);
      let bateria = (bike.tipo === 'Electrica')? 0xf : null;
      let telem = new Telemetria(est.posicion.longitud,
        est.posicion.latitud, bateria, BatteryStatus.CARGADA);
      client.publish(TOPICS.CLIENT.bikedata,
        JSON.stringify({id: bike.id, telemetry: telem, bike: bike}));
      break;
    case TOPICS.BIKE.telemetria:
      bicicletaService.registrarTelemetria(data.telemetry);
      break;
    }
  });
}
