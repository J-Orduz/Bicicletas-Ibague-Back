
import { stationHandler } from "../services/station/station-handler.js";



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
//auth
const extractUserFromToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Token de autorización requerido'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verificar el token con Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido o expirado'
            });
        }

        // Agregar usuario a la request
        req.user = user;
        next();

    } catch (error) {
        console.error('❌ Error extrayendo usuario del token:', error);
        return res.status(401).json({
            success: false,
            message: 'Error de autenticación'
        });
    }
};


export const addEstacion = async (req, res) => {
    try {
        const stationData = req.body;
       const usuarioId = req.user.id;
       
        
        console.log(`📝 Registrando nueva estación por usuario: ${usuarioId}`, stationData);

        // Validaciones básicas
        if (!stationData.nombre || !stationData.posicion) {
            return res.status(400).json({
                success: false,
                message: 'nombre y/o posición son requeridos'
            });
        }
        const resultado = await stationHandler.addStation(stationData);

        res.status(201).json({
            success: true,
            message: 'Estación registrada exitosamente',
            data: resultado
        });

    } catch (error) {
        console.error('❌ Error registrando estación:', error);

        let statusCode = 400;
        let message = error.message;

        res.status(statusCode).json({
            success: false,
            message: message
        });
    }
};

export const addEstacionAuth = [extractUserFromToken, addEstacion];

