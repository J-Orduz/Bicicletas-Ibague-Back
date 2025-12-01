import { supabase } from "../../shared/supabase/client.js";

// Helpers
async function fetchPages(
  table,
  selectCols = "*",
  filters = {},
  page = 1,
  limit = 1000
) {
  const offset = (page - 1) * limit;
  const to = offset + limit - 1;
  const { data, error } = await supabase
    .from(table)
    .select(selectCols)
    .range(offset, to);
  if (error) {
    console.warn("fetchPages error", error.message);
    return [];
  }
  return data || [];
}

async function fetchAllPaged(
  table,
  selectCols = "*",
  filters = {},
  pageLimit = 1000,
  maxRows = 50000
) {
  let page = 1;
  const results = [];
  while (true) {
    const rows = await fetchPages(table, selectCols, filters, page, pageLimit);
    if (!rows || rows.length === 0) break;
    results.push(...rows);
    if (results.length >= maxRows) break;
    if (rows.length < pageLimit) break;
    page++;
  }
  return results;
}

export async function estacionesReport(filters = {}) {
  const table = "Estacion";
  let rows = await fetchAllPaged(table, "*", filters, 1000, 10000);
  const columns =
    rows && rows.length > 0
      ? Object.keys(rows[0])
      : ["id", "nombre", "posicion"];
  return { columns, rows };
}

export async function usageFrequencyReport(filters = {}) {
  // Aggregate trips by bicicleta (via Reserva)
  const viajeRows = await fetchAllPaged(
    "Viaje",
    "id,idReserva,fechacomienzo,estacionInicio,estacionFin",
    filters,
    1000,
    20000
  );
  const reservaCounts = new Map();
  for (const v of viajeRows) {
    const rid = v.idReserva || "unknown";
    reservaCounts.set(rid, (reservaCounts.get(rid) || 0) + 1);
  }
  // Fetch reservas to map reserva -> bicicleta
  const reservaIds = Array.from(reservaCounts.keys()).filter(
    (k) => k && k !== "unknown"
  );
  let reservaRows = [];
  if (reservaIds.length > 0) {
    // Fetch in batches of 1000
    const chunkSize = 1000;
    for (let i = 0; i < reservaIds.length; i += chunkSize) {
      const chunk = reservaIds.slice(i, i + chunkSize);
      const { data } = await supabase
        .from("Reserva")
        .select("id,bicicleta_id")
        .in("id", chunk);
      reservaRows.push(...(data || []));
    }
  }
  const reservaToBike = new Map(
    reservaRows.map((r) => [String(r.id), r.bicicleta_id])
  );
  const bikeCounts = new Map();
  for (const [rid, count] of reservaCounts.entries()) {
    const bikeId = reservaToBike.get(String(rid)) || "unknown";
    bikeCounts.set(bikeId, (bikeCounts.get(bikeId) || 0) + count);
  }
  const out = Array.from(bikeCounts.entries()).map(([bike_id, trips]) => ({
    bike_id,
    trips,
  }));
  const columns = ["bike_id", "trips"];
  return { columns, rows: out };
}

export async function stationsDemandReport(filters = {}) {
  const rows = await fetchAllPaged(
    "Viaje",
    "id,estacionInicio,estacionFin",
    filters,
    1000,
    20000
  );
  const map = new Map();
  for (const r of rows) {
    const o = r.estacionInicio || "unknown";
    map.set(o, (map.get(o) || 0) + 1);
  }
  const out = Array.from(map.entries()).map(([station_id, trips]) => ({
    station_id,
    trips,
  }));
  const columns = ["station_id", "trips"];
  return { columns, rows: out };
}

