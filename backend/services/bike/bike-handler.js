import { supabase } from "../shared/supabaseClient.js";


export const listarBicicletas = async () => {
  const { data, error } = await supabase
    .from("Bicicleta")
    .select("*");

  console.log("ERROR:", error);
  console.log("DATA:", data);

  if (error) throw error;
  return data;
};


export const listarPorTipo = async (tipo) => {
  const { data, error } = await supabase
    .from("Bicicleta")
    .select("*")
    .eq("tipo", tipo);

  if (error) throw error;
  return data;
};


export const obtenerTelemetriaActual = async (idBici) => {
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
};
