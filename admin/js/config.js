/* ================================================================
   PANEL EL ROSAL — Configuración
   El panel es un sitio aparte de la tienda, conectado a la misma base
   de datos de Supabase. La llave publishable es pública a propósito;
   NUNCA pongas aquí la llave secret / service_role.
   ================================================================ */

const SUPABASE_URL = 'https://igjhhojtfwzyunymeopt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_jVcB8ix_xwVmuPDby-QDeA_EkVFBMpv';

window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Tienda pública: de ahí salen las fotos y categorías del catálogo.
// En la computadora (npm run dev) la tienda y el panel corren juntos.
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
window.TIENDA_URL = LOCAL ? location.origin + '/' : 'https://abarroteselrosal.vercel.app/';
