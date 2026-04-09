// ================================================================
//  ABARROTES EL ROSAL - Checkout Logic
// ================================================================

const WA_NUMBER = '526645187312';

let ckCart = {};
let ckDelivery = 'domicilio'; // 'domicilio' | 'tienda'
let ckPayment = 'efectivo';  // 'efectivo' | 'transferencia'

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  ckCart = JSON.parse(localStorage.getItem('cart')) || {};
  renderSummary();
  if (Object.keys(ckCart).length === 0) showEmptyPage();
});

// ── EMPTY STATE ──────────────────────────────────────────────────
function showEmptyPage() {
  const wrap = document.getElementById('ck-wrap');
  if (!wrap) return;
  wrap.innerHTML = `
    <div class="ck-empty-page" style="grid-column:1/-1">
      <div class="big-icon">🛒</div>
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
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const savings = subtotal - total;

  container.innerHTML = items.map(i => {
    const qtyLabel = i.unitLabel ? `${i.qty} ${i.unitLabel}` : `x${i.qty}`;
    const imgHtml = i.img
      ? `<img src="${i.img}" alt="${i.name}" onerror="this.style.display='none'">`
      : `<span style="font-size:1.5rem">${i.emoji || '📦'}</span>`;
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

// ── CONFIRM ORDER ────────────────────────────────────────────────
function confirmOrder() {
  const items = Object.values(ckCart);
  if (!items.length) {
    alert('Tu carrito está vacío.');
    return;
  }

  if (!validateForm()) {
    // Scroll to first error
    const firstErr = document.querySelector('.has-error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  // Build order object
  const nombre = getVal('inp-nombre');
  const tel = getVal('inp-tel');
  const notas = getVal('inp-notas');
  const subtotal = items.reduce((s, i) => s + (i.oldPrice || i.price) * i.qty, 0);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const savings = subtotal - total;

  let entregaLabel = 'Recoger en tienda';
  if (ckDelivery === 'domicilio') {
    const calle = getVal('inp-calle');
    const num = getVal('inp-num');
    const colonia = getVal('inp-colonia');
    const refs = getVal('inp-refs');
    entregaLabel = `${calle} ${num}, Col. ${colonia}${refs ? ' — ' + refs : ''}`;
  }

  const pagoLabel = ckPayment === 'efectivo' ? 'Efectivo' : 'Transferencia';

  const itemsLines = items.map(i => {
    const qty = i.unitLabel ? `${i.qty} ${i.unitLabel}` : `x${i.qty}`;
    return `• ${i.name} <span style="color:#888">${qty}</span> — $${(i.price * i.qty).toFixed(2)}`;
  }).join('<br>');

  // Fill modal
  document.getElementById('modal-cliente').textContent = `${nombre} · ${tel}`;
  document.getElementById('modal-entrega').textContent = ckDelivery === 'tienda'
    ? '🏪 Recoger en tienda'
    : `🚚 ${entregaLabel}`;
  document.getElementById('modal-pago').textContent = pagoLabel;
  document.getElementById('modal-items').innerHTML = itemsLines
    + (savings > 0 ? `<br><span style="color:#1a7a2e;font-weight:700">Ahorros: -$${savings.toFixed(2)}</span>` : '');
  document.getElementById('modal-total').textContent = `$${total.toFixed(2)}`;

  // Store for WA
  window._ckOrder = { nombre, tel, notas, entregaLabel, pagoLabel, items, total, savings };

  // Open modal
  document.getElementById('ck-modal').classList.add('open');
}

// ── SUPABASE INTEGRATION ──────────────────────────────────────────
async function saveOrderToSupabase(order) {
  try {
    // Obtener user_id si hay sesión activa
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    const userId = session?.user?.id || null;

    const { data: orderData, error: orderError } = await window.supabaseClient
      .from('orders')
      .insert([{
        customer_name: order.nombre,
        phone: order.tel,
        delivery_type: ckDelivery,
        address: ckDelivery === 'domicilio' ? order.entregaLabel : null,
        payment_method: ckPayment,
        subtotal: order.subtotal,
        savings: order.savings,
        total: order.total,
        notes: order.notas,
        status: 'pending',
        user_id: userId
      }])
      .select();


    if (orderError) throw orderError;

    const orderId = orderData[0].id;

    // Save items
    const itemsToInsert = order.items.map(i => ({
      order_id: orderId,
      product_id: i.id,
      product_name: i.name,
      quantity: i.qty,
      unit_price: i.price,
      total_price: i.price * i.qty
    }));

    const { error: itemsError } = await window.supabaseClient
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    console.log('Pedido guardado en Supabase con ID:', orderId);
    return true;
  } catch (err) {
    console.error('Error al guardar en Supabase:', err);
    return false;
  }
}

// ── WHATSAPP FINAL ───────────────────────────────────────────────
async function sendWAFinal() {
  const o = window._ckOrder;
  if (!o) return;

  const btn = document.getElementById('modal-wa-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>Procesando...</span>';

  // Guardar en Supabase (Opcional: puedes esperar a que termine o no)
  // Aquí esperamos para asegurar que se guardó antes de redirigir
  await saveOrderToSupabase({ ...o, subtotal: o.items.reduce((s, i) => s + (i.oldPrice || i.price) * i.qty, 0) });

  let msg = `🛒 *Pedido – Abarrotes El Rosal*\n\n`;
  msg += `👤 *Cliente:* ${o.nombre}\n`;
  msg += `📞 *Teléfono:* ${o.tel}\n`;

  if (ckDelivery === 'domicilio') {
    msg += `🚚 *Entrega:* ${o.entregaLabel}\n`;
  } else {
    msg += `🏪 *Entrega:* Recoger en tienda\n`;
  }

  msg += `💳 *Pago:* ${o.pagoLabel}\n\n`;
  msg += `─────────────────────\n`;
  msg += `*Productos:*\n`;

  o.items.forEach(i => {
    const qty = i.unitLabel ? `${i.qty} ${i.unitLabel}` : `x${i.qty}`;
    msg += `• ${i.name} ${qty} — $${(i.price * i.qty).toFixed(2)}\n`;
  });

  if (o.savings > 0) msg += `\n🎉 *Ahorros: -$${o.savings.toFixed(2)}*\n`;
  msg += `\n✅ *TOTAL: $${o.total.toFixed(2)}*\n`;

  if (o.notas) msg += `\n📝 *Notas:* ${o.notas}`;

  // Restaurar botón después de un momento
  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = originalText;
    // Limpiar carrito tras éxito
    localStorage.removeItem('cart');
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
