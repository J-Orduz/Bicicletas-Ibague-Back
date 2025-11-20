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

export const bicicletaService = {
  registrarTelemetria,
  listarEstaciones,
  listarBicicletasPorEstacion,
};

/*export const obtenerTelemetriaActual = async (idBici) => {
  const { data, error } = await supabase
    .from("Telemetria")
    .select("*")
    .eq("IDbicicleta", idBici)
    .order("fechaUltimaConsulta", { ascending: false })
    .limit(1);     // ← la más reciente

  if (error) throw error;
  return data[0] ?? null;
};


export const obtenerTelemetriaHistorico = async (idBici) => {
  const { data, error } = await supabase
    .from("Telemetria")
    .select("*")
    .eq("IDbicicleta", idBici)
    .order("fechaUltimaConsulta", { ascending: false });

  if (error) throw error;
  return data;
};*/