import {getAuthSupabase} from "@supabase/supabase-js"

export const client=getAuthSupabase(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY);
