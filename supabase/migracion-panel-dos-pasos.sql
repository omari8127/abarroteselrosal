-- ================================================================
--  MIGRACIÓN: panel de administrador con verificación en dos pasos
--  Ejecutar UNA vez en Supabase → SQL Editor. Desde ese momento el
--  panel pide contraseña + código de la app de autenticación; con
--  solo la contraseña la base de datos niega precios y pedidos.
--  Se puede ejecutar más de una vez sin problema.
-- ================================================================

-- ¿La cuenta con sesión está dada de alta como administrador? Solo lo usa
-- el panel para saber si debe pedir el segundo paso; no da ningún permiso.
create or replace function public.es_cuenta_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.es_cuenta_admin() from public;
grant execute on function public.es_cuenta_admin() to anon, authenticated;

-- Permiso real del panel: administrador Y sesión con verificación en dos
-- pasos (aal2 = contraseña + código de la app). Con solo la contraseña,
-- todas las reglas de abajo niegan el acceso.
create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid())
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to anon, authenticated;
