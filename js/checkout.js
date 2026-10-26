// ================================================================
//  ABARROTES EL ROSAL - Checkout Logic
// ================================================================

const WA_NUMBER = '526645187312';
const SHIPPING_FEE = 10.00;

let ckCart = {};
let ckDelivery = 'domicilio'; // 'domicilio' | 'tienda'
let ckPayment = 'efectivo';  // 'efectivo' | 'tarjeta' | 'transferencia'

const PAGO_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta (débito o crédito)', transferencia: 'Transferencia' };

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Esperar los precios de la base de datos (js/catalogo.js)
  await (window.catalogReady || Promise.resolve());
  ckCart = syncCartWithCatalog(JSON.parse(localStorage.getItem('cart')) || {});
  renderSummary();
  if (Object.keys(ckCart).length === 0) showEmptyPage();
  cargarPuntos();
});

// ── EMPTY STATE ──────────────────────────────────────────────────
function showEmptyPage() {
  const wrap = document.getElementById('ck-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="ck-empty-page" style="grid-column:1/-1">
      <div class="big-icon"></div>
      <h2>Tu carrito está vacío</h2>
      <p>Agrega productos antes de finalizar tu pedido.</p>
      <a href="productos.html">Ver catálogo</a>
    </div>`;
}

// ── ORDER SUMMARY ────────────────────────────────────────────────
function renderSummary() {
  const items = Object.values(ckCart);
  const container = document.getElementById('ck-sum-items');
  const totals = document.getElementById('ck-sum-totals');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '<div class="ck-empty-cart">Tu carrito está vacío</div>';
    if (totals) totals.style.display = 'none';
    document.getElementById('ck-puntos').hidden = true;
    return;
  }

  const subtotal = items.reduce((s, i) => s + totalLinea(i.oldPrice || i.price, i.qty), 0);
  let total = items.reduce((s, i) => s + totalLinea(i.price, i.qty), 0);
  const savings = subtotal - total;

  // Puntos: no se pueden usar más de los que tiene ni más que el total de productos
  ckProductos = total;
  ckPuntos = Math.min(ckPuntos, puntosMaximos());
  const descuentoPuntos = descuentoDePuntos(ckPuntos);
  total -= descuentoPuntos;
  const ptsRow = document.getElementById('ck-points-row');
  if (ptsRow) {
    ptsRow.style.display = descuentoPuntos > 0 ? 'flex' : 'none';
    document.getElementById('ck-points-label').textContent = `Puntos (${ckPuntos})`;
    document.getElementById('ck-points').textContent = `-$${descuentoPuntos.toFixed(2)}`;
  }
  pintarPuntos();

  container.innerHTML = items.map(i => {
    const qtyLabel = i.unitLabel ? textoCantidadFruta(i.qty, i.unitLabel) : `x${i.qty}`;
    const porUnidad = i.unitLabel === 'kg' ? 'el kilo' : 'c/u';
    const imgHtml = i.img
      ? `<img src="${i.img}" alt="${i.name}" onerror="this.style.display='none'">`
      : `<span style="font-size:1.5rem">${i.emoji || ''}</span>`;
    return `
      <div class="ck-sum-item">
        <div class="ck-sum-img">${imgHtml}</div>
        <div class="ck-sum-info">
          <div class="ck-sum-name">${i.name}</div>
          <div class="ck-sum-qty">${qtyLabel} · $${i.price.toFixed(2)} ${porUnidad}${i.aprox ? ' · aprox.' : ''}</div>
        </div>
        <div class="ck-sum-price">${i.aprox ? '≈ ' : ''}$${totalLinea(i.price, i.qty).toFixed(2)}</div>
      </div>`;
  }).join('');

  if (totals) {
    totals.style.display = 'block';
    
    // Shipping logic
    const shippingRow = document.getElementById('ck-shipping-row');
    const shippingEl = document.getElementById('ck-shipping');
    if (ckDelivery === 'domicilio') {
      total += SHIPPING_FEE;
      if (shippingRow) shippingRow.style.display = 'flex';
      if (shippingEl) shippingEl.textContent = `$${SHIPPING_FEE.toFixed(2)}`;
    } else {
      if (shippingRow) shippingRow.style.display = 'none';
    }

    document.getElementById('ck-subtotal').textContent = `$${subtotal.toFixed(2)}`;
    document.getElementById('ck-total').textContent = `$${total.toFixed(2)}`;
    const savRow = document.getElementById('ck-savings-row');
    const savEl = document.getElementById('ck-savings');
    if (savings > 0) {
      savEl.textContent = `-$${savings.toFixed(2)}`;
      savRow.style.display = 'flex';
    } else {
      savRow.style.display = 'none';
    }
  }
}

// ── PUNTOS ───────────────────────────────────────────────────────
// Mismas reglas que "PROGRAMA DE PUNTOS" en supabase/schema.sql: con cuenta se
// gana 1 punto por cada $10 al recibir el pedido (+50 el primer pedido) y cada
// 50 puntos son $10 de descuento. El servidor valida el saldo al crear el pedido.
const PUNTOS = { porCanje: 50, pesosPorCanje: 10, pesosPorPunto: 10, bono: 50 };
let ckSesion = false;   // ¿el cliente entró a su cuenta?
let ckSaldo = 0;        // puntos que tiene
let ckTieneBono = false;
let ckPuntos = 0;       // puntos que quiere usar en este pedido
let ckProductos = 0;    // total de productos (después de ofertas)

const descuentoDePuntos = puntos => (puntos / PUNTOS.porCanje) * PUNTOS.pesosPorCanje;
const puntosMaximos = () => Math.min(
  Math.floor(ckSaldo / PUNTOS.porCanje),
  Math.floor(ckProductos / PUNTOS.pesosPorCanje)
) * PUNTOS.porCanje;
const puntosQueGana = () => Math.floor((ckProductos - descuentoDePuntos(ckPuntos)) / PUNTOS.pesosPorPunto);

async function cargarPuntos() {
  if (!window.supabaseClient) return;
  try {
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    ckSesion = !!session;
    if (ckSesion) {
      const { data } = await window.supabaseClient.rpc('mis_puntos');
      if (data) {
        ckSaldo = data.saldo;
        ckTieneBono = data.tiene_bono;
      }
    }
  } catch (err) {
    console.warn('Puntos: no se pudo consultar el saldo.', err);
  }
  renderSummary();
}

function pintarPuntos() {
  const el = document.getElementById('ck-puntos');
  if (!el || !Object.keys(ckCart).length || !window.supabaseClient) return;
  el.hidden = false;
  const gana = puntosQueGana();
  const bono = ckSesion && !ckTieneBono ? ` + ${PUNTOS.bono} de regalo por tu primer pedido` : '';

  if (!ckSesion) {
    el.innerHTML = `
      <div class="ck-puntos-top"><strong>Gana ${gana + PUNTOS.bono} puntos con este pedido</strong></div>
      <p><a href="mi-cuenta.html">Inicia sesión o crea tu cuenta</a> para juntarlos: 1 punto por cada $10 y 50 de regalo en tu primer pedido. Cada 50 puntos son $10 de descuento.</p>`;
    return;
  }

  const max = puntosMaximos();
  const usar = max > 0 ? `
      <div class="ck-puntos-usar">
        <span>Usar en este pedido</span>
        <span class="ck-puntos-ctrl">
          <button type="button" onclick="cambiarPuntos(-1)" aria-label="Usar menos puntos" ${ckPuntos <= 0 ? 'disabled' : ''}>−</button>
          <span>${ckPuntos ? `${ckPuntos} · −$${descuentoDePuntos(ckPuntos).toFixed(2)}` : 'Ninguno'}</span>
          <button type="button" onclick="cambiarPuntos(1)" aria-label="Usar más puntos" ${ckPuntos >= max ? 'disabled' : ''}>+</button>
        </span>
      </div>` : '';
  const faltan = PUNTOS.porCanje - (ckSaldo % PUNTOS.porCanje);
  el.innerHTML = `
      <div class="ck-puntos-top"><strong>Tus puntos</strong><span class="ck-puntos-saldo">${ckSaldo} pts</span></div>
      ${ckSaldo < PUNTOS.porCanje ? `<p>Te faltan ${faltan} para tu primer descuento de $10.</p>` : ''}
      ${usar}
      <p class="ck-puntos-gana">Al recibir este pedido ganas ${gana} puntos${bono}.</p>`;
}

function cambiarPuntos(dir) {
  ckPuntos = Math.max(0, Math.min(puntosMaximos(), ckPuntos + dir * PUNTOS.porCanje));
  renderSummary();
}

// ── DELIVERY TOGGLE ──────────────────────────────────────────────
function setDelivery(mode) {
  ckDelivery = mode;
  document.getElementById('btn-domicilio').classList.toggle('ck-active', mode === 'domicilio');
  document.getElementById('btn-tienda').classList.toggle('ck-active', mode === 'tienda');

  const addrBlock = document.getElementById('address-block');
  const pickupInfo = document.getElementById('pickup-info');

  if (mode === 'domicilio') {
    addrBlock.classList.remove('hidden');
    addrBlock.style.maxHeight = '1400px';
    addrBlock.style.opacity = '1';
    pickupInfo.style.display = 'none';
    iniciarMapa();
  } else {
    addrBlock.classList.add('hidden');
    addrBlock.style.maxHeight = '0';
    addrBlock.style.opacity = '0';
    pickupInfo.style.display = 'block';
    // Clear address errors when hiding
    ['field-zona', 'field-calle', 'field-num', 'field-colonia'].forEach(f => clearError(f));
  }
  renderSummary();
}

// ── ZONA DE ENTREGA ──────────────────────────────────────────────
// A domicilio solo se entrega a máximo 1 km (en línea recta) de la tienda.
// El cliente marca su casa en el mapa o usa su ubicación; la liga de Google
// Maps de ese punto va en el pedido para el repartidor.
// Las coordenadas son el centro de Calle Huatulco (OpenStreetMap); para
// afinarlas, copia las de la tienda desde Google Maps.
const TIENDA = { lat: 32.51251, lng: -116.97653, radioKm: 1 };
let ckUbicacion = null;  // { lat, lng, km } de la casa del cliente
let ckMapa = null;
let ckPin = null;

function distanciaKm(a, b) {
  const rad = g => g * Math.PI / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const textoDistancia = km => km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1)} km`;
const ligaMapa = u => `https://maps.google.com/?q=${u.lat.toFixed(6)},${u.lng.toFixed(6)}`;
const dentroDeZona = () => !!ckUbicacion && ckUbicacion.km <= TIENDA.radioKm;

const iconoPin = clase => L.divIcon({
  className: '',
  html: `<svg class="ck-pin ${clase}" viewBox="0 0 24 24" fill="currentColor" stroke="#fff" stroke-width="1.5"><path d="M12 22s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="10" r="2.6" fill="#fff" stroke="none"/></svg>`,
  iconSize: [0, 0],
});

function iniciarMapa() {
  const el = document.getElementById('ck-mapa');
  if (!el || typeof L === 'undefined') return;
  if (ckMapa) {
    setTimeout(() => ckMapa.invalidateSize(), 380); // el bloque se acaba de desplegar
    return;
  }
  const tienda = L.latLng(TIENDA.lat, TIENDA.lng);
  ckMapa = L.map(el, { scrollWheelZoom: false }).setView(tienda, 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(ckMapa);
  L.circle(tienda, {
    radius: TIENDA.radioKm * 1000, color: '#004795', weight: 2, fillColor: '#004795', fillOpacity: 0.07,
  }).addTo(ckMapa);
  L.marker(tienda, { icon: iconoPin('tienda'), keyboard: false })
    .bindTooltip('Abarrotes El Rosal', { direction: 'top', offset: [0, -30] })
    .addTo(ckMapa);
  ckMapa.fitBounds(tienda.toBounds(TIENDA.radioKm * 2000), { padding: [8, 8] }); // el círculo completo
  ckMapa.on('click', e => marcarCasa(e.latlng.lat, e.latlng.lng));
}

function marcarCasa(lat, lng) {
  if (!ckMapa) return;
  if (!ckPin) {
    ckPin = L.marker([lat, lng], { icon: iconoPin('casa'), draggable: true }).addTo(ckMapa);
    ckPin.on('dragend', () => {
      const p = ckPin.getLatLng();
      marcarCasa(p.lat, p.lng);
    });
  } else {
    ckPin.setLatLng([lat, lng]);
  }
  ckUbicacion = { lat, lng, km: distanciaKm(TIENDA, { lat, lng }) };
  clearError('field-zona');
  pintarZona();
}

function usarMiUbicacion() {
  const btn = document.getElementById('ck-zona-btn');
  const estado = document.getElementById('ck-zona-estado');
  if (!navigator.geolocation) {
    estado.textContent = 'Tu navegador no comparte la ubicación. Toca el mapa para marcar tu casa.';
    return;
  }
  btn.disabled = true;
  estado.className = 'ck-zona-estado';
  estado.textContent = 'Buscando tu ubicación…';
  navigator.geolocation.getCurrentPosition(pos => {
    btn.disabled = false;
    const { latitude: lat, longitude: lng } = pos.coords;
    if (ckMapa) ckMapa.setView([lat, lng], Math.max(ckMapa.getZoom(), 16));
    marcarCasa(lat, lng);
  }, () => {
    btn.disabled = false;
    estado.textContent = 'No pudimos obtener tu ubicación. Toca el mapa para marcar tu casa.';
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}

function pintarZona() {
  const estado = document.getElementById('ck-zona-estado');
  if (!estado) return;
  if (!ckUbicacion) {
    estado.className = 'ck-zona-estado';
    estado.textContent = 'Toca el mapa para marcar tu casa o usa tu ubicación.';
  } else if (dentroDeZona()) {
    estado.className = 'ck-zona-estado ok';
    estado.textContent = `Tu casa está a ${textoDistancia(ckUbicacion.km)} de la tienda: sí te lo llevamos. Puedes mover el pin si no quedó exacto.`;
  } else {
    estado.className = 'ck-zona-estado fuera';
    estado.innerHTML = `Estás a ${textoDistancia(ckUbicacion.km)} de la tienda y solo entregamos a máximo 1 km.
      <button type="button" onclick="setDelivery('tienda')">Recoger en tienda</button>`;
  }
}

// ── PAYMENT TOGGLE ───────────────────────────────────────────────
function setPayment(method) {
  ckPayment = method;
  Object.keys(PAGO_LABELS).forEach(m =>
    document.getElementById(`pay-${m}`).classList.toggle('selected', method === m));
  const note = document.getElementById('transfer-note');
  note.classList.toggle('show', method === 'transferencia');
}

// ── VALIDATION ───────────────────────────────────────────────────
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function setError(fieldId, show) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  if (show) el.classList.add('has-error');
  else el.classList.remove('has-error');
}

function clearError(fieldId) { setError(fieldId, false); }

function validateForm() {
  let ok = true;

  // Nombre
  const nombre = getVal('inp-nombre');
  setError('field-nombre', !nombre);
  if (!nombre) ok = false;

  // Teléfono – accept digits, spaces, dashes, parens
  const tel = getVal('inp-tel');
  const telOk = /^[\d\s\-\(\)\+]{7,}$/.test(tel);
  setError('field-tel', !telOk);
  if (!telOk) ok = false;

  // Address only if delivery mode
  if (ckDelivery === 'domicilio') {
    const calle = getVal('inp-calle');
    setError('field-calle', !calle);
    if (!calle) ok = false;

    const num = getVal('inp-num');
    setError('field-num', !num);
    if (!num) ok = false;

    const colonia = getVal('inp-colonia');
    setError('field-colonia', !colonia);
    if (!colonia) ok = false;

    // La casa marcada en el mapa debe estar a máximo 1 km de la tienda
    if (!dentroDeZona()) {
      setError('field-zona', true);
      if (!ckUbicacion) {
        const estado = document.getElementById('ck-zona-estado');
        estado.className = 'ck-zona-estado fuera';
        estado.textContent = 'Marca tu casa en el mapa para confirmar que está dentro de la zona de entrega.';
      }
      ok = false;
    }
  }

  return ok;
}

// ── SERVIDOR (SUPABASE) ──────────────────────────────────────────
// Al servidor solo se mandan IDs y cantidades: los precios y el total
// los calcula la base de datos (ver supabase/schema.sql).
function cartToServerItems() {
  return Object.entries(ckCart).map(([key, i]) => ({
    id: parseInt(key, 10),               // '701_kg' → 701
    qty: Number(Number(i.qty).toFixed(3)), // frutas por kilo: ¼ kg, 100 g…
    unit: i.unitLabel || null              // 'kg' | 'pzas' en frutas y verduras
  }));
}

// { data } si salió bien, { error } si el servidor rechazó el pedido
// (mensaje para el cliente) u { offline } si no se pudo conectar.
async function callServer(fn, args) {
  if (!window.supabaseClient) return { offline: true };
  try {
    const { data, error } = await window.supabaseClient.rpc(fn, args);
    if (!error) return { data };
    if (error.code === 'P0001') return { error: error.message };
    console.error(`Supabase ${fn}:`, error);
    return { offline: true };
  } catch (err) {
    console.error(`Supabase ${fn}:`, err);
    return { offline: true };
  }
}

// Mismo formato que devuelve el servidor, calculado con el carrito local.
// Solo se usa si no hay conexión; el pedido se marca como no registrado.
function localQuote() {
  const items = cartToServerItems().map(({ id, qty, unit }, n) => {
    const i = Object.values(ckCart)[n];
    return { id, name: i.name, unit, qty, unit_price: i.price, line_total: totalLinea(i.price, qty), old_price: i.oldPrice, approx: !!i.aprox };
  });
  const subtotal = items.reduce((s, i) => s + totalLinea(i.old_price || i.unit_price, i.qty), 0);
  const itemsTotal = items.reduce((s, i) => s + i.line_total, 0);
  const shipping = ckDelivery === 'domicilio' ? SHIPPING_FEE : 0;
  const pointsDiscount = descuentoDePuntos(ckPuntos);
  return {
    items, subtotal, savings: subtotal - itemsTotal, shipping,
    points_used: ckPuntos, points_discount: pointsDiscount,
    points_earned: Math.floor((itemsTotal - pointsDiscount) / PUNTOS.pesosPorPunto),
    total: itemsTotal - pointsDiscount + shipping,
  };
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const money = n => `$${Number(n).toFixed(2)}`;
const qtyLabel = i => i.unit ? textoCantidadFruta(Number(i.qty), i.unit) : `x${i.qty}`;
const conAprox = i => i.approx ? `≈ ${money(i.line_total)}` : money(i.line_total);

// ── CONFIRM ORDER ────────────────────────────────────────────────
async function confirmOrder() {
  if (!Object.keys(ckCart).length) {
    alert('Tu carrito está vacío.');
    return;
  }

  if (!validateForm()) {
    // Scroll to first error
    const firstErr = document.querySelector('.has-error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const nombre = getVal('inp-nombre');
  const tel = getVal('inp-tel');
  const notas = getVal('inp-notas');

  let entregaLabel = 'Recoger en tienda';
  if (ckDelivery === 'domicilio') {
    const calle = getVal('inp-calle');
    const num = getVal('inp-num');
    const colonia = getVal('inp-colonia');
    const refs = getVal('inp-refs');
    entregaLabel = `${calle} ${num}, Col. ${colonia}${refs ? ' — ' + refs : ''}`;
  }

  const pagoLabel = PAGO_LABELS[ckPayment];

  // Pedir al servidor el total real antes de mostrar el resumen
  const btn = document.querySelector('.ck-confirm-btn');
  const btnText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = 'Calculando total...'; }
  const res = await callServer('cotizar_pedido', { p_items: cartToServerItems(), p_delivery_type: ckDelivery, p_points: ckPuntos });
  if (btn) { btn.disabled = false; btn.innerHTML = btnText; }

  if (res.error) {
    alert(res.error);
    return;
  }
  const quote = res.offline ? localQuote() : res.data;
  const localTotal = localQuote().total;
  const pricesChanged = !res.offline && Math.abs(Number(quote.total) - localTotal) > 0.005;

  // Fill modal
  const setText = (id, text) => { document.getElementById(id).textContent = text; };
  setText('modal-cliente', nombre);
  setText('modal-tel', tel);
  setText('modal-pago', pagoLabel);
  const alEntregar = ckDelivery === 'tienda' ? 'Pagas al recoger' : 'Pagas al recibir';
  setText('modal-pago-sub', {
    efectivo: alEntregar,
    tarjeta: `Sin comisión · ${alEntregar.toLowerCase()}`,
    transferencia: 'Te enviamos los datos por WhatsApp'
  }[ckPayment]);
  const tag = document.getElementById('modal-entrega-tag');
  if (ckDelivery === 'tienda') {
    setText('modal-entrega', 'Abarrotes El Rosal · Calle Huatulco 13609, Anexa 20 de Noviembre');
    tag.textContent = 'Recoger en tienda · listo en 10-20 min';
    tag.classList.add('green');
  } else {
    setText('modal-entrega', entregaLabel);
    tag.textContent = `Entrega a domicilio · a ${textoDistancia(ckUbicacion.km)} de la tienda`;
    tag.classList.remove('green');
  }

  // Foto y precio anterior salen del carrito; el precio que cuenta es el del servidor
  // (una fruta puede venir dos veces: por kilo y por pieza, por eso la llave lleva la unidad)
  const fromCart = {};
  Object.entries(ckCart).forEach(([key, i]) => { fromCart[`${parseInt(key, 10)}|${i.unitLabel || ''}`] = i; });
  const piezas = quote.items.reduce((s, i) => s + (i.unit === 'kg' ? 1 : Number(i.qty)), 0);
  setText('modal-count', `${quote.items.length} ${quote.items.length === 1 ? 'producto' : 'productos'} · ${piezas} ${piezas === 1 ? 'pieza' : 'piezas'}`);
  document.getElementById('modal-items').innerHTML = quote.items.map(i => {
    const c = fromCart[`${i.id}|${i.unit || ''}`] || {};
    const img = c.img
      ? `<img src="${escHtml(c.img)}" alt="" onerror="this.remove()">`
      : '';
    const old = Number(c.oldPrice) > Number(i.unit_price) ? `<s>${money(c.oldPrice)}</s>` : '';
    const badge = i.unit ? qtyLabel(i).replace(' pzas', '').replace(' pza', '') : `x${i.qty}`;
    const porUnidad = i.unit === 'kg' ? 'el kilo' : 'c/u';
    return `
      <div class="ck-mp">
        <div class="ck-mp-img">${img}<span class="ck-mp-qty">${escHtml(badge)}</span></div>
        <div class="ck-mp-info">
          <div class="ck-mp-name">${escHtml(i.name)}</div>
          <div class="ck-mp-meta">${qtyLabel(i)} · ${money(i.unit_price)} ${porUnidad}${old}</div>
        </div>
        <div class="ck-mp-price">${conAprox(i)}</div>
      </div>`;
  }).join('');
  // Frutas y verduras se pesan al surtir: el total puede moverse unos pesos
  document.getElementById('modal-aprox').hidden = !quote.items.some(i => i.approx);

  // Productos (precio normal) − Ahorros + Envío = Total
  const row = (label, value, cls = '') =>
    `<div class="ck-mi ${cls}"><span>${label}</span><span class="ck-mi-price">${value}</span></div>`;
  const hasSavings = Number(quote.savings) > 0;
  document.getElementById('modal-totals').innerHTML =
    row('Productos', money(quote.subtotal))
    + (hasSavings ? row('Ahorros', `-${money(quote.savings)}`, 'savings') : '')
    + (Number(quote.points_discount) > 0 ? row(`Puntos (${quote.points_used})`, `-${money(quote.points_discount)}`, 'savings') : '')
    + (Number(quote.shipping) > 0 ? row('Envío', money(quote.shipping)) : row('Envío', 'Sin costo'))
    + (ckSesion ? row('Puntos que ganas al recibirlo', `+${Number(quote.points_earned) + (ckTieneBono ? 0 : PUNTOS.bono)}`, 'earn') : '');
  document.getElementById('modal-savings').hidden = !hasSavings;
  setText('modal-savings-amount', money(quote.savings));
  setText('modal-total', money(quote.total));
  setText('modal-wa-total', money(quote.total));
  setText('modal-total-note', Number(quote.shipping) > 0 ? 'Incluye envío a domicilio' : 'Recoges en tienda');

  const sub = document.getElementById('ck-modal-sub');
  if (sub) {
    sub.textContent = pricesChanged
      ? 'Algunos precios se actualizaron. Revisa el total.'
      : 'Revisa los detalles antes de enviarlo';
    sub.classList.toggle('changed', pricesChanged);
  }

  // Store for WA
  // La dirección que se guarda lleva la liga del punto marcado en el mapa (la ve el panel)
  const direccion = ckDelivery === 'domicilio'
    ? `${entregaLabel} · Ubicación: ${ligaMapa(ckUbicacion)} (a ${textoDistancia(ckUbicacion.km)})`
    : null;
  window._ckOrder = { nombre, tel, notas, entregaLabel, direccion, pagoLabel, quote, offline: !!res.offline };

  // Open modal
  document.getElementById('ck-modal').classList.add('open');
}

// ── WHATSAPP FINAL ───────────────────────────────────────────────
async function sendWAFinal() {
  const o = window._ckOrder;
  if (!o) return;

  const btn = document.getElementById('modal-wa-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>Procesando...</span>';

  // Guardar el pedido; el servidor devuelve el folio y el total oficial
  let quote = o.quote;
  let folio = null;
  if (!o.offline) {
    const res = await callServer('crear_pedido', {
      p_items: cartToServerItems(),
      p_delivery_type: ckDelivery,
      p_payment_method: ckPayment,
      p_customer_name: o.nombre,
      p_phone: o.tel,
      p_address: o.direccion,
      p_notes: o.notas || null,
      p_points: Number(o.quote.points_used) || 0
    });
    if (res.error) {
      alert(res.error);
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }
    if (res.data) {
      quote = res.data;
      folio = res.data.order_id;
    }
  }

  let msg = folio
    ? `*Pedido #${folio} – Abarrotes El Rosal*\n\n`
    : `*Pedido – Abarrotes El Rosal*\n*ATENCIÓN:* _sin registrar en el sistema (sin conexión). Confirmar precios._\n\n`;
  msg += `*Cliente:* ${o.nombre}\n`;
  msg += `*Teléfono:* ${o.tel}\n`;

  if (ckDelivery === 'domicilio') {
    msg += `*Entrega:* ${o.entregaLabel}\n`;
    msg += `*Ubicación:* ${ligaMapa(ckUbicacion)} (a ${textoDistancia(ckUbicacion.km)} de la tienda)\n`;
  } else {
    msg += `*Entrega:* Recoger en tienda (Calle Huatulco 13609, Anexa 20 de Noviembre)\n`;
    msg += `*Tiempo estimado:* Pasar por el producto en 10-20 minutos.\n`;
  }

  msg += `*Pago:* ${o.pagoLabel}\n\n`;
  msg += `*Productos*\n`;

  quote.items.forEach(i => {
    msg += `• ${i.name} ${qtyLabel(i)} — ${conAprox(i)}\n`;
  });
  if (quote.items.some(i => i.approx)) {
    msg += `_Frutas y verduras: precio aproximado, se cobra lo que pese al surtir._\n`;
  }

  msg += `\nProductos: ${money(quote.subtotal)}\n`;
  if (Number(quote.savings) > 0) msg += `Ahorros: -${money(quote.savings)}\n`;
  if (Number(quote.points_discount) > 0) msg += `Puntos usados: ${quote.points_used} (-${money(quote.points_discount)})\n`;
  if (Number(quote.shipping) > 0) msg += `Envío: ${money(quote.shipping)}\n`;
  msg += `*TOTAL: ${money(quote.total)}*\n`;

  if (o.notas) msg += `\n*Notas:* ${o.notas}`;

  // Restaurar botón después de un momento
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = originalText;
    // Limpiar carrito tras éxito
    localStorage.removeItem('cart');
    window._ckOrder = null;
    window.location.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  }, 1000);
}

// ── MODAL CONTROLS ────────────────────────────────────────────────
function closeModal() {
  document.getElementById('ck-modal').classList.remove('open');
}

function closeModalOutside(e) {
  if (e.target === document.getElementById('ck-modal')) closeModal();
}

// ── INIT ADDRESS BLOCK CORRECTLY ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set initial max-height for transition to work
  const addrBlock = document.getElementById('address-block');
  if (addrBlock) {
    addrBlock.style.maxHeight = '1400px';
    addrBlock.style.opacity = '1';
  }
  if (ckDelivery === 'domicilio') iniciarMapa();
});
