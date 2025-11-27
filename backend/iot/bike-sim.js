import getTimer from "mqtt/lib/get-timer";
import { bikeHandler, BikeStatus,
  BatteryStatus } from "../services/bike/bike-handler";
import { BikeStatus } from "../services/bike/bike-handler";
import { Telemetria, bicicletaService } from "../services/bike/bike.services";
import { TOPICS } from "./topics";

const mqtt = require('mqtt');

// dirección del servidor que hostea el broker mqtt (eclipse-mosquito)
const BROKER_URL = 'mqtt://localhost:1883';

function mod(x,n) {
  return x - (Math.floor(x/n) * n);
}

// tiempo de duracion de una linea de bateria
const BATTERY_TIME_MS = 1000 * 4;

// tiempo de espera
const ABANDON_WAIT_TIME_MINUTES = 80;

class Bike {
  async init(id) {
    // se inicializa un cliente separado ya que el proceso es 
    // independiente al servidor
    this.client = mqtt.connect(BROKER_URL);
    this.bike = await bikeHandler.getBike(id);
    this.telemetry = (() => {
      var est = bicicletaService.getEstacion(this.bike.idEstacion);
      
      // si la bicicleta es electrica, empieza con una bateria de "15 puntos"
      // dado que en la base de datos se almacena como int4
      const bateria = (self.tipo === 'Electrica')? 0xf : null;
      return new Telemetria(est.posicion.longitud, est.posicion.latitud,
        bateria, BatteryStatus.CARGADA);
    })();

    this.client.on('connect', () => {
      console.log(`Bicicleta IoT #${id} reportando telemetría`);
      client.subscribe(TOPICS.viaje);
    });

    this.client.on('message', (topic, message) => {
      data = JSON.parse(message);
      if (data.id !== id) {
        console.log(`[IOT ${id}]: message goes to ${data.id}`);
      }
      switch (topic) {
      case TOPICS.viaje:
        console.log(`[IOT ${id}] Desbloqueando...`);
        this.bike.estado = BikeStatus.EN_USO;
      }
    });

    this.simulate();
  }

  async simulate() {
    // TODO: transferir logica de simulacion a la clase.
  }
}

async function simulate(bike, telemetry) {
  const startTime = new Date();
  var ellapsed = undefined;
  while (true) {
    {
      const now = new Date();
      ellapsed = now - startTime;
    }

    if (bike.estado !== BikeStatus.EN_USO) continue;
    
    // si el tiempo en uso es mayor a ABANDON_WAIT_TIME
    if (ellapsed/(1000*60) > ABANDON_WAIT_TIME_MINUTES) {
      bike.estado = BikeStatus.ABANDONADA;
    }

    if (bike.tipo === 'Electrica') {
      bike.bateria -= Math.floor(ellapsed / BATTERY_TIME_MS);
    }

    client.publish
  }
}

function startup(id) {
  // se inicializa un cliente separado ya que el proceso es 
  // independiente al servidor
  const client = mqtt.connect(BROKER_URL);

  var self = bikeHandler.getBike(id);
  var telemetry = {};
  {
    var est = bicicletaService.getEstacion(self.idEstacion);
    
    // si la bicicleta es electrica, empieza con una bateria de "15 puntos"
    // dado que en la base de datos se almacena como int4
    const bateria = (self.tipo === 'Electrica')? 0xf : null;
    telemetry = new Telemetria(est.posicion.longitud, est.posicion.latitud,
      bateria, BatteryStatus.CARGADA);
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