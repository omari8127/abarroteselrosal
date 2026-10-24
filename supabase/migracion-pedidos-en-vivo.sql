-- ================================================================
--  MIGRACIÓN: pedidos en tiempo real en el panel de administrador
--  Ejecutar UNA vez en Supabase → SQL Editor. Hace que los pedidos
--  nuevos lleguen al instante al panel (con sonido y aviso).
--  Se puede ejecutar más de una vez sin problema.
-- ================================================================

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
