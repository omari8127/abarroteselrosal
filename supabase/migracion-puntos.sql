-- ================================================================
--  MIGRACIÓN: programa de puntos
--  Ejecutar UNA vez en Supabase → SQL Editor. Se puede repetir.
--  • 1 punto por cada $10 cuando el pedido se marca como Entregado
--  • 50 puntos extra con el primer pedido entregado
--  • 50 puntos = $10 de descuento al hacer el pedido
-- ================================================================

-- Puntos que el cliente usó en el pedido y el descuento que le dieron (ver PROGRAMA DE PUNTOS)
alter table public.orders add column if not exists points_used integer not null default 0 check (points_used >= 0);
alter table public.orders add column if not exists points_discount numeric(10,2) not null default 0 check (points_discount >= 0);

-- Tabla y funciones de puntos (van primero: el cálculo del pedido las usa)
create table if not exists public.puntos_movimientos (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  order_id    bigint references public.orders(id) on delete set null,
  tipo        text not null check (tipo in ('compra', 'bono_primer_pedido', 'canje', 'devolucion_canje')),
  puntos      integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists puntos_movimientos_user_idx on public.puntos_movimientos (user_id, created_at desc);
-- Un movimiento de cada tipo por pedido, y un solo bono de primer pedido por cliente
create unique index if not exists puntos_un_tipo_por_pedido on public.puntos_movimientos (order_id, tipo) where order_id is not null;
create unique index if not exists puntos_un_bono_por_cliente on public.puntos_movimientos (user_id) where tipo = 'bono_primer_pedido';

-- Nadie escribe aquí desde la página: solo las funciones de abajo
alter table public.puntos_movimientos enable row level security;
revoke all on public.puntos_movimientos from anon, authenticated;
grant select on public.puntos_movimientos to authenticated;
drop policy if exists "Ver mis puntos" on public.puntos_movimientos;
create policy "Ver mis puntos" on public.puntos_movimientos
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function private.saldo_puntos(p_user uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(puntos), 0)::integer from public.puntos_movimientos where user_id = p_user;
$$;
revoke all on function private.saldo_puntos(uuid) from public, anon, authenticated;

-- Saldo e historial del cliente con sesión (Mi cuenta y checkout)
create or replace function public.mis_puntos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'saldo', private.saldo_puntos(auth.uid()),
    'tiene_bono', exists (select 1 from public.puntos_movimientos
                          where user_id = auth.uid() and tipo = 'bono_primer_pedido'),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('tipo', m.tipo, 'puntos', m.puntos, 'pedido', m.order_id, 'fecha', m.created_at)
                       order by m.created_at desc, m.id desc)
      from (select * from public.puntos_movimientos where user_id = auth.uid()
            order by created_at desc, id desc limit 50) m
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.mis_puntos() from public;
grant execute on function public.mis_puntos() to authenticated;

