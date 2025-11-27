import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
console.log('✅ Cliente Supabase configurado correctamente');