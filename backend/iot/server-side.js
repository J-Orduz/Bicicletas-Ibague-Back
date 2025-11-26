import * as bikeController from "../controllers/bikeController.js"
import { bicicletaService } from "../services/bike/bike.services.js";
import { bikeHandler } from "../services/bike/bike-handler.js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mqtt = require('mqtt');

// asume que el servidor broker se ejecuta en el mismo dispositivo que el
// servidor principal
//const client = mqtt.connect('mqtt://localhost:1883');
const client = mqtt.connect({
  port: 1883, host: `192.168.56.1`, keepalive: 90});

export function initMqttClient() {
  console.log("[MQTT] Conectandose al broker mqtt...");
  client.on('connect', () => {
    console.log("[MQTT] Conexion al broker exitosa");

    // el dispositivo se suscribe a los canales despues de conectarse exitosamente al broker
    client.subscribe('bikes/+/telemetry', async (data) => {
      await bicicletaService.registrarTelemetria(data);
    });
    client.subscribe('bikes/+/status', async (id, status) => {
      await bikeHandler.changeStatus(id, status);
    });
  });

  client.on('message', (topic, buffer) => {
    console.log(`Message from ${topic}`);
    
  });
}
