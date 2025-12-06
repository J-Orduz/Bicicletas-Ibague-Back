import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv';

// Cargar variables de entorno
console.log("[CLIENT] loading dotenv...");
dotenv.config();

/**
 * Factory Singleton para el Cliente Supabase
 * Garantiza una única instancia del cliente Supabase en toda la aplicación
 * Patrón Singleton aplicado
 */
class SupabaseClientSingleton {
  // Variable estática para almacenar la instancia única
  static instance = null;

  /**
   * Método estático para obtener la instancia única (patrón Singleton)
   * @returns {ReturnType<createClient>} La instancia única del cliente Supabase
   */
  static getInstance() {
    if (!SupabaseClientSingleton.instance) {
      console.log('🔧 Creando instancia única de Supabase Client (Singleton)');
      SupabaseClientSingleton.instance = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY
      );
      console.log('✅ Cliente Supabase configurado correctamente (Singleton)');
    } else {
      console.log('⚠️ Cliente Supabase ya existe, retornando instancia existente (Singleton)');
    }
    return SupabaseClientSingleton.instance;
  }

  /**
   * Método para resetear la instancia (útil para testing)
   */
  static resetInstance() {
    SupabaseClientSingleton.instance = null;
  }
}

// Exportar la instancia única del cliente Supabase (Singleton)
// Se crea automáticamente al importar este módulo
export const supabase = SupabaseClientSingleton.getInstance();

// También exportar la clase para acceso avanzado si es necesario
export { SupabaseClientSingleton };