export async function bikeDemandByTypeReport(filters = {}) {
  // Map bikes to types and count trips per type (using Reserva -> Bicicleta)
  const bikes = await fetchAllPaged("Bicicleta", "id,tipo", {}, 1000, 20000);
  const viajeRows = await fetchAllPaged(
    "Viaje",
    "id,idReserva",
    filters,
    1000,
    50000
  );
  const reservaIds = Array.from(
    new Set(viajeRows.map((v) => v.idReserva).filter(Boolean))
  );
  const reservaRows = [];
  if (reservaIds.length > 0) {
    const chunkSize = 1000;
    for (let i = 0; i < reservaIds.length; i += chunkSize) {
      const chunk = reservaIds.slice(i, i + chunkSize);
      const { data } = await supabase
        .from("Reserva")
        .select("id,bicicleta_id")
        .in("id", chunk);
      reservaRows.push(...(data || []));
    }
  }
  const reservaToBike = new Map(
    reservaRows.map((r) => [String(r.id), r.bicicleta_id])
  );
  const bikeTypeMap = new Map(
    bikes.map((b) => [String(b.id), b.tipo || "unknown"])
  );
  const typeCount = new Map();
  for (const v of viajeRows) {
    const bikeId = reservaToBike.get(String(v.idReserva)) || "unknown";
    const type = bikeTypeMap.get(String(bikeId)) || "unknown";
    typeCount.set(type, (typeCount.get(type) || 0) + 1);
  }
  const out = Array.from(typeCount.entries()).map(([type, trips]) => ({
    type,
    trips,
  }));
  const columns = ["type", "trips"];
  return { columns, rows: out };
}

export async function tripsPerDayReport(filters = {}) {
  let viajeFilters = { ...filters };
  let reservaIds = null;
  // Si se pasa usuario_id, buscar reservas de ese usuario y filtrar viajes por idReserva
  if (filters.usuario_id) {
    // Buscar reservas del usuario
    const { data: reservas, error } = await supabase
      .from("Reserva")
      .select("id")
      .eq("usuario_id", filters.usuario_id);
    if (error) {
      console.warn("Error buscando reservas por usuario_id", error.message);
      return { columns: ["date", "trips"], rows: [] };
    }
    reservaIds = (reservas || []).map((r) => r.id);
    console.log(
      `[reports] usuario_id=${filters.usuario_id} reservas encontradas=${reservaIds.length}`
    );
    if (reservaIds.length === 0) {
      return { columns: ["date", "trips"], rows: [] };
    }
    // Filtrar viajes por idReserva
    viajeFilters = { ...viajeFilters };
    delete viajeFilters.usuario_id;
  }
  // Obtener viajes
  let rows = [];
  if (reservaIds) {
    // Buscar viajes cuyo idReserva esté en reservaIds (en lotes de 1000)
    const chunkSize = 1000;
    for (let i = 0; i < reservaIds.length; i += chunkSize) {
      const chunk = reservaIds.slice(i, i + chunkSize);
      const { data: viajes, error } = await supabase
        .from("Viaje")
        .select("id,fechacomienzo,idReserva")
        .in("idReserva", chunk);
      if (error) {
        console.warn("Error buscando viajes por idReserva", error.message);
        continue;
      }
      rows.push(...(viajes || []));
    }
    console.log(
      `[reports] usuario_id=${filters.usuario_id} viajes encontrados=${rows.length}`
    );
  } else {
    rows = await fetchAllPaged(
      "Viaje",
      "id,fechacomienzo,idReserva",
      viajeFilters,
      1000,
      50000
    );
  }
  // Agrupar por día
  const map = new Map();
  for (const r of rows) {
    const day = r.fechacomienzo
      ? new Date(r.fechacomienzo).toISOString().slice(0, 10)
      : "unknown";
    map.set(day, (map.get(day) || 0) + 1);
  }
  const out = Array.from(map.entries()).map(([date, trips]) => ({
    date,
    trips,
  }));
  const columns = ["date", "trips"];
  return { columns, rows: out };
}

export async function maintenanceReport(filters = {}) {
  // Use Bicicleta table to report status and battery
  let rows = await fetchAllPaged(
    "Bicicleta",
    "id,marca,tipo,estado,idEstacion,bateria",
    filters,
    1000,
    20000
  );
  const columns =
    rows && rows.length > 0
      ? Object.keys(rows[0])
      : ["id", "tipo", "estado", "bateria"];
  return { columns, rows };
}

// Export a map
export const reportHandlers = {
  estaciones: estacionesReport,
  estaciones_report: estacionesReport,
  usage_frequency: usageFrequencyReport,
  stations_demand: stationsDemandReport,
  bike_demand_by_type: bikeDemandByTypeReport,
  trips_per_day: tripsPerDayReport,
  maintenance: maintenanceReport,
};

export default { reportHandlers };
