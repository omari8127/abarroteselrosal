// ================================================================
//  ABARROTES EL ROSAL - Checkout Logic
// ================================================================

const WA_NUMBER = '526645187312';
const SHIPPING_FEE = 10.00;

let ckCart = {};
let ckDelivery = 'domicilio'; // 'domicilio' | 'tienda'
let ckPayment = 'efectivo';  // 'efectivo' | 'transferencia'

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ckCart = syncCartWithCatalog(JSON.parse(localStorage.getItem('cart')) || {});
  renderSummary();
  if (Object.keys(ckCart).length === 0) showEmptyPage();
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
    return;
  }

  const subtotal = items.reduce((s, i) => s + (i.oldPrice || i.price) * i.qty, 0);
  let total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const savings = subtotal - total;

  container.innerHTML = items.map(i => {
    const qtyLabel = i.unitLabel ? `${i.qty} ${i.unitLabel}` : `x${i.qty}`;
    const imgHtml = i.img
      ? `<img src="${i.img}" alt="${i.name}" onerror="this.style.display='none'">`
      : `<span style="font-size:1.5rem">${i.emoji || ''}</span>`;
    return `
      <div class="ck-sum-item">
        <div class="ck-sum-img">${imgHtml}</div>
        <div class="ck-sum-info">
          <div class="ck-sum-name">${i.name}</div>
          <div class="ck-sum-qty">${qtyLabel} · $${i.price.toFixed(2)} c/u</div>
        </div>
        <div class="ck-sum-price">$${(i.price * i.qty).toFixed(2)}</div>
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

// ── DELIVERY TOGGLE ──────────────────────────────────────────────
function setDelivery(mode) {
  ckDelivery = mode;
  document.getElementById('btn-domicilio').classList.toggle('ck-active', mode === 'domicilio');
  document.getElementById('btn-tienda').classList.toggle('ck-active', mode === 'tienda');

  const addrBlock = document.getElementById('address-block');
  const pickupInfo = document.getElementById('pickup-info');

  if (mode === 'domicilio') {
    addrBlock.classList.remove('hidden');
    addrBlock.style.maxHeight = '600px';
    addrBlock.style.opacity = '1';
    pickupInfo.style.display = 'none';
  } else {
    addrBlock.classList.add('hidden');
    addrBlock.style.maxHeight = '0';
    addrBlock.style.opacity = '0';
    pickupInfo.style.display = 'block';
    // Clear address errors when hiding
    ['field-calle', 'field-num', 'field-colonia'].forEach(f => clearError(f));
  }
  renderSummary();
}

// ── PAYMENT TOGGLE ───────────────────────────────────────────────
function setPayment(method) {
  ckPayment = method;
  document.getElementById('pay-efectivo').classList.toggle('selected', method === 'efectivo');
  document.getElementById('pay-transferencia').classList.toggle('selected', method === 'transferencia');
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
  }

  return ok;
}

// ── SERVIDOR (SUPABASE) ──────────────────────────────────────────
// Al servidor solo se mandan IDs y cantidades: los precios y el total
// los calcula la base de datos (ver supabase/schema.sql).
function cartToServerItems() {
  return Object.entries(ckCart).map(([key, i]) => ({
    id: parseInt(key, 10),               // '701_kg' → 701
    qty: Math.round(i.qty * 10) / 10,    // frutas por kg van en décimas
    unit: i.unitLabel || null
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
    return { id, name: i.name, unit, qty, unit_price: i.price, line_total: i.price * qty, old_price: i.oldPrice };
  });
  const subtotal = items.reduce((s, i) => s + (i.old_price || i.unit_price) * i.qty, 0);
  const itemsTotal = items.reduce((s, i) => s + i.line_total, 0);
  const shipping = ckDelivery === 'domicilio' ? SHIPPING_FEE : 0;
  return { items, subtotal, savings: subtotal - itemsTotal, shipping, total: itemsTotal + shipping };
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const money = n => `$${Number(n).toFixed(2)}`;
const qtyLabel = i => i.unit ? `${i.qty} ${i.unit}` : `x${i.qty}`;

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

  const pagoLabel = ckPayment === 'efectivo' ? 'Efectivo' : 'Transferencia';

  // Pedir al servidor el total real antes de mostrar el resumen
  const btn = document.querySelector('.ck-confirm-btn');
  const btnText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = 'Calculando total...'; }
  const res = await callServer('cotizar_pedido', { p_items: cartToServerItems(), p_delivery_type: ckDelivery });
  if (btn) { btn.disabled = false; btn.innerHTML = btnText; }

  if (res.error) {
    alert(res.error);
    return;
  }
  const quote = res.offline ? localQuote() : res.data;
  const localTotal = localQuote().total;
  const pricesChanged = !res.offline && Math.abs(Number(quote.total) - localTotal) > 0.005;

  // Fill modal
  document.getElementById('modal-cliente').textContent = `${nombre} · ${tel}`;
  document.getElementById('modal-entrega').textContent = ckDelivery === 'tienda'
    ? ' Recoger en tienda'
    : ` ${entregaLabel}`;
  document.getElementById('modal-pago').textContent = pagoLabel;
  document.getElementById('modal-items').innerHTML = quote.items.map(i =>
    `• ${escHtml(i.name)} <span style="color:#888">${qtyLabel(i)}</span> — ${money(i.line_total)}`
  ).join('<br>')
    + (Number(quote.shipping) > 0 ? `<br>• Envío: ${money(quote.shipping)}` : '')
    + (Number(quote.savings) > 0 ? `<br><span style="color:#1a7a2e;font-weight:700">Ahorros: -${money(quote.savings)}</span>` : '');
  document.getElementById('modal-total').textContent = money(quote.total);

  const sub = document.querySelector('.ck-modal-header p');
  if (sub) {
    sub.textContent = pricesChanged
      ? 'Algunos precios se actualizaron. Revisa el total antes de enviarlo.'
      : 'Revisa los detalles antes de enviarlo';
  }

  // Store for WA
  window._ckOrder = { nombre, tel, notas, entregaLabel, pagoLabel, quote, offline: !!res.offline };

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
      p_address: ckDelivery === 'domicilio' ? o.entregaLabel : null,
      p_notes: o.notas || null
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
    ? ` *Pedido #${folio} – Abarrotes El Rosal*\n\n`
    : ` *Pedido – Abarrotes El Rosal*\n⚠️ _Sin registrar en el sistema (sin conexión). Confirmar precios._\n\n`;
  msg += ` *Cliente:* ${o.nombre}\n`;
  msg += `📞 *Teléfono:* ${o.tel}\n`;

  if (ckDelivery === 'domicilio') {
    msg += `📍 *Entrega:* ${o.entregaLabel}\n`;
  } else {
    msg += `📍 *Entrega:* Recoger en tienda (Anexa 20 de Noviembre)\n`;
    msg += `🕒 *Tiempo estimado:* Pasar por el producto en 10-20 minutos.\n`;
  }

  msg += `💳 *Pago:* ${o.pagoLabel}\n\n`;
  msg += `─────────────────────\n`;
  msg += `*Productos:*\n`;

  quote.items.forEach(i => {
    msg += `• ${i.name} ${qtyLabel(i)} — ${money(i.line_total)}\n`;
  });

  if (Number(quote.shipping) > 0) msg += `• Envío: ${money(quote.shipping)}\n`;

  if (Number(quote.savings) > 0) msg += `\n🎉 *Ahorros: -${money(quote.savings)}*\n`;
  msg += `\n *TOTAL: ${money(quote.total)}*\n`;

  if (o.notas) msg += `\n📝 *Notas:* ${o.notas}`;

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
    addrBlock.style.maxHeight = '600px';
    addrBlock.style.opacity = '1';
  }
});
