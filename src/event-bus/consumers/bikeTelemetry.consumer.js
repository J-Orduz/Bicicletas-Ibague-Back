import { eventBus } from "../index.js";
import { supabase } from "../../shared/supabaseClient.js";

eventBus.subscribe("BikeTelemetryReceived", async (msg) => {
  await supabase
    .from("bicicleta")
    .update({
      latitud_actual: msg.latitud,
      longitud_actual: msg.longitud,
      bateria_actual: msg.bateria,
      lock_status_actual: msg.lockStatus,
      timestamp_actual: msg.timestamp,
      fecha_ultima_consulta: new Date()
    })
    .eq("id_bici", msg.bikeId);
});