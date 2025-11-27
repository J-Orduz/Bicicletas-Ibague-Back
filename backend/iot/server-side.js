import * as bikeController from "../controllers/bikeController.js"
import { bicicletaService } from "../services/bike/bike.services.js";
import { bikeHandler } from "../services/bike/bike-handler.js";

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
    console.log("[MQTT] Conexion al broker exitosa");

    // el dispositivo se suscribe a los canales despues de
    // conectarse exitosamente al broker
    client.subscribe(TOPICS.telemetria);
    client.subscribe(TOPICS.telemetria);
    eventBus.subscribe(CHANNELS.BICICLETAS, async (event) => {
      console.log(`[MQTT] Informando a bicicleta ${event.data.bikeId}
        del evento ${event.type}`);
      switch (event.type) {
      case 'viaje_iniciado':
      case 'viaje_finalizado':
        client.publish(TOPICS.viaje, JSON.stringify(event.data));
        break;
      }
    });
  });

  client.on('message', (topic, buffer) => {
    console.log(`[MQTT] Message from ${topic}`);
    switch (topic) {
    case 'telemetry':
      sendTelemetry(JSON.parse(buffer));
      break;
    case 'status':
      updateStatus(JSON.parse(buffer));
      break;
    }
  });
}
