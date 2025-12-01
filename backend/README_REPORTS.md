# API de Reportes BiciIbagué

Este backend permite generar reportes en formato **Excel (XLSX)** y **PDF** sobre el sistema de bicicletas públicas de Ibagué, cumpliendo con los requisitos de HU-32.

## Endpoints disponibles

### 1. Generar reporte (XLSX o PDF)

**POST** `/api/reports`

Genera y descarga un reporte en el formato solicitado.

#### Body (JSON)

| Campo      | Tipo    | Requerido | Descripción                                                              |
| ---------- | ------- | --------- | ------------------------------------------------------------------------ |
| reportType | string  | Sí        | Formato de salida: `xlsx` o `pdf`                                        |
| reportName | string  | Sí        | Nombre del reporte (ver lista de reportes soportados abajo)              |
| filters    | objeto  | No        | Filtros a aplicar (ej: fechas, tipo, **usuario_id**)                     |
| pagination | objeto  | No        | Paginación (no requerido para la mayoría de reportes)                    |
| async      | boolean | No        | Si es `true`, genera el reporte de forma asíncrona (no implementado aún) |

---

## Ejemplos de pruebas y test

### Reporte general (todos los usuarios)

```bash
curl -X POST "http://localhost:3000/api/reports" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "xlsx",
    "reportName": "trips_per_day",
    "filters": {"dateFrom": "2025-11-01", "dateTo": "2025-11-30"}
  }' \
  --output trips-nov.xlsx
```

### Reporte personalizado por usuario (solo sus viajes)

```bash
curl -X POST "http://localhost:3000/api/reports" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "pdf",
    "reportName": "trips_per_day",
    "filters": {
      "usuario_id": "cd736d5e-c2da-4fc6-8936-3a9e4ea15f00",
      "dateFrom": "2025-11-01",
      "dateTo": "2025-11-30"
    }
  }' \
  --output mis-viajes.pdf
```

### Otros reportes soportados

```bash
curl -X POST "http://localhost:3000/api/reports" \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "xlsx",
    "reportName": "bike_demand_by_type",
    "filters": {}
  }' \
  --output demanda-bici.xlsx
```

---

---

## Reportes soportados (HU-32)

| reportName            | Descripción                                       |
| --------------------- | ------------------------------------------------- |
| `usage_frequency`     | Frecuencia de uso de bicicletas                   |
| `estaciones`          | Estaciones de mayor demanda                       |
| `stations_demand`     | Estaciones con más viajes iniciados               |
| `bike_demand_by_type` | Bicicleta de mayor demanda (Eléctrica o Mecánica) |
| `trips_per_day`       | Viajes por día                                    |
| `maintenance`         | Mantenimientos y estado de bicicletas             |

> Puedes usar también los alias: `viajes`, `bikes`, `estacion`, `bicicleta`, etc. para obtener tablas completas.

---

## Filtros disponibles

- **usuario_id**: Filtra los reportes para mostrar solo los datos asociados a ese usuario (por ejemplo, solo sus viajes). El backend busca todas las reservas de ese usuario y filtra los viajes relacionados.
- **dateFrom** y **dateTo**: Limita los resultados por fecha (formato `YYYY-MM-DD`).
- Otros filtros pueden ser agregados según el reporte (ej: tipo de bicicleta).

#### Ejemplo de filtros:

```json
{
  "usuario_id": "cd736d5e-c2da-4fc6-8936-3a9e4ea15f00",
  "dateFrom": "2025-11-01",
  "dateTo": "2025-11-30"
}
```

---

## Respuestas y formatos

- **XLSX**: Archivo Excel con dos hojas:
  - `Metadata`: información del reporte y filtros aplicados.
  - `Data`: tabla de datos con formato visual mejorado.
- **PDF**: Documento con cabecera, tabla estilizada y filtros aplicados.

---

## Errores comunes

- `413 Report too large for synchronous generation`: El reporte solicitado excede el límite de filas para generación síncrona.
- `400 reportType must be "xlsx" or "pdf"`: El tipo de reporte no es válido.
- `404 Ruta no encontrada`: Endpoint incorrecto.

---

## Notas

- El endpoint aún no soporta generación asíncrona ni almacenamiento en la nube.
- El filtrado por usuario se realiza siguiendo la relación: `Reserva.usuario_id` → `Viaje.idReserva`. Así, los reportes personalizados solo mostrarán los viajes realmente asociados al usuario autenticado.
- Para reportes personalizados adicionales, consulta el código fuente o agrega nuevos handlers en `services/report/queries.js`.

---

## Créditos

Desarrollado para HU-32: Exportación de reportes en Excel y PDF para el sistema de bicicletas públicas de Ibagué.