-- Cálculo, cotización y creación del pedido con puntos
-- p_points: puntos que el cliente quiere usar (de 50 en 50; ver PROGRAMA DE PUNTOS)
drop function if exists private.calcular_pedido(jsonb, text);
create or replace function private.calcular_pedido(p_items jsonb, p_delivery_type text, p_points integer default 0)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c_envio constant numeric := 10.00;  -- costo de envío a domicilio
  c_puntos_canje    constant integer := 50;   -- cada 50 puntos…
  c_pesos_canje     constant numeric := 10;   -- …son $10 de descuento
  c_pesos_por_punto constant numeric := 10;   -- se gana 1 punto por cada $10
  v_points   integer := coalesce(p_points, 0);
  v_discount numeric := 0;
  v_item     jsonb;
  v_prod     record;
  v_id       integer;
  v_qty      numeric;
  v_unit     text;
  v_price    numeric;
  v_old      numeric;
  v_approx   boolean;
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

    select p.id, p.category, p.name, p.price, p.old_price, p.sale_unit, p.piece_kg into v_prod
    from public.products p
    where p.id = v_id and p.active and p.price > 0;
    if not found then
      raise exception 'Un producto de tu carrito ya no está disponible (ID %).', v_id;
    end if;

    if v_qty is null or v_qty <= 0 or v_qty > 99 then
      raise exception 'Cantidad inválida para %.', v_prod.name;
    end if;

    v_price  := v_prod.price;
    v_old    := coalesce(v_prod.old_price, v_prod.price);
    v_approx := false;

    if v_prod.category = 'frutas' then
      -- Frutas y verduras (ver data/productos.js):
      --   en kilos: múltiplos de 50 g, al precio del kilo (se pesa al surtir)
      --   en piezas de algo que se vende por kilo: cada pieza = precio_99(kilo × piece_kg)
      --   en piezas de algo que se vende por pieza: al precio de la pieza
      v_unit := coalesce(v_unit, case when v_prod.sale_unit = 'pza' then 'pzas' else 'kg' end);
      if v_unit = 'kg' and coalesce(v_prod.sale_unit, 'kg') = 'kg' and v_qty * 20 = trunc(v_qty * 20) then
        v_approx := true;
      elsif v_unit = 'pzas' and v_qty = trunc(v_qty) and v_prod.sale_unit = 'pza' then
        null;
      elsif v_unit = 'pzas' and v_qty = trunc(v_qty) and coalesce(v_prod.sale_unit, 'kg') = 'kg'
            and v_prod.piece_kg is not null then
        v_price  := private.precio_99(v_prod.price * v_prod.piece_kg);
        v_old    := case when v_prod.old_price is null then v_price
                         else greatest(private.precio_99(v_prod.old_price * v_prod.piece_kg), v_price) end;
        v_approx := true;
      else
        raise exception 'Cantidad inválida para %.', v_prod.name;
      end if;
    else
      v_unit := null;
      if v_qty <> trunc(v_qty) then
        raise exception 'Cantidad inválida para %.', v_prod.name;
      end if;
    end if;

    v_line     := round(v_price * v_qty, 2);
    v_items    := v_items + v_line;
    v_subtotal := v_subtotal + round(v_old * v_qty, 2);
    v_lines    := v_lines || jsonb_build_object(
      'id', v_prod.id, 'name', v_prod.name, 'unit', v_unit, 'qty', v_qty,
      'unit_price', v_price, 'line_total', v_line, 'approx', v_approx
    );
  end loop;

  if p_delivery_type = 'domicilio' then
    v_shipping := c_envio;
  end if;

  -- Puntos: solo con sesión, de 50 en 50, sin pasar del saldo ni del total de productos
  if v_points <> 0 then
    if v_points < 0 or v_points % c_puntos_canje <> 0 then
      raise exception 'Los puntos se usan de % en %.', c_puntos_canje, c_puntos_canje;
    end if;
    if auth.uid() is null then
      raise exception 'Inicia sesión para usar tus puntos.';
    end if;
    if v_points > private.saldo_puntos(auth.uid()) then
      raise exception 'No tienes suficientes puntos.';
    end if;
    v_discount := (v_points / c_puntos_canje) * c_pesos_canje;
    if v_discount > v_items then
      raise exception 'El descuento con puntos no puede ser mayor que tus productos.';
    end if;
  end if;

  return jsonb_build_object(
    'items',    v_lines,
    'subtotal', v_subtotal,
    'savings',  greatest(v_subtotal - v_items, 0),
    'shipping', v_shipping,
    'points_used',     v_points,
    'points_discount', v_discount,
    'points_earned',   floor((v_items - v_discount) / c_pesos_por_punto),  -- al entregarlo (con cuenta)
    'total',    v_items - v_discount + v_shipping
  );
end;
$$;
revoke all on function private.calcular_pedido(jsonb, text, integer) from public, anon, authenticated;

-- ── COTIZAR (público) ────────────────────────────────────────────
-- Para mostrar el total real antes de confirmar. No guarda nada.
drop function if exists public.cotizar_pedido(jsonb, text);
create or replace function public.cotizar_pedido(p_items jsonb, p_delivery_type text, p_points integer default 0)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.calcular_pedido(p_items, p_delivery_type, p_points);
$$;
revoke all on function public.cotizar_pedido(jsonb, text, integer) from public;
grant execute on function public.cotizar_pedido(jsonb, text, integer) to anon, authenticated;

