// SERVIDOR PRINCIPAL - CONFIGURACIÓN GENERAL
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== ✅ CONFIGURACIÓN GENERAL ====================

// 1. Middlewares globales
app.use(cors()); // Permite todos los orígenes en desarrollo

// Apply JSON body parser for all routes EXCEPT the Stripe webhook route
// The webhook route uses `express.raw()` to receive the raw body required
// for Stripe signature verification. If `express.json()` runs first it will
// attempt to parse the raw payload (and fail if the body is not valid JSON
// or contains template placeholders like `{{amount}}`).
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

app.use(express.urlencoded({ extended: true })); // Decodifica formularios

// 2. Rutas de sistema (no de negocio)
app.get("/health", (req, res) => {
  res.json({
    status: "✅ OK",
    service: "BiciIbagué API",
    timestamp: new Date().toISOString(),
  });
});

// 3. Inicialización de servicios globales
import { eventBus } from "./event-bus/index.js";

const initializeGlobalServices = () => {
  console.log("🚀 Inicializando Event-Bus y servicios...");
  // Los servicios se auto-registran al importarlos
  import("./services/bike/index.js").then((module) => {
    module.initBikeService();
  });

  import("./services/booking/index.js").then((module) => {
    module.initBookingService();
  });
  /*import('./services/notification/index.js');
  import('./services/etl/index.js');*/
};

// Importar rutas
import userRoutes from "./routes/users.js";
import bikeRoutes from "./routes/bikes.js";
import bookingRoutes from "./routes/bookings.js";
import paymentRoutes from "./routes/payments.js";
import configRoutes from "./routes/config.js";
import { reservaCleanupService } from "./services/booking/reserva-cleanup.js";

// Usar rutas
// Servir ejemplos estáticos (ej. /examples/payment.html) desde el mismo origen
// Use path relative to this file so it works no matter the current working dir
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const examplesDir = path.join(__dirname, "examples");
app.use("/examples", express.static(examplesDir));

app.use("/api/users", userRoutes);
app.use("/api/bikes", bikeRoutes); ///bicicletas
app.use("/api/booking", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/config", configRoutes);

// 4. Manejo global de errores
app.use((error, req, res, next) => {
  console.error("❌ Error global:", error);
  res.status(500).json({ error: "Error interno del servidor" });
});

app.use((req, res, next) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// ==================== 🚀 INICIAR SERVIDOR ====================

app.listen(PORT, () => {
  console.log(
    `🎯 Servidor BiciIbagué ejecutándose en: http://localhost:${PORT}`
  );
  console.log(`📊 Health check: http://localhost:${PORT}/health`);

  // Inicializar servicios después de que el servidor esté listo
  reservaCleanupService.start();
  // Inicializar el servicio de pagos (y otros que necesiten arrancar)
  import("./services/payment/index.js")
    .then((module) => {
      if (module.initPaymentService) module.initPaymentService();
    })
    .catch((err) =>
      console.warn("No se pudo inicializar payment service", err)
    );
  //initializeGlobalServices();
});
