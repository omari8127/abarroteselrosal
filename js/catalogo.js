/* ================================================================
   ABARROTES EL ROSAL — Catálogo en vivo
   Precio, precio antes (oferta) y disponibilidad salen de la base de
   datos, que es lo que se cambia en el panel (admin.html). Nombre,
   foto y descripción siguen en data/productos.js.
   Si la base de datos no responde, se usan los precios de productos.js.
   Requiere cargar antes: supabase-config.js y data/productos.js
   ================================================================ */

window.catalogReady = (async () => {
  if (!window.supabaseClient || typeof catalogoBase === 'undefined') return;
  try {
    const consulta = window.supabaseClient
      .from('products')
      .select('id, price, old_price')
      .eq('active', true);
    const limite = new Promise((_, reject) => setTimeout(() => reject(new Error('tiempo de espera agotado')), 4000));
    const { data, error } = await Promise.race([consulta, limite]);
    if (error) throw error;
    if (!data || !data.length) throw new Error('la base de datos no devolvió productos');

    const base = new Map(catalogoBase.map((p, i) => [p.id, { p, i }]));
    const enVenta = data
      .filter(r => base.has(r.id) && Number(r.price) > 0)
      .sort((a, b) => base.get(a.id).i - base.get(b.id).i) // mismo orden que productos.js
      .map(r => ({
        ...base.get(r.id).p,
        price: Number(r.price),
        oldPrice: r.old_price === null ? null : Number(r.old_price),
      }));

    // Se reemplaza el contenido (no la variable) para que todo el código siga usando allProducts
    allProducts.length = 0;
    allProducts.push(...enVenta);
  } catch (err) {
    console.warn('Catálogo: se usan los precios de data/productos.js.', err);
  }
})();

// Ejecuta fn cuando la página terminó de cargar y el catálogo está listo
window.onCatalogReady = fn => {
  const run = () => window.catalogReady.then(fn);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
};
