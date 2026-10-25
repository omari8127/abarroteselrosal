// ================================================================
//  Genera supabase/productos.sql a partir de data/productos.js
//  Uso: npm run productos:sql
//  Después pega el contenido de supabase/productos.sql en
//  Supabase → SQL Editor → Run.
//
//  Productos nuevos: se agregan con el precio de data/productos.js.
//  Productos que ya existen: solo se actualiza nombre, categoría, unidad
//  y cómo se venden las frutas y verduras (por kilo/pieza y peso de la pieza).
//  El precio, la oferta y la disponibilidad se manejan desde el panel
//  (panel de administrador), así que este script nunca los sobrescribe.
// ================================================================

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'data', 'productos.js'), 'utf8');
// productos.js es un script de navegador; se evalúa para leer la lista completa
const allProducts = new Function(`${src}\n;return catalogoBase;`)();

const sqlText = v => (v === null || v === undefined || v === '') ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const sqlMoney = v => (typeof v === 'number' && v > 0) ? v.toFixed(2) : 'null';

const ids = new Set();
for (const p of allProducts) {
  if (!Number.isInteger(p.id)) throw new Error(`ID inválido: ${JSON.stringify(p.id)} (${p.name})`);
  if (ids.has(p.id)) throw new Error(`ID repetido: ${p.id} (${p.name})`);
  ids.add(p.id);
  // Todos los precios terminan en .99 (los sin precio, 0.00, no se venden)
  for (const v of [p.price, p.oldPrice]) {
    if (v > 0 && !v.toFixed(2).endsWith('.99')) throw new Error(`Precio sin .99: ${v} (${p.id} ${p.name})`);
  }
  if (p.cat === 'frutas' && !['kg', 'pza'].includes(p.venta)) throw new Error(`Fruta sin venta 'kg' o 'pza': ${p.id} ${p.name}`);
}

// Los productos sin precio entran como no disponibles; se activan desde el panel
const rows = allProducts.map(p => {
  const venta = p.cat === 'frutas' ? sqlText(p.venta) : 'null';
  const pieza = p.cat === 'frutas' && p.pesoPza ? p.pesoPza.toFixed(3) : 'null';
  return `  (${p.id}, ${sqlText(p.cat)}, ${sqlText(p.name.trim())}, ${sqlText(p.unit)}, ${venta}, ${pieza}, ${p.price.toFixed(2)}, ${sqlMoney(p.oldPrice)}, ${p.price > 0})`;
});

const sql = `-- ================================================================
--  GENERADO AUTOMÁTICAMENTE por scripts/generar-sql-productos.js
--  No editar a mano: cambia data/productos.js y vuelve a generar.
--  ${allProducts.length} productos.
-- ================================================================

begin;

insert into public.products (id, category, name, unit, sale_unit, piece_kg, price, old_price, active) values
${rows.join(',\n')}
on conflict (id) do update set
  category  = excluded.category,
  name      = excluded.name,
  unit      = excluded.unit,
  sale_unit = excluded.sale_unit,
  piece_kg  = excluded.piece_kg;
-- (precio, oferta y disponibilidad no se tocan: se manejan desde el panel)

-- Productos que ya no están en data/productos.js dejan de venderse
update public.products set active = false
where active and id not in (${[...ids].join(', ')});

commit;
`;

const out = path.join(root, 'supabase', 'productos.sql');
fs.writeFileSync(out, sql);
console.log(`Listo: ${path.relative(root, out)} (${allProducts.length} productos)`);
