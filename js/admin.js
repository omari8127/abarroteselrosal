/* ================================================================
   ABARROTES EL ROSAL — Panel de administración (admin.html)
   Cambia precio, precio antes (oferta) y disponibilidad de productos,
   y el estado de los pedidos. Los permisos los revisa la base de datos
   (ver la sección "PANEL DE ADMINISTRACIÓN" de supabase/schema.sql).
   ================================================================ */

const sb = window.supabaseClient;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => `$${Number(n).toFixed(2)}`;
const normal = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Foto y nombre de categoría salen de data/productos.js
const fotoDe = new Map(catalogoBase.map(p => [p.id, p.img]));
const nombreCat = Object.fromEntries(categories.map(c => [c.id, c.label]));

let productos = [];
let filtroProd = 'todos';
let limite = 60;
let pedidos = [];
let filtroPed = 'pending';
let refresco = null;

/* ── SESIÓN ─────────────────────────────────────────────────── */
function mostrarVista(v) {
  ['login', 'denied', 'panel'].forEach(x => $('view-' + x).classList.toggle('hidden', x !== v));
}

async function iniciar() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return mostrarVista('login');

  const { data: esAdmin, error } = await sb.rpc('es_admin');
  if (error || !esAdmin) {
    $('denied-email').textContent = error
      ? 'Falta activar el panel en la base de datos: vuelve a ejecutar supabase/schema.sql.'
      : session.user.email;
    return mostrarVista('denied');
  }

  $('top-user').textContent = session.user.email;
  mostrarVista('panel');
  cargarProductos();
  cargarPedidos();
  if (!refresco) refresco = setInterval(() => { if (!document.hidden) cargarPedidos(); }, 60000);
}

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('login-btn');
  const err = $('login-error');
  err.classList.add('hidden');
  btn.disabled = true; btn.textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({
    email: $('login-email').value.trim(),
    password: $('login-pass').value,
  });
  btn.disabled = false; btn.textContent = 'Entrar';
  if (error) {
    err.textContent = 'Correo o contraseña incorrectos.';
    err.classList.remove('hidden');
    return;
  }
  iniciar();
});

async function salir() {
  await sb.auth.signOut();
  location.reload();
}

function mostrarTab(tab) {
  ['productos', 'pedidos'].forEach(t => {
    $('tab-' + t).classList.toggle('active', t === tab);
    $('panel-' + t).classList.toggle('hidden', t !== tab);
  });
  if (tab === 'pedidos') cargarPedidos();
}

/* ── PRODUCTOS ──────────────────────────────────────────────── */
$('categoria').innerHTML = '<option value="">Todas las categorías</option>'
  + categories.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('');

async function cargarProductos() {
  const { data, error } = await sb
    .from('products')
    .select('id, category, name, unit, price, old_price, active')
    .order('id');
  if (error) {
    $('prod-summary').textContent = 'No se pudieron cargar los productos: ' + error.message;
    return;
  }
  productos = data.map(p => ({ ...p, price: Number(p.price), old_price: p.old_price === null ? null : Number(p.old_price) }));
  pintarProductos();
}

function productosFiltrados() {
  const q = normal($('buscar').value.trim());
  const cat = $('categoria').value;
  return productos.filter(p =>
    (!cat || p.category === cat)
    && (!q || normal(p.name).includes(q))
    && (filtroProd === 'todos' || (filtroProd === 'oferta' ? p.old_price !== null : !p.active)));
}

function pintarProductos() {
  const lista = productosFiltrados();
  const ofertas = productos.filter(p => p.old_price !== null).length;
  const agotados = productos.filter(p => !p.active).length;
  $('prod-summary').textContent = `${lista.length} de ${productos.length} productos · ${ofertas} en oferta · ${agotados} no disponibles`;
  $('prod-list').innerHTML = lista.slice(0, limite).map(filaProducto).join('')
    || '<div class="empty">No hay productos con ese filtro.</div>';
  $('prod-more').classList.toggle('hidden', lista.length <= limite);
}

