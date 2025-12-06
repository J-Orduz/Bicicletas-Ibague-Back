import express from 'express';
import { registerUser, loginUser, getUserProfile, updateUserProfile, getPuntosUsuario } from '../controllers/userController.js';
import { extractUserFromToken } from '../middleware/auth.js';

const router = express.Router();

// Ruta para registro de usuarios
router.post('/register', registerUser);

// Ruta para Login de usuarios
router.post('/login', loginUser);

// Ruta para puntos
router.get('/puntos', extractUserFromToken, getPuntosUsuario);

export default router;