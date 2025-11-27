import { bikeHandler, BikeStatus,
  BatteryStatus, BatteryLevel } from "../services/bike/bike-handler.js";
import { Telemetria, bicicletaService } from "../services/bike/bike.services.js";
import { TOPICS } from "./topics.js";

const mqtt = require('mqtt');

// dirección del servidor que hostea el broker mqtt (eclipse-mosquito)
const BROKER_URL = 'mqtt://localhost:1883';

function mod(x,n) {
  return x - (Math.floor(x/n) * n);
}

// tiempo de duracion de una linea de bateria
const BATTERY_TIME_MS = 1000 * 4;

// intervalo de espera para reporte de telemetria
const TELEMETRY_PERIOD_MS = 1000 * 20;

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
      this.client.subscribe(TOPICS.viaje);
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
    const startTime = new Date();
    var ellapsed = undefined;
    while (true) {
      ellapsed = (new Date()) - startTime;

      if (this.bike.estado !== BikeStatus.EN_USO) {
        switch (this.bike.estado) {
        case BikeStatus.BLOQUEADA:
          continue;
        
        }
      }
      
      // si el tiempo en uso es mayor a ABANDON_WAIT_TIME
      if (ellapsed/(1000*60) > ABANDON_WAIT_TIME_MINUTES) {
        this.bike.estado = BikeStatus.ABANDONADA;
      }

      // 
      if (bike.tipo === 'Electrica') {
        if (this.telemetry.bateria === BatteryLevel.zero) {
          // TODO: reporte para bateria descargada
          break;
        }
        if (this.telemetry.bateria <= BatteryLevel.low) {
          // TODO: implementar advertencia de bateria baja
        }
        this.telemetry.bateria -= Math.floor(ellapsed / BATTERY_TIME_MS);
      }

      this.client.publish(TOPICS.telemetria, JSON.stringify({
        bike: this.bike,
        telemetry: this.telemetry
      }));

      // si el tiempo transcurrido en la iteracion es menor al intervalo,
      // esperar hasta completar el intervalo
      wait(TELEMETRY_PERIOD_MS - ellapsed + (new Date()));
    }
  }
}

function wait(ms) {
  if (ms <= 0) return 0;
  const start = new Date();
  var now = new Date();
  while (now - start < ms) {
    now = new Date();
  }
}

async function simulate(bike, telemetry) {
  const startTime = new Date();
  var ellapsed = undefined;
  while (true) {
    ellapsed = (new Date()) - startTime;

    if (bike.estado !== BikeStatus.EN_USO) continue;
    
    // si el tiempo en uso es mayor a ABANDON_WAIT_TIME
    if (ellapsed/(1000*60) > ABANDON_WAIT_TIME_MINUTES) {
      bike.estado = BikeStatus.ABANDONADA;
    }

    if (bike.tipo === 'Electrica') {
      bike.bateria -= Math.floor(ellapsed / BATTERY_TIME_MS);
    }

    //client.publish
  }
}
/*
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
	client.subscribe(`bikes/${id}/unlock`, () => {
		console.log(`Bicicleta ${id} desbloqueada`);
		data.estado = BikeStatus.EN_USO;
	});
});

client.on("message", (topic, message) => {
  const command = JSON.parse(message.toString());
  console.log(`[BIKE] Command received:`, command);

<<<<<<< HEAD
  simulate(self);
}
*/

var bikes = [new Bike(), new Bike(), new Bike()];
const ids = ['E001', 'E002', 'E003'];
for (i in range(0,3))
  bikes[i].init(ids[i]);
=======
  if (command.action === "unlock") {
    console.log(`[BIKE] Bike ${BIKE_ID} unlocking...`);
    client.publish(
      `bikes/${BIKE_ID}/status`,
      JSON.stringify({ unlocked: true, timestamp: Date.now() })
    );
  }
  
})};
>>>>>>> fe278207c9283c3c16678b95523daa6f91c69912
