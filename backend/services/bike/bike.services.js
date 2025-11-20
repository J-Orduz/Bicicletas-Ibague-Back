import { supabase } from "../../shared/supabase/client.js";

const listarEstaciones = async () => {
    let { data, error } = await supabase
        .from('Estacion')
        .select('*')

    if (error) throw error;
    return data;
}

const listarBicicletasPorEstacion = async (idEstacion) => {
    const { data, error } = await supabase
      .from("Bicicleta")
      .select("*")
      .eq("idEstacion", idEstacion);
    console.log("ERROR:", error);
    console.log("DATA:", data);

    if (error) throw error;
    return data;
};


async function registrarTelemetria(telemetria) {
  const { _, error } = await supabase
    .from("Telemetria")
    .insert(telemetria);
  if (error) throw Error(error.message);
}

export const obtenerTelemetriaActual = async (idBici) => {
  const { data, error } = await supabase
    .from("Telemetria")
    .select("*")
    .eq("IDbicicleta", idBici)
    .order("fechaConsulta", { ascending: false })
    .limit(1);     // ← la más reciente

  console.log(`data: ${JSON.stringify(data)}`);
  if (error) throw Error(error.message);
  return data[0] ?? null;
};

// TODO: limitar histórico hasta el inicio del ultimo viaje
export const obtenerTelemetriaHistorico = async (idBici) => {
  const { data, error } = await supabase
    .from("Telemetria")
    .select("*")
    .eq("IDbicicleta", idBici)
    .order("fechaConsulta", { ascending: false });

  if (error) throw Error(error.message);
  return data;
};

export const bicicletaService = {
  registrarTelemetria,
  listarEstaciones,
  listarBicicletasPorEstacion,
  obtenerTelemetriaActual,
  obtenerTelemetriaHistorico
};