function filaProducto(p) {
  const off = p.old_price ? Math.round((1 - p.price / p.old_price) * 100) : 0;
  return `
    <div class="prod ${p.active ? '' : 'off'}" data-id="${p.id}">
      <img class="prod-img" src="${esc(fotoDe.get(p.id) || 'img/sin-foto.svg')}" alt="" loading="lazy">
      <div>
        <div class="prod-name">${esc(p.name)}</div>
        <div class="prod-meta">
          <span>${esc(nombreCat[p.category] || p.category)}${p.unit ? ' · ' + esc(p.unit) : ''}</span>
          ${off ? `<span class="tag tag-offer">-${off}%</span>` : ''}
          ${p.active ? '' : '<span class="tag tag-out">No disponible</span>'}
        </div>
      </div>
      <div>
        <span class="cell-label">Precio</span>
        <div class="money"><span>$</span><input class="input" inputmode="decimal" data-campo="price"
          value="${p.price.toFixed(2)}" aria-label="Precio de ${esc(p.name)}"></div>
        <div class="state" data-state></div>
      </div>
      <div>
        <span class="cell-label">Precio antes (oferta)</span>
        <div class="money"><span>$</span><input class="input" inputmode="decimal" data-campo="old_price"
          value="${p.old_price ? p.old_price.toFixed(2) : ''}" placeholder="Sin oferta" aria-label="Precio antes de ${esc(p.name)}"></div>
        ${p.old_price ? '<button class="link-btn quitar" data-quitar>Quitar oferta</button>' : ''}
      </div>
      <div>
        <label class="switch">
          <input type="checkbox" data-campo="active" ${p.active ? 'checked' : ''}>
          <span class="track"></span><span>${p.active ? 'Sí' : 'No'}</span>
        </label>
      </div>
    </div>`;
}

const leerMonto = v => {
  const t = String(v).trim().replace(',', '.').replace(/[^\d.]/g, '');
  return t === '' ? null : Math.round(parseFloat(t) * 100) / 100;
};

function validar(p) {
  if (p.price === null || isNaN(p.price) || p.price < 0) return 'Escribe un precio válido.';
  if (p.active && p.price <= 0) return 'Para venderlo, el precio debe ser mayor a $0.';
  if (p.old_price !== null && (isNaN(p.old_price) || p.old_price <= p.price)) return 'El precio antes debe ser mayor que el precio actual.';
  return null;
}

function estado(fila, texto, tipo) {
  const el = fila.querySelector('[data-state]');
  el.textContent = texto;
  el.className = 'state ' + tipo;
  clearTimeout(el._t);
  if (tipo === 'ok') el._t = setTimeout(() => { el.textContent = ''; }, 2500);
}

async function guardar(fila, cambios) {
  const id = Number(fila.dataset.id);
  const p = productos.find(x => x.id === id);
  const nuevo = { price: p.price, old_price: p.old_price, active: p.active, ...cambios };
  // Si no se guarda, el interruptor vuelve a mostrar lo que hay en la base
  const revertir = () => { fila.querySelector('[data-campo="active"]').checked = p.active; };
  const error = validar(nuevo);
  if (error) {
    revertir();
    estado(fila, error, 'err');
    return;
  }
  estado(fila, 'Guardando…', 'busy');
  const { data, error: errBD } = await sb
    .from('products')
    .update({ price: nuevo.price, old_price: nuevo.old_price, active: nuevo.active })
    .eq('id', id)
    .select('price, old_price, active');
  if (errBD || !data || !data.length) {
    revertir();
    estado(fila, errBD ? errBD.message : 'No tienes permiso para guardar.', 'err');
    return;
  }
  Object.assign(p, {
    price: Number(data[0].price),
    old_price: data[0].old_price === null ? null : Number(data[0].old_price),
    active: data[0].active,
  });
  fila.outerHTML = filaProducto(p);
  estado(document.querySelector(`.prod[data-id="${id}"]`), 'Guardado', 'ok');
}

// Guardar al salir del campo o con Enter
$('prod-list').addEventListener('change', e => {
  const fila = e.target.closest('.prod');
  if (!fila) return;
  const campo = e.target.dataset.campo;
  if (campo === 'active') {
    guardar(fila, { active: e.target.checked });
  } else if (campo) {
    guardar(fila, {
      price: leerMonto(fila.querySelector('[data-campo="price"]').value),
      old_price: leerMonto(fila.querySelector('[data-campo="old_price"]').value),
    });
  }
});
$('prod-list').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches('input.input')) e.target.blur();
});
$('prod-list').addEventListener('click', e => {
  if (!e.target.matches('[data-quitar]')) return;
  const fila = e.target.closest('.prod');
  const p = productos.find(x => x.id === Number(fila.dataset.id));
  guardar(fila, { price: p.old_price, old_price: null }); // vuelve al precio normal
});

$('buscar').addEventListener('input', () => { limite = 60; pintarProductos(); });
$('categoria').addEventListener('change', () => { limite = 60; pintarProductos(); });
$('filtro-prod').addEventListener('click', e => {
  const f = e.target.dataset.f;
  if (!f) return;
  filtroProd = f;
  limite = 60;
  $('filtro-prod').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.f === f));
  pintarProductos();
});
$('prod-more').addEventListener('click', () => { limite += 60; pintarProductos(); });

/* ── PEDIDOS ────────────────────────────────────────────────── */
const ESTADOS = { pending: 'Pendiente', done: 'Entregado', canceled: 'Cancelado' };

