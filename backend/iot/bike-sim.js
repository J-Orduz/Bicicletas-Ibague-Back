import { BikeStatus, BatteryStatus, BatteryLevel, Telemetria }
  from "../services/bike/state.js";
import { TOPICS } from "./topics.js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mqtt = require('mqtt');

const BROKER_URL = 'mqtt://localhost:1883'; // dirección del servidor
// que hostea el broker mqtt (eclipse-mosquito)
const BATTERY_TIME_MS = 1000 * 7; // tiempo de duracion de una linea
// de bateria
const TELEMETRY_PERIOD_MS = 1000 * 20; // intervalo de espera para reporte
// de telemetria
const ABANDON_WAIT_TIME_MINUTES = 80; // tiempo de espera

class Bike {
  init(id) {
    // se inicializa un cliente separado ya que el proceso es 
    // independiente al servidor
    this.client = mqtt.connect(BROKER_URL);

    // se obtienen al solicitar la informacion de la bicicleta mediante
    // el cliente
    this.bike = {};
    this.telemetry = new Telemetria();
    this.initialized = false;

    this.client.on('connect', async () => {
      console.log(`[IOT ${id}] inicializando`);
      this.client.publish(TOPICS.BIKE.init, JSON.stringify({id: id}));
      this.client.subscribe(TOPICS.CLIENT.bikedata);
      this.client.subscribe(TOPICS.CLIENT.viaje);
    });

    this.client.on('message', async (topic, message) => {
      const data = JSON.parse(message);
      if (data.id !== id) {
        console.log(`[IOT ${id}]: message goes to ${data.id}`);
        return;
      }

      console.log("connected?", this.client.connected);
      console.log("publishing to hello...");
      // this.client.publish(TOPICS.BIKE.telemetria, JSON.stringify({
      //   bike: this.bike,
      //   telemetry: this.telemetry,
      // }));

      switch (topic) {
      case TOPICS.CLIENT.bikedata:
        if (this.initialized) {
          console.log(`[IOT ${id}] data was already retrieved before...`);
          break;
        }
        console.log(`[IOT ${id}] Initial bike data retrieved from client...`);
        Object.assign(this.telemetry, data.telemetry);
        this.bike = data.bike;
        this.initialized = true;
        // this.client.publish(TOPICS.BIKE.telemetria, JSON.stringify({
        //   bike: this.bike,
        //   telemetry: this.telemetry,
        // }));
        this.simulate();
        break;
      case TOPICS.viaje:
        console.log(`[IOT ${id}] Desbloqueando...`);
        this.bike.estado = BikeStatus.EN_USO;
        break;
      }
    });

    // while (!this.client.connected) {}
    // this.simulate();
  }

  async simulate() {
    var tripStartTime = new Date();
    var now = tripStartTime;
    var ellapsed = 0;
    var delta = 0;
    var interval = 0;
    while (true) {
      delta = (new Date()) - now;
      ellapsed += delta;
      interval += delta;
      now = new Date();

      if (this.bike.estado !== BikeStatus.EN_USO) {
        switch (this.bike.estado) {
        case BikeStatus.BLOQUEADA:
          tripStartTime = new Date(); // reestabecer tiempo de inicio
          continue;
        }
      }
      
      // si el tiempo en uso es mayor a ABANDON_WAIT_TIME
      if (ellapsed/(1000*60) > ABANDON_WAIT_TIME_MINUTES) {
        this.bike.estado = BikeStatus.ABANDONADA;
      }

      if (this.bike.tipo === 'Electrica') {
        if (this.telemetry.bateria === BatteryLevel.zero) {
          // TODO: reporte para bateria descargada
          break;
        }
        if (this.telemetry.bateria <= BatteryLevel.low) {
          // TODO: implementar advertencia de bateria baja
        }

        if (interval > BATTERY_TIME_MS) {
          interval -= BATTERY_TIME_MS;
          console.log(`[IOT ${this.bike.id}] Bateria disminuida en 1 punto`);
          this.telemetry.bateria -= 1;
        }
      }

      console.log(`[IOT ${this.bike.id}] reportando telemetria`);
      this.telemetry.id += 1;
      await this.client.publish(TOPICS.BIKE.telemetria, JSON.stringify({
        bike: this.bike,
        telemetry: this.telemetry.dto(this.bike.id)
      }));

      // si el tiempo transcurrido en la iteracion es menor al intervalo,
      // esperar hasta completar el intervalo
      await wait(1000 * 4);
    }
  }
}

// function mod(x,n) {
//   return x - (Math.floor(x/n) * n);
// }

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const ids = ['E0001', 'E0002', 'E0003'];
for (let i=0; i<3; ++i) {
  let bike = new Bike();
  bike.init(ids[i]);
}
