/* ================================================================
   ABARROTES EL ROSAL — Panel de administración (sitio aparte)
   Cambia precio, precio antes (oferta) y disponibilidad de productos,
   y el estado de los pedidos. Entrar pide contraseña y un código de
   la app de autenticación (verificación en dos pasos). Los permisos
   los revisa la base de datos: ver "PANEL DE ADMINISTRACIÓN" en
   supabase/schema.sql.
   ================================================================ */

const sb = window.supabaseClient;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => `$${Number(n).toFixed(2)}`;
const normal = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Foto y nombre de categoría salen de data/productos.js de la tienda pública
let fotoDe = new Map();
let nombreCat = {};
const foto = p => fotoDe.has(p.id) ? TIENDA_URL + fotoDe.get(p.id) : 'img/sin-foto.svg';

const catalogoTienda = new Promise(resolve => {
  const s = document.createElement('script');
  s.src = `${TIENDA_URL}data/productos.js?t=${Date.now()}`;
  s.onload = () => {
    fotoDe = new Map(catalogoBase.map(p => [p.id, p.img]));
    nombreCat = Object.fromEntries(categories.map(c => [c.id, c.label]));
    $('categoria').innerHTML = '<option value="">Todas las categorías</option>'
      + categories.map(c => `<option value="${c.id}">${esc(c.label)}</option>`).join('');
    resolve();
  };
  s.onerror = () => resolve(); // sin fotos ni categorías, el panel funciona igual
  document.head.appendChild(s);
});

let productos = [];
let filtroProd = 'todos';
let limite = 60;
let pedidos = [];
let filtroPed = 'pending';
let refresco = null;

/* ── SESIÓN ─────────────────────────────────────────────────── */
function mostrarVista(v) {
  ['login', 'mfa', 'denied', 'panel'].forEach(x => $('view-' + x).classList.toggle('hidden', x !== v));
}

function negado(texto) {
  $('denied-email').textContent = texto;
  mostrarVista('denied');
}

async function iniciar() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return mostrarVista('login');

  // 1) ¿Esta cuenta es de administrador? (antes del segundo paso)
  const { data: esCuenta, error } = await sb.rpc('es_cuenta_admin');
  if (error) return negado('Falta activar la verificación en dos pasos en la base de datos: ejecuta supabase/migracion-panel-dos-pasos.sql.');
  if (!esCuenta) return negado(`${session.user.email} no es una cuenta de administrador.`);

  // 2) Segundo paso: código de la app de autenticación
  const { data: nivel } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!nivel || nivel.currentLevel !== 'aal2') {
    return nivel && nivel.nextLevel === 'aal2' ? pedirCodigo() : configurarDosPasos();
  }

  // 3) La base de datos confirma: administrador con los dos pasos
  const { data: esAdmin } = await sb.rpc('es_admin');
  if (!esAdmin) return negado('No se pudo confirmar la verificación en dos pasos. Sal y vuelve a entrar.');

  $('top-user').textContent = session.user.email;
  $('ver-tienda').href = TIENDA_URL;
  mostrarVista('panel');
  await catalogoTienda;
  cargarProductos();
  cargarPedidos();
  // El canal de tiempo real usa la sesión ya verificada en dos pasos
  sb.realtime.setAuth(session.access_token);
  escucharPedidos();
  pintarAvisos();
  // Respaldo por si el tiempo real se cae: revisa también con la pestaña en segundo plano
  if (!refresco) refresco = setInterval(cargarPedidos, 30000);
}

/* ── VERIFICACIÓN EN DOS PASOS ──────────────────────────────── */
let factorMfa = null;

function mostrarMfa(configurar) {
  $('mfa-setup').classList.toggle('hidden', !configurar);
  $('mfa-title').textContent = configurar ? 'Activa la verificación en dos pasos' : 'Verificación en dos pasos';
  $('mfa-sub').textContent = configurar
    ? 'Es obligatoria para el panel. Solo se hace una vez.'
    : 'Escribe el código de 6 dígitos de tu app de autenticación.';
  $('mfa-error').classList.add('hidden');
  $('mfa-code').value = '';
  mostrarVista('mfa');
  $('mfa-code').focus();
}

async function pedirCodigo() {
  const { data, error } = await sb.auth.mfa.listFactors();
  factorMfa = !error && data.totp.find(f => f.status === 'verified');
  if (!factorMfa) return configurarDosPasos();
  mostrarMfa(false);
}

