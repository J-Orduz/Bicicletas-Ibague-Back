// PUNTO DE ENTRADA PARA VERCEL SERVERLESS
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { initializeStationService } from "../backend/services/station/index.js";

// Cargar variables de entorno
dotenv.config();

const app = express();

// ==================== ✅ CONFIGURACIÓN GENERAL ====================

// 1. Middlewares globales
app.use(cors()); // Permite todos los orígenes

// Apply JSON body parser for all routes EXCEPT the Stripe webhook route
app.use((req, res, next) => {
  try {
    if (
      req.originalUrl &&
      req.originalUrl.startsWith("/api/payments/webhook")
    ) {
      return next();
    }
  } catch (e) {
    // ignore and continue to parse normally
  }
  return express.json()(req, res, next);
});

app.use(express.urlencoded({ extended: true }));

// 2. Rutas de sistema
app.get("/", (req, res) => {
  res.json({
    status: "✅ OK",
    service: "BiciIbagué API",
    message: "Backend desplegado en Vercel",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      users: "/api/users",
      bikes: "/api/bikes",
      bookings: "/api/booking",
      payments: "/api/payments",
      citypass: "/api/citypass",
      stations: "/api/stations",
      trips: "/api/trips",
      reports: "/api/reports"
    }
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "✅ OK",
    service: "BiciIbagué API",
    timestamp: new Date().toISOString(),
  });
});

// 3. Inicialización de servicios globales
import { eventBus } from "../backend/event-bus/index.js";

const initializeGlobalServices = () => {
  console.log("🚀 Inicializando Event-Bus y servicios...");
  
  import("../backend/services/bike/index.js").then((module) => {
    module.initBikeService();
  });

  import("../backend/services/booking/index.js").then((module) => {
    module.initBookingService();
  });
};

// Importar rutas
import userRoutes from "../backend/routes/users.js";
import bikeRoutes from "../backend/routes/bikes.js";
import bookingRoutes from "../backend/routes/bookings.js";
import paymentRoutes from "../backend/routes/payments.js";
import configRoutes from "../backend/routes/config.js";
import { reservaCleanupService } from "../backend/services/booking/reserva-cleanup.js";
import citypassRoutes from "../backend/routes/citypass.js";
import stationRoutes from "../backend/routes/station.js";
import tripRoutes from "../backend/routes/trip.js";
import reportsRoutes from "../backend/routes/reports.js";

// Usar rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const examplesDir = path.join(__dirname, "..", "backend", "examples");
app.use("/examples", express.static(examplesDir));

app.use("/api/users", userRoutes);
app.use("/api/bikes", bikeRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/config", configRoutes);
app.use("/api/citypass", citypassRoutes);
app.use("/api/stations", stationRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/reports", reportsRoutes);

// 4. Manejo global de errores
app.use((error, req, res, next) => {
  console.error("❌ Error global:", error);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.use((req, res, next) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Inicialización de MQTT solo si NO estamos en Vercel
// (Vercel no soporta conexiones persistentes como MQTT)
if (process.env.VERCEL !== "1") {
  import("../backend/iot/server-side.js").then(({ initMqttClient }) => {
    initMqttClient();
  });
}

// ==================== 🚀 INICIALIZACIÓN ====================

// Inicializar servicios después de que el servidor esté listo
const initializeServices = async () => {
  try {
    // Iniciar servicio de limpieza de reservas
    reservaCleanupService.start();
    
    // Inicializar el servicio de pagos
    const paymentModule = await import("../backend/services/payment/index.js");
    if (paymentModule.initPaymentService) {
      paymentModule.initPaymentService();
    }

    // Inicializar servicio de estaciones
    initializeStationService();

    console.log("✅ Servicios inicializados correctamente");
  } catch (err) {
    console.warn("⚠️ Error al inicializar algunos servicios:", err);
  }
};

// Solo inicializar servicios si no estamos en Vercel
// En Vercel, los servicios se inicializan con cada request (serverless)
if (process.env.VERCEL !== "1") {
  initializeServices();
}

// Exportar el handler para Vercel
export default app;
