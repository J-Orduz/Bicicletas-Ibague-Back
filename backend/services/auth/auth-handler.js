import { supabase } from '../../shared/supabase/client.js';
import { eventBus } from '../../event-bus/index.js';
import { CHANNELS } from '../../event-bus/channels.js';
import { UsuarioRegistradoEvent } from './events-produced.js';

export class AuthService {
  async registerUser(userData) {
    try {
      console.log('📝 Registrando usuario con magic link:', userData.email);
      
      // Magic Link (solo email)
      const { data, error } = await supabase.auth.signInWithOtp({
        email: userData.email,
        options: {
          data: {
            nombre: userData.nombre,
            fecha_registro: new Date().toISOString()
          },
          emailRedirectTo: 'http://localhost:5173'
        }
      });

      if (error) {
        console.error('❌ Error de Supabase:', error);
        throw error;
      }

      //USAR LA FUNCIÓN DEL ARCHIVO events-produced.js
      await eventBus.publish(CHANNELS.USUARIOS, UsuarioRegistradoEvent(userData));

      console.log('✅ Magic link enviado y evento publicado:', userData.email);
      
      // ✅ RETORNAR OBJETO SIN .id (porque no existe aún)
      return { 
        email: userData.email, 
        nombre: userData.nombre,
        message: 'Magic link enviado al correo' 
      };

    } catch (error) {
      console.error('❌ Error en auth-service:', error);
      throw new Error(`Error al registrar usuario: ${error.message}`);
    }
  }
}

export const authService = new AuthService();
console.log('📁 Auth-Handler cargado');