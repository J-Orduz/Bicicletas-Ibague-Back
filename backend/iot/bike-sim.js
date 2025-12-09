import { BikeStatus, BatteryStatus, BatteryLevel, Telemetria, Bike }
  from "../services/bike/state.js";
import { TOPICS } from "./topics.js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const mqtt = require('mqtt');

// Usar variable de entorno o localhost por defecto (para desarrollo local)
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const BATTERY_TIME_MS = 1000 * 12; // tiempo de duracion de un punto
// de bateria
const TELEMETRY_PERIOD_MS = 1000 * 3; // intervalo de espera para reporte
// de telemetria
const ABANDON_WAIT_TIME_MINUTES = 80; // tiempo de espera

const INTERPOLATION_RATE = 1.0/7.0;

class IOTBike {
  init(id) {
    // se inicializa un cliente separado ya que el proceso es 
    // independiente al servidor
    this.client = mqtt.connect(BROKER_URL);

    // se obtienen al solicitar la informacion de la bicicleta mediante
    // el cliente
    this.bike = new Bike();
    this.telemetry = new Telemetria();
    this.destino = { longitud: 0, latitud: 0 };
    this.initialized = false;

    this.client.on('connect', async () => {
      //console.log(`[IOT ${id}] inicializando...`);
      //this.client.publish(TOPICS.BIKE.init, JSON.stringify({id: id}));
      this.client.subscribe(TOPICS.CLIENT.bikedata);
      this.client.subscribe(TOPICS.CLIENT.viaje);
    });

    this.client.on('message', async (topic, message) => {
      const data = JSON.parse(message);
      if (topic === TOPICS.CLIENT.viaje) {
       // console.log(`[IOT ${id}] viaje para ${data.id}`);
      }
      if (data.id === id) {
        console.log(`[IOT ${id}] recieved message from ${topic}`);
      } else return;

      switch (topic) {
      case TOPICS.CLIENT.bikedata:
        if (this.initialized) {
          console.log(`[IOT ${id}] data was already retrieved before...`);
          break;
        }
        console.log(`[IOT ${id}] esperando a inicio de viaje...`);
        Object.assign(this.telemetry, data.telemetry);
        Object.assign(this.bike, data.bike);
        this.initialized = true;
        break;
      case TOPICS.CLIENT.viaje:
        //while (!this.initialized) await wait(10);
        Object.assign(this.bike, data.bike);
        this.bike.bateria = data.bike.bateria;
        console.log(`[IOT ${id}] Desbloqueando... (bateria: ${this.bike.bateria})`);
        this.bike.estado = BikeStatus.EN_USO;
        this.bike.idEstacion = data.estacionInicio;
        this.telemetry.bateria = data.bike.bateria;
        this.telemetry.longitud = data.origin.posicion.longitud;
        this.telemetry.latitud = data.origin.posicion.latitud;
        if (!this.initialized) {
          console.log(`[IOT ${id}] no ha sido inicializada, esperando...`);
          //await wait(6 * 1000);
        }
        this.travel(data.target.id, {
          long: data.target.posicion.longitud,
          lat: data.target.posicion.latitud,
        }).then(() => {
          console.log(`[IOT ${id}] viaje finalizado`);
          this.bike.idEstacion = data.targetId;
        });
        break;
      }
    });
  }

  async travel(idEstacion, {long, lat}, viaje) {
    console.log(`[IOT ${this.bike.id}] simulation: ${JSON.stringify([long, lat, this.telemetry])}`);
    let tripStartTime = new Date();
    let now = tripStartTime;
    let ellapsed = 0;
    let delta = 0;
    //let interval = 0;
    const startBattery = this.bike.bateria;
    let interpolate = 0.0;
    let initpos = {long: this.telemetry.longitud,
      lat: this.telemetry.latitud};

    while (interpolate < 1) {
      delta = (new Date()) - now;
      ellapsed += delta;
      //interval += delta;
      now = new Date();

      if (this.bike.estado !== BikeStatus.EN_USO) {
        // switch (this.bike.estado) {
        // case BikeStatus.BLOQUEADA:
        //   // tripStartTime = new Date(); // reestabecer tiempo de inicio
        //   // continue;
        // }
        return Error("not possible to travel when the bike is locked");
      }
      
      // si el tiempo en uso es mayor a ABANDON_WAIT_TIME
      if (ellapsed/(1000*60) > ABANDON_WAIT_TIME_MINUTES) {
        this.bike.estado = BikeStatus.ABANDONADA;
      }

      if (this.bike.tipo === 'Electrica') {
        if (this.telemetry.bateria > BatteryLevel.zero) {
          this.telemetry.bateria = startBattery
            - Math.floor(ellapsed/BATTERY_TIME_MS);
        } else {
          console.log("laskdjfkldsj");
          interpolate -= INTERPOLATION_RATE;
          // TODO: advertencia de batería descargada
        }
        if (this.telemetry.bateria <= BatteryLevel.low) {
          // TODO: implementar advertencia de bateria baja
        }

        // if (interval > BATTERY_TIME_MS) {
        //   interval -= BATTERY_TIME_MS;
        //   console.log(`[IOT ${this.bike.id}] Bateria disminuida en 1 punto`);
        //   this.telemetry.bateria -= 1;
        // }
      }

      this.telemetry.longitud = lerp(initpos.long, long, interpolate);
      this.telemetry.latitud = lerp(initpos.lat, lat, interpolate);
      interpolate += INTERPOLATION_RATE;

      console.log(`[IOT ${this.bike.id}] reportando telemetria: ${JSON.stringify([interpolate, this.bike.bateria, this.telemetry])}`);
      this.telemetry.id += 1;
      await this.client.publish(TOPICS.BIKE.telemetria, JSON.stringify({
        // bike: this.bike,
        telemetry: this.telemetry.dto(this.bike.id)
      }));

      // si el tiempo transcurrido en la iteracion es menor al intervalo,
      // esperar hasta completar el intervalo
      let itertime = new Date() - now;
      if (itertime < TELEMETRY_PERIOD_MS)
        await wait(TELEMETRY_PERIOD_MS - itertime);
    }

    this.bike.idEstacion = idEstacion;
    this.bike.estado = BikeStatus.DISPONIBLE;
    this.client.publish(TOPICS.BIKE.fin_viaje, JSON.stringify({
      bike: this.bike,
      viaje: viaje,
      date: new Date(),
    }));
  }
}

function lerp(x,y,t) {
  return x*(1 - t) + y*t;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



console.log("Inicializando simulador de bicicletas...");
const ids = new Array(1000); // 500 E + 500 M
let idx = 0;
// E0001 → E0500
for (let i = 1; i <= 500; i++) {
  ids[idx++] = `E${String(i).padStart(4, '0')}`;
}
// M0001 → M0500
for (let i = 1; i <= 500; i++) {
  ids[idx++] = `M${String(i).padStart(4, '0')}`;
}
console.log('Bicicletas precargadas exitosamente, comenzando simulacion');

for (let i=0; i < ids.length; ++i) {
  let bike = new IOTBike();
  bike.init(ids[i]);
}
