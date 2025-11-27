import { bikeHandler, BikeStatus } from "../services/bike/bike-handler";
import { BikeStatus } from "../services/bike/bike-handler";
import { Telemetria } from "../services/bike/bike.services";
import { TOPICS } from "./topics";

const mqtt = require('mqtt');

// dirección del servidor que hostea el broker mqtt (eclipse-mosquito)
const BROKER_URL = 'mqtt://localhost:1883';

async function simulate(bike) {
  while (true) {
    if (bike.estado !== BikeStatus.EN_USO) continue;

  }
}

export function startup(id) {
  // se inicializa un cliente separado ya que el proceso es independiente al servidor
  const client = mqtt.connect(BROKER_URL);

  var self = bikeHandler.getBike(id);
  var telemetry = {};
  {
    
  }

  client.on('connect', () => {
    console.log(`Bicicleta IoT #${id} reportando telemetría`);
    client.subscribe(TOPICS.viaje);
  });

  client.on('message', (topic, message) => {
    data = JSON.parse(message);
    if (data.id !== id) {
      console.log(`[IOT ${id}]: message goes to ${data.id}`);
    }
    switch (topic) {
    case TOPICS.viaje:
      console.log(`[IOT ${id}] Desbloqueando...`);
      self.estado = BikeStatus.EN_USO;
    }
  });

  simulate(self);
}