// SERVIDOR PRINCIPAL - CONFIGURACIÓN GENERAL
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== ✅ CONFIGURACIÓN GENERAL ====================

// 1. Middlewares globales
app.use(cors()); // Permite todos los orígenes en desarrollo

app.use(express.json()); // Convierte JSON automáticamente
app.use(express.urlencoded({ extended: true })); //Decodifica formularios

// 2. Rutas de sistema (no de negocio)
app.get('/health', (req, res) => {
  res.json({ 
    status: '✅ OK', 
    service: 'BiciIbagué API',
    timestamp: new Date().toISOString()
  });
});

// 3. Inicialización de servicios globales
import { eventBus } from './event-bus/index.js';

/*const initializeGlobalServices = () => {
  console.log('🚀 Inicializando Event-Bus y servicios...');
  // Los servicios se auto-registran al importarlos
  import('./services/notification/index.js');
  import('./services/etl/index.js');
};*/


// Importar rutas
import userRoutes from './routes/users.js';

// Usar rutas
app.use('/api/users', userRoutes);


// 4. Manejo global de errores
app.use((error, req, res, next) => {
  console.error('❌ Error global:', error);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.use((req, res, next) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ==================== 🚀 INICIAR SERVIDOR ====================

app.listen(PORT, () => {
  console.log(`🎯 Servidor BiciIbagué ejecutándose en: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  
  // Inicializar servicios después de que el servidor esté listo
  //initializeGlobalServices();
});



// ==================== Conectarse  ====================
/* CONEXIÓN AL BACKEND - REGISTRO DE USUARIOS:

URL: http://localhost:3000/api/users/register
Método: POST
Content-Type: application/json

DATOS REQUERIDOS:
{
  "email": "usuario@ejemplo.com",
  "nombre": "Nombre Completo"
}

✅RESPUESTA EXITOSA:
{
  "success": true,
  "message": "Se ha enviado un magic link a tu correo para verificación.",
  "user": {
    "email": "usuario@ejemplo.com",
    "nombre": "Nombre Completo"
  }
}

❌ RESPUESTA DE ERROR:
{
  "success": false,
  "message": "Descripción del error"
}*/
