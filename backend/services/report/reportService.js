import ExcelJS from "exceljs";
import ejs from "ejs";
import puppeteer from "puppeteer";
import path from "path";
import { fileURLToPath } from "url";
import { supabase } from "../../shared/supabase/client.js";
import { reportHandlers } from "./queries.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fetchDataPage(tableName, filters = {}, page = 1, limit = 1000) {
  // Simple mapping: assume tableName corresponds to a Supabase table.
  // Offset-based pagination using range.
  try {
    const offset = (page - 1) * limit;
    const to = offset + limit - 1;
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(offset, to);
    if (error) {
      console.warn("Supabase fetch error", error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.warn("fetchDataPage error", e);
    return [];
  }
}

// HU-32 descripción para cabecera
const HU32_DESCRIPTION =
  "Los reportes podrán ser generados a discreción de los usuarios, se mostrará una vista previa y permitirá su descarga en Excel o PDF: Frecuencia de uso de bicicletas, estaciones de mayor demanda, servicio con mayor demanda (última milla o recorrido largo), bicicleta de mayor demanda (Eléctrica o Mecánica), viajes por día, mantenimientos.";

export async function generateXlsxStream(
  res,
  reportName = "report",
  filters = {},
  pagination = {}
) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res });

  const MAX_ROWS_SYNC = 10000;

  // Select handler for report type (aggregations or table)
  const normalizedName = String(reportName || "").toLowerCase();
  const handler = reportHandlers[reportName] || reportHandlers[normalizedName];
  let result;
  if (handler) {
    result = await handler(filters);
  } else {
    // Fallback: read table directly
    // Map common aliases to real table names to avoid querying non-existent tables
    const tableMap = {
      estaciones: "Estacion",
      estacion: "Estacion",
      station: "Estacion",
      stations: "Estacion",
      viaje: "Viaje",
      viajes: "Viaje",
      trips: "Viaje",
      trip: "Viaje",
      bicicleta: "Bicicleta",
      bicicletas: "Bicicleta",
      bikes: "Bicicleta",
      reserva: "Reserva",
      reservas: "Reserva",
    };
    const tableName = tableMap[normalizedName] || reportName;
    console.log(
      `[reports] No handler for '${reportName}', fallback tableName='${tableName}'`
    );
    // Check approximate count to decide if we can stream sync
    try {
      const head = await supabase
        .from(tableName)
        .select("*", { head: true, count: "exact" });
      const rowCount = head.count || 0;
      if (rowCount > MAX_ROWS_SYNC) {
        // tell caller to generate async instead
        throw new Error("TOO_LARGE");
      }
    } catch (e) {
      // ignore and try to fetch some rows
    }
    // fetch up to MAX_ROWS_SYNC
    const rows = [];
    const pageLimit = 1000;
    let page = 1;
    while (rows.length < MAX_ROWS_SYNC) {
      const offset = (page - 1) * pageLimit;
      const to = offset + pageLimit - 1;
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .range(offset, to);
      if (error) break;
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < pageLimit) break;
      page++;
    }
    const columns =
      rows && rows.length > 0 ? Object.keys(rows[0]) : ["id", "col1", "col2"];
    result = { columns, rows };
  }

  if (!result || !result.rows) {
    // nothing to write
    const sheet = workbook.addWorksheet("Data");
    sheet.addRow(["No data"]).commit();
    // must commit the worksheet before finalizing the workbook
    sheet.commit();
    await workbook.commit();
    return;
  }

  console.log(
    `[reports] Generating report '${reportName}' rows=${result.rows.length}`
  );

  // Add metadata sheet
  const meta = workbook.addWorksheet("Metadata");
  meta.addRow(["Report"]).commit();
  meta.addRow([reportName]).commit();
  meta.addRow(["Generated"]).commit();
  meta.addRow([new Date().toISOString()]).commit();
  meta.addRow(["Filters"]).commit();
  meta.addRow([JSON.stringify(filters || {})]).commit();
  meta.commit();

  // Data sheet
  const sheet = workbook.addWorksheet("Data");

  // Encabezados de tabla (ahora en la primera fila)
  const tableHeader = sheet.addRow(result.columns);
  tableHeader.font = { bold: true };
  tableHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEEF3F7" },
  };
  tableHeader.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  // Datos
  let rowIdx = 4;
  for (const r of result.rows) {
    const row = sheet.addRow(
      result.columns.map((c) => (r[c] !== undefined ? r[c] : ""))
    );
    row.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    rowIdx++;
  }

  // Ajustar ancho de columnas
  result.columns.forEach((col, i) => {
    sheet.getColumn(i + 1).width = Math.max(12, col.length + 4);
  });

  // commit the worksheet so its rows are flushed to the workbook stream
  sheet.commit();
  await workbook.commit();
}

export async function generatePdfBuffer(
  reportName = "report",
  filters = {},
  pagination = {}
) {
  // Usar el mismo handler que XLSX para obtener datos y columnas correctas
  const normalizedName = String(reportName || "").toLowerCase();
  const handler = reportHandlers[reportName] || reportHandlers[normalizedName];
  let result;
  if (handler) {
    result = await handler(filters);
  } else {
    // Fallback: leer tabla directamente
    const tableMap = {
      estaciones: "Estacion",
      estacion: "Estacion",
      station: "Estacion",
      stations: "Estacion",
      viaje: "Viaje",
      viajes: "Viaje",
      trips: "Viaje",
      trip: "Viaje",
      bicicleta: "Bicicleta",
      bicicletas: "Bicicleta",
      bikes: "Bicicleta",
      reserva: "Reserva",
      reservas: "Reserva",
    };
    const tableName = tableMap[normalizedName] || reportName;
    const { data } = await supabase.from(tableName).select("*").limit(2000);
    const columns =
      data && data.length > 0 ? Object.keys(data[0]) : ["id", "col1", "col2"];
    result = { columns, rows: data || [] };
  }

  // Convertir a array de objetos para la plantilla EJS
  const data = result && result.rows ? result.rows : [];
  const columns = result && result.columns ? result.columns : [];

  const templatePath = path.join(__dirname, "templates", "report.ejs");
  const html = await ejs.renderFile(templatePath, {
    data,
    columns,
    reportName,
    filters,
  });

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdf = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();
  return pdf;
}
