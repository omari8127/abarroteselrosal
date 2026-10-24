-- ================================================================
--  ABARROTES EL ROSAL — Esquema de base de datos (Supabase)
--  Ejecutar completo en: Supabase → SQL Editor → New query → Run.
--  Se puede volver a ejecutar sin perder datos.
--
--  Reglas de seguridad:
--  • Los precios oficiales viven en la tabla products.
--  • Los clientes NO pueden escribir directo en orders/order_items.
--    Solo pueden crear pedidos con la función crear_pedido(), que
--    calcula precios y totales aquí, no en el navegador.
--  • Cada cliente solo ve su propio perfil y sus propios pedidos.
-- ================================================================

-- ── PRODUCTOS ────────────────────────────────────────────────────
-- Se llena con supabase/productos.sql (generado desde data/productos.js).
create table if not exists public.products (
  id          integer primary key,
  category    text not null,
  name        text not null,
  unit        text,
  price       numeric(10,2) not null check (price >= 0),
  old_price   numeric(10,2) check (old_price >= 0),
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ── PERFILES ─────────────────────────────────────────────────────
create table if not exists public.perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text,
  telefono    text,
  direccion   text,
  updated_at  timestamptz not null default now()
);

-- ── PEDIDOS ──────────────────────────────────────────────────────
-- El id es el número de folio que ve el cliente y la tienda.
create table if not exists public.orders (
  id              bigint generated always as identity primary key,
  created_at      timestamptz not null default now(),
  user_id         uuid references auth.users(id) on delete set null,
  customer_name   text not null,
  phone           text not null,  -- solo dígitos
  delivery_type   text not null check (delivery_type in ('domicilio', 'tienda')),
  address         text,
  payment_method  text not null check (payment_method in ('efectivo', 'tarjeta', 'transferencia')),
  notes           text,
  subtotal        numeric(10,2) not null,  -- antes de descuentos
  savings         numeric(10,2) not null default 0,
  shipping        numeric(10,2) not null default 0,
  total           numeric(10,2) not null,
  status          text not null default 'pending' check (status in ('pending', 'done', 'canceled'))
);
create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_phone_created_idx on public.orders (phone, created_at);

