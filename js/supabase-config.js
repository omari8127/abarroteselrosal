/* ================================================================
   ABARROTES EL ROSAL — Supabase Configuration
   Reemplaza las variables con tus credenciales de Supabase
   (Project Settings → API). Ver supabase/LEEME.md.
   La llave publishable es pública a propósito; NUNCA pongas aquí
   la llave secret / service_role.
   ================================================================ */

const SUPABASE_URL  = 'https://igjhhojtfwzyunymeopt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jVcB8ix_xwVmuPDby-QDeA_EkVFBMpv';

// Inicializar cliente de Supabase (requiere SDK cargado antes en el HTML)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exponer globalmente
window.supabaseClient = _supabase;