-- ── CREAR PEDIDO (público) ───────────────────────────────────────
-- Única forma de guardar un pedido. Devuelve la cotización + order_id (folio).
-- p_points: puntos que el cliente usa en este pedido (se descuentan de su saldo).
drop function if exists public.crear_pedido(jsonb, text, text, text, text, text, text);
create or replace function public.crear_pedido(
  p_items          jsonb,
  p_delivery_type  text,
  p_payment_method text,
  p_customer_name  text,
  p_phone          text,
  p_address        text default null,
  p_notes          text default null,
  p_points         integer default 0
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

  -- Dos pedidos al mismo tiempo no pueden gastar los mismos puntos
  if coalesce(p_points, 0) > 0 and auth.uid() is not null then
    perform pg_advisory_xact_lock(hashtext('puntos:' || auth.uid()::text));
  end if;

  v_calc := private.calcular_pedido(p_items, p_delivery_type, p_points);

  insert into public.orders (
    user_id, customer_name, phone, delivery_type, address, payment_method, notes,
    subtotal, savings, shipping, total, points_used, points_discount
  ) values (
    auth.uid(), v_name, v_phone, p_delivery_type, v_address, p_payment_method, v_notes,
    (v_calc ->> 'subtotal')::numeric, (v_calc ->> 'savings')::numeric,
    (v_calc ->> 'shipping')::numeric, (v_calc ->> 'total')::numeric,
    (v_calc ->> 'points_used')::integer, (v_calc ->> 'points_discount')::numeric
  )
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, unit_label, quantity, unit_price, total_price)
  select v_order_id, i.id, i.name, i.unit, i.qty, i.unit_price, i.line_total
  from jsonb_to_recordset(v_calc -> 'items')
    as i(id integer, name text, unit text, qty numeric, unit_price numeric, line_total numeric);

  -- Los puntos usados se descuentan del saldo (si se cancela el pedido, se regresan)
  if (v_calc ->> 'points_used')::integer > 0 then
    insert into public.puntos_movimientos (user_id, order_id, tipo, puntos)
    values (auth.uid(), v_order_id, 'canje', -(v_calc ->> 'points_used')::integer);
  end if;

  return v_calc || jsonb_build_object('order_id', v_order_id);
end;
$$;
revoke all on function public.crear_pedido(jsonb, text, text, text, text, text, text, integer) from public;
grant execute on function public.crear_pedido(jsonb, text, text, text, text, text, text, integer) to anon, authenticated;

-- Puntos al cambiar el estado del pedido
-- Al cambiar el estado de un pedido (panel de administrador) se suman o regresan puntos
create or replace function private.puntos_por_estado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_pesos_por_punto constant numeric := 10;
  c_bono            constant integer := 50;
  v_ganados integer;
begin
  if new.user_id is null or new.status = old.status then
    return new;
  end if;

  if new.status = 'done' then
    -- Entregado: puntos de la compra y, si es su primer pedido entregado, el bono
    v_ganados := floor((new.total - new.shipping) / c_pesos_por_punto);
    if v_ganados > 0 then
      insert into public.puntos_movimientos (user_id, order_id, tipo, puntos)
      values (new.user_id, new.id, 'compra', v_ganados)
      on conflict do nothing;
    end if;
    insert into public.puntos_movimientos (user_id, order_id, tipo, puntos)
    values (new.user_id, new.id, 'bono_primer_pedido', c_bono)
    on conflict do nothing;  -- solo hay un bono por cliente
  elsif old.status = 'done' then
    -- Dejó de estar entregado: se quitan los puntos que ganó con este pedido
    delete from public.puntos_movimientos
    where order_id = new.id and tipo in ('compra', 'bono_primer_pedido');
  end if;

  if new.status = 'canceled' and new.points_used > 0 then
    -- Cancelado: se regresan los puntos que usó
    insert into public.puntos_movimientos (user_id, order_id, tipo, puntos)
    values (new.user_id, new.id, 'devolucion_canje', new.points_used)
    on conflict do nothing;
  elsif old.status = 'canceled' then
    -- Se reactivó un pedido cancelado: los puntos vuelven a estar usados
    delete from public.puntos_movimientos where order_id = new.id and tipo = 'devolucion_canje';
  end if;

  return new;
end;
$$;
revoke all on function private.puntos_por_estado() from public, anon, authenticated;
drop trigger if exists puntos_por_estado on public.orders;
create trigger puntos_por_estado
  after update of status on public.orders
  for each row execute function private.puntos_por_estado();

-- Debe mostrar 0 puntos repartidos y la tabla lista
select count(*) as movimientos_de_puntos from public.puntos_movimientos;
