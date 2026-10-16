// ================================================================
//  Genera supabase/productos.sql a partir de data/productos.js
//  Uso: npm run productos:sql
//  Después pega el contenido de supabase/productos.sql en
//  Supabase → SQL Editor → Run, para que los precios del servidor
//  sean los mismos que ve el cliente en la página.
// ================================================================

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'data', 'productos.js'), 'utf8');
// productos.js es un script de navegador; se evalúa para leer la lista ya filtrada
const allProducts = new Function(`${src}\n;return allProducts;`)();

const sqlText = v => (v === null || v === undefined || v === '') ? 'null' : `'${String(v).replace(/'/g, "''")}'`;
const sqlMoney = v => (typeof v === 'number' && v > 0) ? v.toFixed(2) : 'null';

const ids = new Set();
for (const p of allProducts) {
  if (!Number.isInteger(p.id)) throw new Error(`ID inválido: ${JSON.stringify(p.id)} (${p.name})`);
  if (ids.has(p.id)) throw new Error(`ID repetido: ${p.id} (${p.name})`);
  ids.add(p.id);
}

const rows = allProducts.map(p =>
  `  (${p.id}, ${sqlText(p.cat)}, ${sqlText(p.name.trim())}, ${sqlText(p.unit)}, ${p.price.toFixed(2)}, ${sqlMoney(p.oldPrice)}, true)`
);

const sql = `-- ================================================================
--  GENERADO AUTOMÁTICAMENTE por scripts/generar-sql-productos.js
--  No editar a mano: cambia data/productos.js y vuelve a generar.
--  ${allProducts.length} productos activos.
-- ================================================================

begin;

insert into public.products (id, category, name, unit, price, old_price, active) values
${rows.join(',\n')}
on conflict (id) do update set
  category   = excluded.category,
  name       = excluded.name,
  unit       = excluded.unit,
  price      = excluded.price,
  old_price  = excluded.old_price,
  active     = true,
  updated_at = now();

-- Productos que ya no están en data/productos.js (o tienen precio 0) dejan de venderse
update public.products set active = false, updated_at = now()
where active and id not in (${[...ids].join(', ')});

commit;
`;

const out = path.join(root, 'supabase', 'productos.sql');
fs.writeFileSync(out, sql);
console.log(`Listo: ${path.relative(root, out)} (${allProducts.length} productos)`);
