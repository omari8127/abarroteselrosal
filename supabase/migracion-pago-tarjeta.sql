-- ================================================================
--  MIGRACIÓN: pago con tarjeta (débito o crédito, sin comisión)
--  Ejecutar UNA vez en Supabase → SQL Editor, en el proyecto que ya
--  tiene schema.sql. Agrega 'tarjeta' como método de pago válido.
--  Se puede ejecutar más de una vez sin problema.
-- ================================================================

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('efectivo', 'tarjeta', 'transferencia'));

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
