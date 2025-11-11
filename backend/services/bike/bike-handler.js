import { supabase } from "../shared/supabase/client.js";


export const listarBicicletas = async () => {
  const { data, error } = await supabase
    .from("Bicicleta")
    .select("*");

  

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
