import { supabase } from "../shared/supabase/client.js";

export const extractUserFromToken = async (req, res, next) => {
  try {
    // Paso 1: Extraer header de autorización
    const authHeader = req.headers.authorization;

    // Paso 2: Validar que existe y tiene formato Bearer
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Detener la cadena - no se puede procesar sin token
      return res.status(401).json({
        success: false,
        message: 'Token de autorización requerido'
      });
    }

    // Paso 3: Extraer el token (remover "Bearer ")
    const token = authHeader.split(' ')[1];

    // Paso 4: Verificar el token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    // Paso 5: Validar que el token es válido y tiene usuario
    if (error || !user) {
      // Detener la cadena - token inválido
      return res.status(401).json({
        success: false,
        message: 'Token inválido o expirado'
      });
    }

    // Paso 6: Agregar usuario a la request para uso en handlers siguientes
    req.user = user;

    // Paso 7: Continuar con el siguiente middleware/handler en la cadena
    next();

  } catch (error) {
    // Manejo de errores inesperados - detener la cadena
    console.error('❌ Error extrayendo usuario del token:', error);
    return res.status(401).json({
      success: false,
      message: 'Error de autenticación'
    });
  }
};

export const requireRole = (allowedRoles) => {
  return async (req, res, next) => {
    // Este middleware asume que extractUserFromToken ya se ejecutó
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    // Obtener rol del usuario desde el perfil
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', req.user.id)
        .single();

      if (!profile || !allowedRoles.includes(profile.rol)) {
        return res.status(403).json({
          success: false,
          message: 'No tienes permisos para realizar esta acción'
        });
      }

      // Agregar rol al request para uso posterior
      req.user.rol = profile.rol;
      next();
    } catch (error) {
      console.error('❌ Error verificando rol:', error);
      return res.status(500).json({
        success: false,
        message: 'Error verificando permisos'
      });
    }
  };
};

