import { supabase } from "../shared/supabase/client.js";

async function checkTable(table) {
  try {
    const head = await supabase
      .from(table)
      .select("*", { head: true, count: "exact" });
    const count = head.count ?? 0;
    console.log(`Table ${table}: count = ${count}`);
    if (count > 0) {
      const { data, error } = await supabase.from(table).select("*").limit(5);
      if (error) {
        console.warn(
          `Error fetching sample from ${table}:`,
          error.message || error
        );
      } else {
        console.log(`Sample rows from ${table}:`, data);
      }
    }
  } catch (e) {
    console.error(`Failed to check ${table}:`, e.message || e);
  }
}

async function main() {
  const tables = ["Viaje", "Reserva", "Bicicleta", "Estacion", "profiles"];
  for (const t of tables) {
    await checkTable(t);
  }
  process.exit(0);
}

main();
