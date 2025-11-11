import { supabase } from '../../shared/supabase/client.js';
import { eventBus } from '../../event-bus/index.js';
import { CHANNELS } from '../../event-bus/channels.js';
import { UsuarioRegistradoEvent, UsuarioLogueadoEvent } from './events-produced.js';

export class AuthService {
  async registerUser(userData) {
    try {
      console.log('📝 Registrando usuario con email y contraseña:', userData.email);
      
      // 1. Registrar usuario en Auth
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            nombre: userData.nombre,
            fecha_registro: new Date().toISOString()
          },
          emailRedirectTo: 'http://localhost:5173/auth/callback'
        }
      });

      if (error) {
        console.error('❌ Error de Supabase:', error);
        throw error;
      }

      if (!data.user) {
        throw new Error('No se pudo crear el usuario');
      }

      // 2. CREAR PERFIL USANDO UNA FUNCIÓN SQL 
      // Evita problemas de RLS
      const { error: profileError } = await supabase.rpc('crear_perfil_usuario', {
        user_id: data.user.id,
        user_nombre: userData.nombre,
        user_email: userData.email
      });

      if (profileError) {
        console.error('❌ Error creando perfil:', profileError);
        
        // Si falla la función, intentar con inserción directa (para desarrollo)
        console.log('🔄 Intentando inserción directa...');
        const { error: directError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            nombre: userData.nombre,
            email: userData.email,
            fecha_registro: new Date().toISOString()
          });

        if (directError) {
          console.error('❌ Error en inserción directa:', directError);
          throw new Error(`Error creando perfil: ${directError.message}`);
        }
      }

      // 3. Publicar evento
      await eventBus.publish(CHANNELS.USUARIOS, UsuarioRegistradoEvent({
        id: data.user.id,
        email: userData.email,
        nombre: userData.nombre
      }));

      console.log('✅ Usuario registrado, perfil creado y evento publicado:', data.user.email);
      
      return { 
        id: data.user.id,
        email: data.user.email, 
        nombre: userData.nombre
      };

    } catch (error) {
      console.error('❌ Error en auth-service:', error);
      throw new Error(`Error al registrar usuario: ${error.message}`);
    }
  }


  // Método para login
  async loginUser(userData) {
    try {
      console.log('🔐 Iniciando sesión para:', userData.email);
      
      // 1. Autenticar con Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: userData.password
      });

      if (error) {
        console.error('❌ Error de autenticación:', error);
        throw error;
      }

      if (!data.user || !data.session) {
        throw new Error('No se pudo iniciar sesión');
      }

      // 2. Obtener perfil del usuario para obtener el nombre
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('nombre')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.error('❌ Error obteniendo perfil:', profileError);
        // No lanzamos error aquí para no bloquear el login
      }

      // 3. Publicar evento de login
      await eventBus.publish(CHANNELS.USUARIOS, UsuarioLogueadoEvent({
        id: data.user.id,
        email: data.user.email,
        nombre: profile?.nombre || 'Usuario',
        timestamp: new Date().toISOString()
      }));

      console.log('✅ Login exitoso y evento publicado:', data.user.email);
      
      return {
        user: {
          id: data.user.id,
          email: data.user.email,
          nombre: profile?.nombre || 'Usuario'
        },
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at
        }
      };

    } catch (error) {
      console.error('❌ Error en login service:', error);
      throw new Error(`Error al iniciar sesión: ${error.message}`);
    }
  }





  // Métodos adicionales para mantener la consistencia
  async getUserProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async updateUserProfile(userId, profileData) {
    const { data, error } = await supabase
      .from('profiles')
      .update(profileData)
      .eq('id', userId);

    if (error) throw error;
    return data;
  }
}

export const authService = new AuthService();
console.log('📁 Auth-Handler cargado');