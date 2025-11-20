import * as bikeController from "../controllers/bikeController.js"
import { bicicletaService } from "../services/bike/bike.services.js";
import { bikeHandler } from "../services/bike/bike-handler.js";

const mqtt = require('mqtt');
export const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log("Successful connection to the mqtt broker");

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
