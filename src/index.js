import 'dotenv/config';
import app from "./app.js";
import { config } from "./config.js";

// cargar consumers
//import "./event-bus/consumers/bikeTelemetry.consumer.js";

app.listen(config.port, () =>
  console.log(`Servidor corriendo en puerto ${config.port}`)
);