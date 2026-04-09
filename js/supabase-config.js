/* ================================================================
   ABARROTES EL ROSAL — Supabase Configuration
   Reemplaza las variables con tus credenciales de Supabase
   ================================================================ */

const SUPABASE_URL  = 'https://nyxzfboowawkldmhjmfe.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yxWZ9tUQZwQL7wa8J2dgyw__0zv1StA';

// Inicializar cliente de Supabase (requiere SDK cargado antes en el HTML)
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exponer globalmente
window.supabaseClient = _supabase;
