import { authService } from '../services/auth/index.js';
import { supabase } from "../shared/supabase/client.js";

// Middleware para extraer usuario del token
export const extractUserFromToken = async (req, res, next) => {
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

export const registerUser = async (req, res) => {
  try {
    const { email, nombre, password } = req.body;
    
    console.log('📨 Datos recibidos:', { email, nombre, password: password ? '***' : 'undefined' });
    
    // Validaciones básicas
    if (!email || !nombre || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email, nombre y contraseña son requeridos'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'El formato del email no es válido'
      });
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Llamar al servicio de autenticación
    const result = await authService.registerUser({ email, nombre, password });
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente. Revisa tu email para verificación.',
      user: {
        id: result.id,            
        email: result.email,
        nombre: result.nombre
      }
    });

  } catch (error) {
    console.error('❌ Error en registro:', error);
    
    // Manejar errores específicos
    if (error.message.includes('User already registered')) {
      return res.status(400).json({
        success: false,
        message: 'Este email ya está registrado'
      });
    }
    
    if (error.message.includes('Invalid email')) {
      return res.status(400).json({
        success: false,
        message: 'El formato del email no es válido'
      });
    }

    if (error.message.includes('RLS')) {
      return res.status(500).json({
        success: false,
        message: 'Error de configuración. Contacta al administrador.'
      });
    }
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


//Controlador para login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔐 Intento de login:', { email, password: password ? '***' : 'undefined' });
    
    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'El formato del email no es válido'
      });
    }

    // Llamar al servicio de autenticación para login
    const result = await authService.loginUser({ email, password });
    
    res.status(200).json({
      success: true,
      message: 'Inicio de sesión exitoso',
      user: {
        id: result.user.id,
        email: result.user.email,
        nombre: result.user.nombre,
        rol: result.user.rol
      },
      session: {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
        expires_at: result.session.expires_at
      }
    });

  } catch (error) {
    console.error('❌ Error en login:', error);
    
    // Manejar errores específicos de Supabase
    if (error.message.includes('Invalid login credentials')) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas. Verifica tu email y contraseña.'
      });
    }
    
    if (error.message.includes('Email not confirmed')) {
      return res.status(401).json({
        success: false,
        message: 'Email no confirmado. Revisa tu correo para verificar tu cuenta.'
      });
    }
    
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// Controlador para obtener perfil
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id; // Asumiendo que tienes middleware de autenticación
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    const profile = await authService.getUserProfile(userId);
    
    res.json({
      success: true,
      profile
    });

  } catch (error) {
    console.error('❌ Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


//Controlador para actualizar perfil
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { nombre } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es requerido'
      });
    }

    const updatedProfile = await authService.updateUserProfile(userId, { nombre });
    
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      profile: updatedProfile
    });

  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// Controlador para obtener puntos del usuario
export const getPuntosUsuario = async (req, res) => {
  try {
    const usuarioId = req.user?.id;

    if (!usuarioId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    // Consultar los puntos del usuario desde la tabla profiles
    const { data: perfil, error } = await supabase
      .from('profiles')
      .select('puntos, nombre, email')
      .eq('id', usuarioId)
      .single();

    if (error) {
      console.error('❌ Error consultando puntos:', error);
      return res.status(404).json({
        success: false,
        message: 'No se encontró el perfil del usuario'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Puntos obtenidos exitosamente',
      data: {
        puntos: perfil.puntos || 0,
        nombre: perfil.nombre,
        email: perfil.email
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo puntos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener puntos'
    });
  }
};