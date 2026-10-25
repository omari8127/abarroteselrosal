-- ================================================================
--  MIGRACIÓN: precios en .99 y frutas y verduras por kilo o pieza
--  Ejecutar UNA vez en Supabase → SQL Editor. Se puede repetir.
--
--  1. Todos los precios (y el "precio antes" de las ofertas) quedan en
--     .99, al .99 más cercano: $18.70 → $18.99, $8.00 → $7.99.
--     Desde el panel, cualquier precio que escribas se guarda en .99.
--  2. Frutas y verduras: precio por kilo (Calimax Tijuana, oct 2026) o
--     por pieza, y el peso aproximado de una pieza para pedir por pieza.
--  3. El cálculo del pedido cobra bien kilos y piezas.
-- ================================================================

-- Frutas y verduras: cómo se venden (ver "FRUTAS Y VERDURAS" en data/productos.js)
--   sale_unit 'kg':  price es por kilo; piece_kg = peso aproximado de una pieza
--   sale_unit 'pza': price es por pieza
alter table public.products add column if not exists sale_unit text check (sale_unit in ('kg', 'pza'));
alter table public.products add column if not exists piece_kg numeric(6,3) check (piece_kg > 0);

-- Todos los precios terminan en .99 (al .99 más cercano): 44.90 → 44.99, 8.00 → 7.99.
-- Misma regla que precio99() en data/productos.js.
create or replace function private.precio_99(n numeric)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select greatest(0.99, round(n + 0.01) - 0.01);
$$;
revoke all on function private.precio_99(numeric) from public, anon, authenticated;

-- Precios en .99 y la oferta más barata que el precio de antes
create or replace function private.validar_producto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Todos los precios terminan en .99 (misma regla que private.precio_99; aquí va
  -- escrita porque el trigger corre con la cuenta del admin, sin acceso a private)
  if new.price > 0 then
    new.price := greatest(0.99, round(new.price + 0.01) - 0.01);
  end if;
  if new.old_price is not null then
    new.old_price := greatest(0.99, round(new.old_price + 0.01) - 0.01);
  end if;
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

-- Frutas y verduras: nombre, forma de venta, peso de la pieza y precio por kilo/pieza
update public.products p set
  name      = v.name,
  unit      = v.unit,
  sale_unit = v.sale_unit,
  piece_kg  = v.piece_kg,
  price     = v.price,
  old_price = null
from (values
  (701, 'Plátano Portalimón', 'kg', 'kg', 0.180, 29.99),
  (702, 'Tomate Saladette', 'kg', 'kg', 0.120, 52.99),
  (703, 'Cebolla Blanca', 'kg', 'kg', 0.250, 46.99),
  (704, 'Pepino', 'kg', 'kg', 0.300, 19.99),
  (705, 'Limón Persa', 'kg', 'kg', 0.070, 26.99),
  (706, 'Naranja Sin Semilla', 'kg', 'kg', 0.250, 29.99),
  (707, 'Lechuga Bola', 'pza', 'pza', null, 26.99),
  (708, 'Chile Serrano', 'kg', 'kg', null, 44.99),
  (709, 'Cebolla Morada', 'kg', 'kg', 0.250, 32.99),
  (710, 'Chile Jalapeño', 'kg', 'kg', 0.040, 25.99),
  (711, 'Ajo', 'kg', 'kg', 0.050, 118.99),
  (712, 'Manzana Roja', 'kg', 'kg', 0.200, 54.99),
  (713, 'Papa Blanca', 'kg', 'kg', 0.250, 48.99),
  (714, 'Aguacate Hass', 'kg', 'kg', 0.220, 59.99)
) as v(id, name, unit, sale_unit, piece_kg, price)
where p.id = v.id;

-- Todos los demás precios a .99 (la oferta sigue siendo más barata que el precio de antes)
update public.products set
  price     = private.precio_99(price),
  old_price = case when old_price is null then null
                   else greatest(private.precio_99(old_price), private.precio_99(price) + 1) end
where price > 0
  and (price <> private.precio_99(price) or old_price <> private.precio_99(old_price));

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

-- Debe salir 0: productos a la venta cuyo precio no termina en .99
select count(*) as precios_sin_99 from public.products
where price > 0 and (price <> private.precio_99(price) or old_price <> private.precio_99(old_price));