async function configurarDosPasos() {
  // Si quedó una configuración a medias, se borra y se empieza de nuevo
  const { data: lista } = await sb.auth.mfa.listFactors();
  for (const f of (lista?.all || []).filter(f => f.factor_type === 'totp' && f.status !== 'verified')) {
    await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await sb.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Panel El Rosal ${new Date().toISOString().slice(0, 16)}`,
    issuer: 'Panel El Rosal',
  });
  if (error) return negado('No se pudo iniciar la verificación en dos pasos: ' + error.message);
  factorMfa = data;
  $('mfa-qr').src = data.totp.qr_code;
  $('mfa-secret').textContent = data.totp.secret.replace(/(.{4})/g, '$1 ').trim();
  mostrarMfa(true);
}

$('mfa-form').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('mfa-code').value.replace(/\D/g, '');
  const err = $('mfa-error');
  if (code.length !== 6) {
    err.textContent = 'El código tiene 6 dígitos.';
    err.classList.remove('hidden');
    return;
  }
  const btn = $('mfa-btn');
  btn.disabled = true; btn.textContent = 'Verificando…';
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: factorMfa.id, code });
  btn.disabled = false; btn.textContent = 'Verificar';
  if (error) {
    err.textContent = 'Código incorrecto o vencido. Escribe el que aparece ahora en la app.';
    err.classList.remove('hidden');
    $('mfa-code').select();
    return;
  }
  iniciar();
});

// Al escribir el sexto dígito se envía solo
$('mfa-code').addEventListener('input', e => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
  if (e.target.value.length === 6) $('mfa-form').requestSubmit();
});

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
  if (tab === 'pedidos') {
    cargarPedidos();
    marcarVistos();
  }
}

/* ── PRODUCTOS ──────────────────────────────────────────────── */
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
      <img class="prod-img" src="${esc(foto(p))}" alt="" loading="lazy">
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

// El tiempo real y el respaldo pueden pedir pedidos a la vez: una sola carga a la vez
let cargando = null;
let recargar = false;

async function cargarPedidos() {
  if (cargando) { recargar = true; return cargando; }
  cargando = traerPedidos();
  try { await cargando; } finally {
    cargando = null;
    if (recargar) { recargar = false; cargarPedidos(); }
  }
}

async function traerPedidos() {
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
  revisarNuevos();
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
  const esNuevo = recientes.has(o.id);
  return `
    <article class="order${esNuevo ? ' nuevo' : ''}" data-id="${o.id}">
      <div class="order-top">
        <span class="order-folio">#${o.id}</span>
        ${esNuevo ? '<span class="status status-new">Nuevo</span>' : ''}
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

/* ── AVISOS DE PEDIDOS NUEVOS ───────────────────────────────── */
// Supabase avisa al instante de cada pedido (tiempo real); el panel suena,
// muestra una tarjeta y una notificación del navegador.
let ultimoPedido = null;      // folio más alto ya visto (null = primera carga)
let sinVer = 0;
const recientes = new Set();  // folios que llevan la etiqueta "Nuevo"
const tituloBase = document.title;
let audioCtx = null;
let canal = null;

const avisosActivos = () => {
  try { return localStorage.getItem('avisos-pedidos') === 'si'; } catch { return false; }
};

function escucharPedidos() {
  if (canal) return;
  canal = sb.channel('pedidos-admin')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => cargarPedidos())
    .subscribe(estado => {
      const vivo = estado === 'SUBSCRIBED';
      $('live').classList.toggle('on', vivo);
      $('live-text').textContent = vivo ? 'En vivo' : 'Revisando cada 30 s';
      // Al reconectar se revisa por si llegó algo mientras no había conexión
      if (vivo) cargarPedidos();
    });
}

function revisarNuevos() {
  const maximo = pedidos.reduce((m, o) => Math.max(m, o.id), 0);
  if (ultimoPedido !== null) {
    const nuevos = pedidos.filter(o => o.id > ultimoPedido).reverse(); // del más viejo al más nuevo
    if (nuevos.length) avisar(nuevos);
  }
  ultimoPedido = Math.max(ultimoPedido ?? 0, maximo);
}

function avisar(nuevos) {
  sinVer += nuevos.length;
  nuevos.forEach(o => {
    recientes.add(o.id);
    setTimeout(() => { recientes.delete(o.id); pintarPedidos(); }, 10 * 60000);
    mostrarToast(o);
  });
  sonar();
  notificar(nuevos);
  pintarTitulo();
}

function pintarTitulo() {
  document.title = sinVer ? `(${sinVer}) Nuevo pedido – Panel El Rosal` : tituloBase;
}

function marcarVistos() {
  sinVer = 0;
  pintarTitulo();
}

function verPedido(id) {
  const o = pedidos.find(x => x.id === id);
  filtroPed = o && o.status !== 'pending' ? 'todos' : 'pending';
  $('filtro-ped').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.f === filtroPed));
  mostrarTab('pedidos');
  pintarPedidos();
  const tarjeta = document.querySelector(`.order[data-id="${id}"]`);
  if (tarjeta) tarjeta.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function mostrarToast(o) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.setAttribute('role', 'status');
  t.innerHTML = `
    <span class="toast-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></span>
    <div class="toast-body">
      <strong>Nuevo pedido #${o.id}</strong>
      <span>${esc(o.customer_name)} · ${money(o.total)}</span>
      <span>${o.delivery_type === 'domicilio' ? 'A domicilio' : 'Recoge en tienda'}</span>
    </div>
    <button class="btn btn-sm" data-ver>Ver</button>
    <button class="toast-x" data-cerrar aria-label="Cerrar aviso">×</button>`;
  const cerrar = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
  t.querySelector('[data-ver]').onclick = () => { verPedido(o.id); cerrar(); };
  t.querySelector('[data-cerrar]').onclick = cerrar;
  $('toasts').prepend(t);
  // Máximo 3 tarjetas a la vez; cada una se va sola en 1 minuto
  [...$('toasts').children].slice(3).forEach(x => x.remove());
  setTimeout(cerrar, 60000);
}