create table if not exists public.order_items (
  id            bigint generated always as identity primary key,
  order_id      bigint not null references public.orders(id) on delete cascade,
  product_id    integer not null references public.products(id),
  product_name  text not null,
  unit_label    text,  -- 'kg' o 'pzas' para frutas y verduras
  quantity      numeric(10,2) not null check (quantity > 0),
  unit_price    numeric(10,2) not null,
  total_price   numeric(10,2) not null
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ── SEGURIDAD POR FILAS (RLS) ────────────────────────────────────
alter table public.products    enable row level security;
alter table public.perfiles    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Nadie escribe productos ni pedidos desde la página (solo desde el panel de Supabase).
revoke insert, update, delete, truncate on public.products, public.orders, public.order_items from anon, authenticated;
revoke all on public.perfiles from anon;

drop policy if exists "Catalogo visible para todos" on public.products;
create policy "Catalogo visible para todos" on public.products
  for select to anon, authenticated using (active);

drop policy if exists "Ver mi perfil" on public.perfiles;
create policy "Ver mi perfil" on public.perfiles
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Crear mi perfil" on public.perfiles;
create policy "Crear mi perfil" on public.perfiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "Editar mi perfil" on public.perfiles;
create policy "Editar mi perfil" on public.perfiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Ver mis pedidos" on public.orders;
create policy "Ver mis pedidos" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Ver productos de mis pedidos" on public.order_items;
create policy "Ver productos de mis pedidos" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- ── PERFIL AUTOMÁTICO AL REGISTRARSE ─────────────────────────────
-- Funciona igual con correo o con Google, aunque falte confirmar el correo.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'))
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── CÁLCULO DEL PEDIDO (privado) ─────────────────────────────────
-- Recibe solo IDs y cantidades: [{ "id": 101, "qty": 2 }, { "id": 701, "qty": 0.5, "unit": "kg" }]
-- y devuelve los renglones con precios de la tabla products y los totales.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.calcular_pedido(p_items jsonb, p_delivery_type text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c_envio constant numeric := 10.00;  -- costo de envío a domicilio
  v_item     jsonb;
  v_prod     record;
  v_id       integer;
  v_qty      numeric;
  v_unit     text;
  v_line     numeric;
  v_lines    jsonb   := '[]'::jsonb;
  v_subtotal numeric := 0;
  v_items    numeric := 0;
  v_shipping numeric := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Tu carrito está vacío.';
  end if;
  if jsonb_array_length(p_items) > 100 then
    raise exception 'El pedido tiene demasiados productos.';
  end if;
  if p_delivery_type is null or p_delivery_type not in ('domicilio', 'tienda') then
    raise exception 'Tipo de entrega inválido.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    begin
      v_id  := (v_item ->> 'id')::integer;
      v_qty := (v_item ->> 'qty')::numeric;
    exception when others then
      raise exception 'El carrito tiene datos inválidos.';
    end;
    v_unit := v_item ->> 'unit';

    select p.id, p.category, p.name, p.price, p.old_price into v_prod
    from public.products p
    where p.id = v_id and p.active and p.price > 0;
    if not found then
      raise exception 'Un producto de tu carrito ya no está disponible (ID %).', v_id;
    end if;

    if v_qty is null or v_qty <= 0 or v_qty > 99 then
      raise exception 'Cantidad inválida para %.', v_prod.name;
    end if;

    if v_prod.category = 'frutas' then
      -- Frutas y verduras: por kilo (en décimas) o por pieza (enteras)
      v_unit := coalesce(v_unit, 'kg');
      if v_unit not in ('kg', 'pzas')
         or (v_unit = 'kg' and v_qty <> round(v_qty, 1))
         or (v_unit = 'pzas' and v_qty <> trunc(v_qty)) then
        raise exception 'Cantidad inválida para %.', v_prod.name;
      end if;
    else
      v_unit := null;
      if v_qty <> trunc(v_qty) then
        raise exception 'Cantidad inválida para %.', v_prod.name;
      end if;
    end if;

    v_line     := round(v_prod.price * v_qty, 2);
    v_items    := v_items + v_line;
    v_subtotal := v_subtotal + round(coalesce(v_prod.old_price, v_prod.price) * v_qty, 2);
    v_lines    := v_lines || jsonb_build_object(
      'id', v_prod.id, 'name', v_prod.name, 'unit', v_unit, 'qty', v_qty,
      'unit_price', v_prod.price, 'line_total', v_line
    );
  end loop;

  if p_delivery_type = 'domicilio' then
    v_shipping := c_envio;
  end if;

  return jsonb_build_object(
    'items',    v_lines,
    'subtotal', v_subtotal,
    'savings',  greatest(v_subtotal - v_items, 0),
    'shipping', v_shipping,
    'total',    v_items + v_shipping
  );
end;
$$;
revoke all on function private.calcular_pedido(jsonb, text) from public, anon, authenticated;

-- ── COTIZAR (público) ────────────────────────────────────────────
-- Para mostrar el total real antes de confirmar. No guarda nada.
create or replace function public.cotizar_pedido(p_items jsonb, p_delivery_type text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.calcular_pedido(p_items, p_delivery_type);
$$;
revoke all on function public.cotizar_pedido(jsonb, text) from public;
grant execute on function public.cotizar_pedido(jsonb, text) to anon, authenticated;

-- ── CREAR PEDIDO (público) ───────────────────────────────────────
-- Única forma de guardar un pedido. Devuelve la cotización + order_id (folio).
create or replace function public.crear_pedido(
  p_items          jsonb,
  p_delivery_type  text,
  p_payment_method text,
  p_customer_name  text,
  p_phone          text,
  p_address        text default null,
  p_notes          text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name     text := btrim(coalesce(p_customer_name, ''));
  v_phone    text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_address  text := nullif(btrim(coalesce(p_address, '')), '');
  v_notes    text := nullif(btrim(coalesce(p_notes, '')), '');
  v_calc     jsonb;
  v_order_id bigint;
begin
  if length(v_name) < 2 or length(v_name) > 100 then
    raise exception 'Escribe tu nombre completo.';
  end if;
  if length(v_phone) < 7 or length(v_phone) > 15 then
    raise exception 'Escribe un teléfono válido.';
  end if;
  if p_payment_method is null or p_payment_method not in ('efectivo', 'tarjeta', 'transferencia') then
    raise exception 'Método de pago inválido.';
  end if;
  if p_delivery_type = 'domicilio' and (v_address is null or length(v_address) < 5) then
    raise exception 'Escribe tu dirección de entrega.';
  end if;
  if p_delivery_type = 'tienda' then
    v_address := null;
  end if;
  if length(v_address) > 300 or length(v_notes) > 500 then
    raise exception 'La dirección o las notas son demasiado largas.';
  end if;

  -- Freno contra pedidos falsos en serie: máximo 5 por teléfono por hora
  if (select count(*) from public.orders
      where phone = v_phone and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Recibimos varios pedidos seguidos de este teléfono. Escríbenos por WhatsApp para ayudarte.';
  end if;

  v_calc := private.calcular_pedido(p_items, p_delivery_type);

  insert into public.orders (
    user_id, customer_name, phone, delivery_type, address, payment_method, notes,
    subtotal, savings, shipping, total
  ) values (
    auth.uid(), v_name, v_phone, p_delivery_type, v_address, p_payment_method, v_notes,
    (v_calc ->> 'subtotal')::numeric, (v_calc ->> 'savings')::numeric,
    (v_calc ->> 'shipping')::numeric, (v_calc ->> 'total')::numeric
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, unit_label, quantity, unit_price, total_price)
  select v_order_id, i.id, i.name, i.unit, i.qty, i.unit_price, i.line_total
  from jsonb_to_recordset(v_calc -> 'items')
    as i(id integer, name text, unit text, qty numeric, unit_price numeric, line_total numeric);

  return v_calc || jsonb_build_object('order_id', v_order_id);
end;
$$;
revoke all on function public.crear_pedido(jsonb, text, text, text, text, text, text) from public;
grant execute on function public.crear_pedido(jsonb, text, text, text, text, text, text) to anon, authenticated;

-- ================================================================
--  PANEL DE ADMINISTRACIÓN (sitio aparte: carpeta admin/)
--  Los administradores pueden cambiar precio, precio antes (oferta)
--  y disponibilidad de productos, y el estado de los pedidos.
--  Para dar acceso a alguien, ver supabase/LEEME.md.
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
