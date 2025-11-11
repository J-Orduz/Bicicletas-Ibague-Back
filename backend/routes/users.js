import express from 'express';
import { registerUser, loginUser, getUserProfile, updateUserProfile } from '../controllers/userController.js';

const router = express.Router();

// Ruta para registro de usuarios
router.post('/register', registerUser);

// Ruta para Login de usuarios
router.post('/login', loginUser);

export default router;