// Campanita "din-don" dos veces, hecha con el navegador (sin archivo de audio)
function sonar() {
  if (!avisosActivos()) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime + 0.05;
    [[0, 988], [0.2, 784], [0.7, 988], [0.9, 784]].forEach(([dt, f]) => {
      const osc = audioCtx.createOscillator();
      const vol = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      vol.gain.setValueAtTime(0.0001, t0 + dt);
      vol.gain.exponentialRampToValueAtTime(0.4, t0 + dt + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.6);
      osc.connect(vol).connect(audioCtx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.65);
    });
  } catch { /* sin sonido, quedan la tarjeta y el título */ }
}

function notificar(nuevos) {
  if (!avisosActivos() || !('Notification' in window) || Notification.permission !== 'granted') return;
  const o = nuevos[nuevos.length - 1];
  try {
    const n = new Notification(nuevos.length > 1 ? `${nuevos.length} pedidos nuevos` : `Nuevo pedido #${o.id}`, {
      body: `${o.customer_name} · ${money(o.total)} · ${o.delivery_type === 'domicilio' ? 'A domicilio' : 'Recoge en tienda'}`,
      icon: 'img/favicon.png',
      tag: 'pedido-' + o.id,
    });
    n.onclick = () => { window.focus(); verPedido(o.id); n.close(); };
  } catch { /* algunos celulares solo permiten notificaciones en apps instaladas */ }
}

async function activarAvisos() {
  if (avisosActivos() && audioCtx && audioCtx.state === 'running') {
    try { localStorage.setItem('avisos-pedidos', 'no'); } catch { }
    return pintarAvisos();
  }
  try { localStorage.setItem('avisos-pedidos', 'si'); } catch { }
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    await audioCtx.resume();
  } catch { }
  if ('Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch { }
  }
  sonar(); // suena una vez para comprobar el volumen
  pintarAvisos();
}

function pintarAvisos() {
  const activos = avisosActivos();
  const sonidoListo = !!audioCtx && audioCtx.state === 'running';
  const btn = $('avisos-btn');
  btn.classList.toggle('on', activos && sonidoListo);
  btn.classList.toggle('pendiente', activos && !sonidoListo);
  $('avisos-text').textContent = !activos ? 'Activar avisos'
    : sonidoListo ? 'Avisos activados' : 'Toca para activar el sonido';
  btn.title = activos && sonidoListo ? 'Clic para silenciar los avisos' : '';
  $('avisos-banner').classList.toggle('hidden', activos);
}

// El navegador solo deja sonar después de que tocas la página
document.addEventListener('pointerdown', e => {
  if (e.target.closest('#avisos-btn')) return; // el botón hace lo suyo en activarAvisos()
  if (!avisosActivos() || (audioCtx && audioCtx.state === 'running')) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume().then(pintarAvisos);
  } catch { }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !$('panel-pedidos').classList.contains('hidden')) marcarVistos();
});

iniciar();
