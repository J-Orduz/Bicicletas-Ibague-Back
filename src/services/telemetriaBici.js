import { supabase } from "../shared/supabaseClient.js";
import { eventBus } from "../event-bus/index.js";

export const procesarTelemetria = async (tele) => {
  await supabase.from("telemetria").insert({
    bike_id: tele.bikeId,
    latitud: tele.latitud,
    longitud: tele.longitud,
    bateria: tele.bateria,
    lock_status: tele.lockStatus,
    timestamp: tele.timestamp
  });

  //await eventBus.publish("BikeTelemetryReceived", tele);
};