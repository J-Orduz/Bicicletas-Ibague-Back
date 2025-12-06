import { stationHandler } from "../services/station/station-handler.js";
// Importar middleware centralizado (Chain of Responsibility)
import { extractUserFromToken } from '../middleware/auth.js';

// === CONTROLADORES DE CONSULTA ===

export const getEstaciones = async (req, res) => {
    try {
        console.log('🏢 Obteniendo lista de estaciones...');
        const data = await stationHandler.getAllStations();

        res.json(data);
    } catch (error) {
        console.error('❌ Error obteniendo estaciones:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener las estaciones'
        });
    }
};



export const getStationById = async (req, res) => {
    try {
        const estacionId = req.params.id;

        console.log(`🏢 Obteniendo estación con ID: ${estacionId}`);


        if (!estacionId) {
            return res.status(400).json({
                success: false,
                message: 'ID de estación es requerido'
            });
        }


        const resultado = await stationHandler.getStationById(estacionId);

        res.status(200).json({
            success: true,
            message: 'Estación obtenida exitosamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error en controlador de estación ', error);

        let statusCode = 400;
        let message = error.message;

        res.status(statusCode).json({
            success: false,
            message: message
        });
    }
};

export const createStation = async (req, res) => {
    try {
        const estacion = req.body

        console.log(`🏢 Creando estación`);


        if (!estacion) {
            return res.status(400).json({
                success: false,
                message: 'El campo no puede estar vacío'
            });
        }


        const resultado = await stationHandler.createStation(estacion);

        res.status(200).json({
            success: true,
            message: 'Estación creada exitosamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error en controlador de estación ', error);

        let statusCode = 400;
        let message = error.message;

        res.status(statusCode).json({
            success: false,
            message: message
        });
    }
};


// Aplicar middleware a las rutas protegidas
export const adicionarEstacionAuth = [extractUserFromToken, createStation];
export const obtenerEstacionIdAuth = [extractUserFromToken, getStationById];
export const obtenerEstacionesAuth = [extractUserFromToken, getEstaciones];

