import { bikeHandler } from "../services/bike/bike-handler";

// dirección del servidor que hostea el broker mqtt (eclipse-mosquito)
const BROKER_URL = 'mqtt://localhost:1883';

const mqtt = require('mqtt');

// se inicializa un cliente separado ya que el proceso es independiente al servidor
const client = mqtt.connect(BROKER_URL);

// el id de la bicicleta debe ser suplido como primer argumento de cli (argv[0])
const id = process.argv[0];
var data = bikeHandler.getBike(id);

import { BikeStatus } from "../services/bike/bike-handler";

client.on('connect', () => {
	console.log(`Bicicleta IoT #${id} reportando telemetría`);
	client.subscribe(`bikes/${id}/unlock`, () => {
		data.estado = BikeStatus.EN_USO;
	});
});
