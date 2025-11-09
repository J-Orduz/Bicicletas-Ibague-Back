import { authService } from '../services/auth/index.js';

export const registerUser = async (req, res) => {
  try {
    const { email, nombre } = req.body;
    
    // Validaciones básicas
    if (!email || !nombre) {
      return res.status(400).json({
        success: false,
        message: 'Email y nombre son requeridos'
      });
    }

    // Llamar al servicio de autenticación
    const result = await authService.registerUser({ email, nombre });
    
    res.status(201).json({
      success: true,
      message: 'Se ha enviado un magic link a tu correo para verificación.',
      user: {
        email: result.email,        // ✅ Solo email
        nombre: result.nombre       // ✅ Solo nombre
        // ❌ NO incluir .id porque no existe aún
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};