async function cargarPedidos() {
  const { data, error } = await sb
    .from('orders')
    .select('id, created_at, customer_name, phone, delivery_type, address, payment_method, notes, subtotal, savings, shipping, total, status, order_items(product_name, quantity, unit_label, total_price)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    $('ped-summary').textContent = 'No se pudieron cargar los pedidos: ' + error.message;
    return;
  }
  pedidos = data;
  const pendientes = pedidos.filter(o => o.status === 'pending').length;
  $('pend-count').textContent = pendientes;
  $('pend-count').classList.toggle('hidden', !pendientes);
  pintarPedidos();
}

function fechaPedido(iso) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  const hoy = new Date();
  const ayer = new Date(Date.now() - 864e5);
  if (d.toDateString() === hoy.toDateString()) return `Hoy, ${hora}`;
  if (d.toDateString() === ayer.toDateString()) return `Ayer, ${hora}`;
  return `${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}, ${hora}`;
}

function waCliente(o) {
  const tel = String(o.phone).replace(/\D/g, '');
  const num = tel.length === 10 ? '52' + tel : tel;
  const texto = `Hola ${o.customer_name}, te escribimos de Abarrotes El Rosal sobre tu pedido #${o.id}.`;
  return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
}

function tarjetaPedido(o) {
  const items = (o.order_items || []).map(i => `
    <div><span>${esc(i.product_name)} <span class="q">${i.unit_label ? `${Number(i.quantity)} ${esc(i.unit_label)}` : `x${Number(i.quantity)}`}</span></span>
    <span>${money(i.total_price)}</span></div>`).join('');
  const acciones = o.status === 'pending'
    ? `<button class="btn btn-sm" data-estado="done">Marcar entregado</button>
       <button class="btn btn-sm btn-cancel" data-estado="canceled">Cancelar</button>`
    : `<button class="btn btn-sm btn-soft" data-estado="pending">Regresar a pendiente</button>`;
  return `
    <article class="order" data-id="${o.id}">
      <div class="order-top">
        <span class="order-folio">#${o.id}</span>
        <span class="status status-${o.status}">${ESTADOS[o.status] || esc(o.status)}</span>
        <span class="order-time">${fechaPedido(o.created_at)}</span>
        <span class="order-total">${money(o.total)}</span>
      </div>
      <div class="order-grid">
        <div><div class="k">Cliente</div>${esc(o.customer_name)}<br><a href="${waCliente(o)}" target="_blank" rel="noopener">${esc(o.phone)}</a></div>
        <div><div class="k">Entrega</div>${o.delivery_type === 'domicilio' ? esc(o.address) : 'Recoge en tienda'}</div>
        <div><div class="k">Pago</div>${{ efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' }[o.payment_method] || o.payment_method}${Number(o.shipping) > 0 ? ` · envío ${money(o.shipping)}` : ''}</div>
      </div>
      <div class="order-items">${items}</div>
      ${o.notes ? `<div class="order-notes"><strong>Notas:</strong> ${esc(o.notes)}</div>` : ''}
      <div class="order-actions">
        ${acciones}
        <a class="btn btn-sm btn-soft" style="display:inline-flex;align-items:center;text-decoration:none" href="${waCliente(o)}" target="_blank" rel="noopener">Escribir por WhatsApp</a>
      </div>
    </article>`;
}

function pintarPedidos() {
  const lista = pedidos.filter(o => filtroPed === 'todos' || o.status === filtroPed);
  $('ped-summary').textContent = `${lista.length} pedido${lista.length === 1 ? '' : 's'}`;
  $('ped-list').innerHTML = lista.map(tarjetaPedido).join('')
    || '<div class="empty">No hay pedidos aquí.</div>';
}

$('filtro-ped').addEventListener('click', e => {
  const f = e.target.dataset.f;
  if (!f) return;
  filtroPed = f;
  $('filtro-ped').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.f === f));
  pintarPedidos();
});

$('ped-list').addEventListener('click', async e => {
  const nuevo = e.target.dataset.estado;
  if (!nuevo) return;
  const tarjeta = e.target.closest('.order');
  const id = Number(tarjeta.dataset.id);
  if (nuevo === 'canceled' && !confirm(`¿Cancelar el pedido #${id}?`)) return;
  e.target.disabled = true;
  const { data, error } = await sb.from('orders').update({ status: nuevo }).eq('id', id).select('status');
  if (error || !data || !data.length) {
    e.target.disabled = false;
    alert('No se pudo cambiar el estado: ' + (error ? error.message : 'sin permiso'));
    return;
  }
  pedidos.find(o => o.id === id).status = data[0].status;
  await cargarPedidos();
});

iniciar();
