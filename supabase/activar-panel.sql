-- ================================================================
--  ACTIVAR EL PANEL DE ADMINISTRADOR
--  Para bases creadas con la primera versión de schema.sql (sin la
--  tabla admins). Crea todo lo del panel: tabla de administradores,
--  permisos, pedidos en tiempo real y verificación en dos pasos.
--  Ejecutar en Supabase → SQL Editor. Se puede repetir sin problema.
--
--  ANTES de ejecutar: cambia el correo del final por el de tu cuenta
--  de administrador (debe existir en Authentication → Users).
-- ================================================================

create table if not exists public.admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

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

-- Productos: el admin ve todo (también agotados) y edita solo estas columnas
grant update (price, old_price, active) on public.products to authenticated;

drop policy if exists "Admin ve todo el catalogo" on public.products;
create policy "Admin ve todo el catalogo" on public.products
  for select to authenticated using ((select public.es_admin()));

drop policy if exists "Admin edita productos" on public.products;
create policy "Admin edita productos" on public.products
  for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

-- La oferta debe ser más barata que el precio de antes
create or replace function private.validar_producto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.old_price is not null and new.old_price <= new.price then
    raise exception 'El precio antes (%) debe ser mayor que el precio de oferta (%).', new.old_price, new.price;
  end if;
  if new.active and new.price <= 0 then
    raise exception 'Un producto disponible necesita precio mayor a 0.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists validar_producto on public.products;
create trigger validar_producto
  before update on public.products
  for each row execute function private.validar_producto();

-- Pedidos: el admin ve todos y solo puede cambiar el estado
grant update (status) on public.orders to authenticated;

drop policy if exists "Admin ve pedidos" on public.orders;
create policy "Admin ve pedidos" on public.orders
  for select to authenticated using ((select public.es_admin()));

drop policy if exists "Admin cambia estado de pedidos" on public.orders;
create policy "Admin cambia estado de pedidos" on public.orders
  for update to authenticated
  using ((select public.es_admin())) with check ((select public.es_admin()));

drop policy if exists "Admin ve productos de pedidos" on public.order_items;
create policy "Admin ve productos de pedidos" on public.order_items
  for select to authenticated using ((select public.es_admin()));

-- Pedidos en tiempo real para el panel de administrador: Supabase le avisa al
-- panel en cuanto entra un pedido. Solo lo reciben quienes pueden ver el
-- pedido según las reglas de arriba, es decir, los administradores.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ── Dar de alta al administrador (cambia el correo) ─────────────
insert into public.admins (user_id)
select id from auth.users where email = 'correo-del-admin@ejemplo.com'
on conflict (user_id) do nothing;

-- Debe mostrar tu correo; si sale vacío, el correo no coincide con ninguna cuenta
select u.email as administrador from public.admins a join auth.users u on u.id = a.user_id;
