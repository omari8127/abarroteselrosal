// ================================================================
//  ABARROTES EL ROSAL - Lógica General
// ================================================================

let cart = JSON.parse(localStorage.getItem('cart')) || {};
let qtys = {};
// State for frutas: { [id]: { mode: 'kg'|'unit', val: number } }
let frutaModes = {};
let activeFilters = {
  cats: [],
  brands: [],
  price: 1000,
  sort: 'relevance'
};

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  if (typeof allProducts !== 'undefined') {
    allProducts.forEach(p => { if (!qtys[p.id]) qtys[p.id] = 1; });
    initDropdown();
    updateCartUI();

    // Identificar en qué página estamos
    if (document.querySelector('.page-home')) initHome();
    if (document.querySelector('.page-productos')) initProductos();
    if (document.querySelector('.page-detalle')) initDetalle();
    if (document.querySelector('.page-promociones')) initPromociones();
  }
});

// --- DROPDOWN LOGIC ---
function initDropdown() {
  const trigger = document.getElementById('dept-trigger');
  const menu = document.getElementById('dept-menu');
  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!trigger.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('active');
    }
  });
}

function closeDropdown() {
  const menu = document.getElementById('dept-menu');
  if (menu) menu.classList.remove('active');
}

// Nueva función unificada para departamentos
function selectCategory(id) {
  closeDropdown();

  const isProductosPage = document.querySelector('.page-productos');
  const isHomePage = document.querySelector('.page-home') || document.querySelector('.page-abarrotes-el-rosal'); // Handle both home variants

  if (isProductosPage) {
    // Si ya estamos en productos, solo filtramos
    showCat(id);
    // Actualizar URL sin recargar para que sea consistente
    const newUrl = id === 'all' ? 'productos.html' : `productos.html?cat=${id}`;
    window.history.pushState({ cat: id }, '', newUrl);
  } else {
    // Si estamos en otra página, navegamos a productos con el parámetro
    window.location.href = id === 'all' ? 'productos.html' : `productos.html?cat=${id}`;
  }
}

// --- HOME PAGE LOGIC ---
function initHome() {
  buildCatStrip('cat-strip-home');
  renderFeatured(8);
  initHeroCarousel();
}

let slideIndex = 0;
let slideInterval;

function initHeroCarousel() {
  const slides = document.querySelectorAll('.carousel-slide');
  if (slides.length === 0) return;

  startSlideShow();
}

function startSlideShow() {
  stopSlideShow();
  slideInterval = setInterval(() => {
    moveSlide(1);
  }, 5000);
}

function stopSlideShow() {
  clearInterval(slideInterval);
}

function moveSlide(n) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.dot');

  slides[slideIndex].classList.remove('active');
  dots[slideIndex].classList.remove('active');

  slideIndex = (slideIndex + n + slides.length) % slides.length;

  slides[slideIndex].classList.add('active');
  dots[slideIndex].classList.add('active');

  startSlideShow(); // Reset timer
}

function currentSlide(n) {
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.dot');

  slides[slideIndex].classList.remove('active');
  dots[slideIndex].classList.remove('active');

  slideIndex = n;

  slides[slideIndex].classList.add('active');
  dots[slideIndex].classList.add('active');

  startSlideShow(); // Reset timer
}


// --- PRODUCTOS & PROMOCIONES (ECOMMERCE LOGIC) ---
function initProductos() {
  const params = new URLSearchParams(window.location.search);
  const cat = params.get('cat');
  const q = params.get('q');

  initEcommerceFilters();

  if (cat) {
    // If arriving with a category, pre-check it
    const checkbox = document.querySelector(`.cat-check[value="${cat}"]`);
    if (checkbox) checkbox.checked = true;
  }

  if (q) {
    document.getElementById('search-input').value = q;
  }

  updateFilters();
}

function initPromociones() {
  initEcommerceFilters();
  // Only show items with oldPrice initially
  updateFilters(true);
}

function initEcommerceFilters() {
  // 1. Build Categories
  const catContainer = document.getElementById('filter-cats');
  const deptContainer = document.getElementById('filter-depts');
  if (catContainer) {
    catContainer.innerHTML = categories.map(c => `
      <label class="filter-opt">
        <input type="checkbox" class="cat-check" value="${c.id}" onchange="updateFilters()">
        ${c.label}
      </label>
    `).join('');
  }
  if (deptContainer) {
    deptContainer.innerHTML = categories.map(c => `
      <label class="filter-opt">
        <input type="checkbox" class="cat-check" value="${c.id}" onchange="updateFilters()">
        ${c.label}
      </label>
    `).join('');
  }

  // 2. Build Brands (Extracted from names)
  const brands = [...new Set(allProducts.map(p => extractBrand(p.name)))].sort();
  const brandContainer = document.getElementById('filter-brands');
  if (brandContainer) {
    brandContainer.innerHTML = brands.map(b => `
      <label class="filter-opt">
        <input type="checkbox" class="brand-check" value="${b}" onchange="updateFilters()">
        ${b}
      </label>
    `).join('');
  }
}

function extractBrand(name) {
  // Simple extraction: first word usually works for this catalog
  const firstWord = name.split(' ')[0];
  // Exceptions or cleanup if needed
  if (["Jugo", "Agua", "Aceite", "Frijol", "Sopa", "Queso", "Leche"].includes(firstWord)) {
    return name.split(' ')[1] || 'S/M';
  }
  return firstWord;
}

function updateFilters(isPromoPage = false) {
  // Sync state from UI
  activeFilters.cats = Array.from(document.querySelectorAll('.cat-check:checked')).map(cb => cb.value);
  activeFilters.brands = Array.from(document.querySelectorAll('.brand-check:checked')).map(cb => cb.value);
  const slider = document.getElementById('side-price-slider');
  if (slider) {
    activeFilters.price = parseInt(slider.value);
    document.getElementById('side-price-max').textContent = activeFilters.price >= 1000 ? '$500+' : '$' + activeFilters.price;
  }
  const sortSel = document.getElementById('sort-select');
  if (sortSel) activeFilters.sort = sortSel.value;

  // Search query
  const q = document.getElementById('search-input')?.value.toLowerCase() || '';

  // Filter
  let filtered = allProducts.filter(p => {
    const matchesCat = activeFilters.cats.length === 0 || activeFilters.cats.includes(p.cat);
    const matchesBrand = activeFilters.brands.length === 0 || activeFilters.brands.includes(extractBrand(p.name));
    const matchesPrice = p.price <= activeFilters.price;
    const matchesPromo = !isPromoPage || p.oldPrice !== null;
    const matchesSearch = !q || (p.name + p.cat).toLowerCase().includes(q);
    return matchesCat && matchesBrand && matchesPrice && matchesPromo && matchesSearch;
  });

  // Sort
  if (activeFilters.sort === 'price-asc') filtered.sort((a, b) => a.price - b.price);
  else if (activeFilters.sort === 'price-desc') filtered.sort((a, b) => b.price - a.price);
  else if (activeFilters.sort === 'discount') filtered.sort((a, b) => {
    const discA = a.oldPrice ? (a.oldPrice - a.price) : 0;
    const discB = b.oldPrice ? (b.oldPrice - b.price) : 0;
    return discB - discA;
  });

  // Render
  const container = document.getElementById('main-content') || document.getElementById('promo-grid');
  const countEl = document.getElementById('results-count');
  const noRes = document.getElementById('no-results');

  if (countEl) countEl.textContent = `${filtered.length} PRODUCTOS`;

  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (noRes) noRes.style.display = 'block';
  } else {
    container.innerHTML = filtered.map(p => cardHTML(p)).join('');
    if (noRes) noRes.style.display = 'none';
  }

  // Refresh button states after re-render
  if (typeof refreshAllAddBtns === 'function') refreshAllAddBtns();
}

function resetFilters() {
  document.querySelectorAll('.cat-check, .brand-check').forEach(cb => cb.checked = false);
  const slider = document.getElementById('side-price-slider');
  if (slider) slider.value = 1000;
  const sortSel = document.getElementById('sort-select');
  if (sortSel) sortSel.value = 'relevance';
  updateFilters(document.querySelector('.page-promociones') !== null);
}

// --- CATALOG RENDERING ---
function buildCatStrip(containerId) {
  const s = document.getElementById(containerId);
  if (!s) return;
  let h = `<div class="cat-chip active" id="chip-all" style="background:#333" onclick="selectCategory('all')"><span class="ico">🏪</span><span class="lbl">Todos</span></div>`;
  h += categories.map(c => `<div class="cat-chip" id="chip-${c.id}" style="background:${c.color}" onclick="selectCategory('${c.id}')"><span class="ico">${c.emoji}</span><span class="lbl">${c.label}</span></div>`).join('');
  s.innerHTML = h;
}

function showCat(id) {
  // Compatibility shim for existing calls
  document.querySelectorAll('.cat-check').forEach(cb => {
    cb.checked = (id === 'all' || cb.value === id);
  });
  updateFilters(document.querySelector('.page-promociones') !== null);
}

function buildMain() {
  const container = document.getElementById('main-content');
  if (!container) return;

  const cats = currentCat === 'all' ? categories : categories.filter(c => c.id === currentCat);
  container.innerHTML = cats.map(cat => {
    const prods = allProducts.filter(p => p.cat === cat.id);
    return `
      <div class="section-wrap">
        <div class="section-title-bar">
          <div class="section-title-line"></div>
          <div class="section-title-badge" style="background:${cat.color}">${cat.emoji} ${cat.label}</div>
          <div class="section-title-line"></div>
        </div>
        <div class="products-grid">${prods.map(p => cardHTML(p)).join('')}</div>
      </div>`;
  }).join('');
}

function renderFeatured(limit) {
  const container = document.getElementById('featured-products');
  if (!container) return;
  const filtered = allProducts.filter(p => p.badge).slice(0, limit);
  container.innerHTML = filtered.map(p => cardHTML(p)).join('');
  if (typeof refreshAllAddBtns === 'function') refreshAllAddBtns();
}

function cardHTML(p) {
  const isPromoPage = document.querySelector('.page-promociones') !== null;
  const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  const badge = discount > 0 ? `<div class="prod-badge">-${discount}%</div>` : (p.badge ? `<div class="prod-badge">${p.badge}</div>` : '');

  const imgPart = p.img
    ? `<img src="${p.img}" alt="${p.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="prod-emoji" style="display:none">${p.emoji}</span>`
    : `<span class="prod-emoji">${p.emoji}</span>`;

  // ── Frutas y Verduras: segmented control de Kg/Unidades ──
  if (p.cat === 'frutas') {
    if (!frutaModes[p.id]) frutaModes[p.id] = { mode: 'kg', val: 0.5 };
    const fm = frutaModes[p.id];
    const displayVal = fm.mode === 'kg' ? fm.val.toFixed(1) : fm.val;
    const suffix    = fm.mode === 'kg' ? 'kg' : 'pzas';
    return `
    <div class="prod-card">
      ${badge}
      <a href="producto-detalle.html?id=${p.id}" class="prod-img-wrap">${imgPart}</a>
      <a href="producto-detalle.html?id=${p.id}" class="prod-name">${p.name}</a>

      <div class="prod-price-area">
        ${p.oldPrice ? `<div class="prod-price-old">$${p.oldPrice.toFixed(2)}</div>` : '<div class="prod-price-old" style="visibility:hidden">$0.00</div>'}
        <div class="prod-price">$${p.price.toFixed(2)}</div>
      </div>

      <div class="frutas-seg-ctrl" id="seg-${p.id}">
        <button class="seg-btn${fm.mode === 'kg'   ? ' seg-active' : ''}" onclick="setFrutaMode(${p.id},'kg')">Kilogramos</button>
        <button class="seg-btn${fm.mode === 'unit' ? ' seg-active' : ''}" onclick="setFrutaMode(${p.id},'unit')">Unidades</button>
      </div>

      <div class="frutas-qty-row">
        <button class="frutas-qty-btn" onclick="changeFrutaQty(${p.id},-1)">−</button>
        <span class="frutas-qty-val" id="frutas-qty-${p.id}">${displayVal}</span>
        <span class="frutas-qty-sfx" id="frutas-sfx-${p.id}">${suffix}</span>
        <button class="frutas-qty-btn" onclick="changeFrutaQty(${p.id},1)">+</button>
      </div>

      <button class="add-btn${cart[p.id] ? ' added' : ''}" id="abtn-${p.id}" onclick="addToCart(${p.id})">${cart[p.id] ? '✓ Agregado' : 'AGREGAR'}</button>
    </div>`;
  }

  // ── Resto de categorías (comportamiento original) ──
  return `
    <div class="prod-card">
      ${badge}
      <a href="producto-detalle.html?id=${p.id}" class="prod-img-wrap">${imgPart}</a>
      <a href="producto-detalle.html?id=${p.id}" class="prod-name">${p.name}</a>
      
      <div class="prod-price-area">
        ${p.oldPrice ? `<div class="prod-price-old">$${p.oldPrice.toFixed(2)}</div>` : '<div class="prod-price-old" style="visibility:hidden">$0.00</div>'}
        <div class="prod-price">$${p.price.toFixed(2)}</div>
      </div>

      <div class="prod-qty-row">
        <div class="prod-qty-ctrl">
          <button onclick="changeQty(${p.id},-1)">-</button>
          <span id="qty-${p.id}">${qtys[p.id] || 1}</span>
          <button onclick="changeQty(${p.id},1)">+</button>
        </div>
      </div>

      <button class="add-btn${cart[p.id] ? ' added' : ''}" id="abtn-${p.id}" onclick="addToCart(${p.id})">${cart[p.id] ? '✓ Agregado' : 'AGREGAR'}</button>
    </div>`;
}

function setUnitType(id, type, el) {
  const parent = el.parentElement;
  parent.querySelectorAll('.unit-opt').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// ── FRUTAS Y VERDURAS: segmented control logic ──────────────────────
function setFrutaMode(id, mode) {
  if (!frutaModes[id]) frutaModes[id] = { mode: 'kg', val: 0.5 };
  const prev = frutaModes[id];

  if (mode === 'kg' && prev.mode === 'unit') {
    // Convert units → kg (1 pza ≈ 0.1 kg, minimum 0.1)
    frutaModes[id] = { mode: 'kg', val: Math.max(0.1, Math.round(prev.val * 0.1 * 10) / 10) };
  } else if (mode === 'unit' && prev.mode === 'kg') {
    // Convert kg → units (round, minimum 1)
    frutaModes[id] = { mode: 'unit', val: Math.max(1, Math.round(prev.val * 10)) };
  } else {
    frutaModes[id].mode = mode;
  }

  // Update segmented buttons
  const seg = document.getElementById('seg-' + id);
  if (seg) {
    seg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('seg-active'));
    const idx = mode === 'kg' ? 0 : 1;
    seg.querySelectorAll('.seg-btn')[idx].classList.add('seg-active');
  }

  // Update display
  _updateFrutaDisplay(id);
}

function changeFrutaQty(id, dir) {
  if (!frutaModes[id]) frutaModes[id] = { mode: 'kg', val: 0.5 };
  const fm = frutaModes[id];

  if (fm.mode === 'kg') {
    fm.val = Math.max(0.1, Math.round((fm.val + dir * 0.1) * 10) / 10);
  } else {
    fm.val = Math.max(1, fm.val + dir);
  }

  _updateFrutaDisplay(id);
}

function _updateFrutaDisplay(id) {
  const fm = frutaModes[id];
  const valEl = document.getElementById('frutas-qty-' + id);
  const sfxEl = document.getElementById('frutas-sfx-' + id);
  if (valEl) valEl.textContent = fm.mode === 'kg' ? fm.val.toFixed(1) : fm.val;
  if (sfxEl) sfxEl.textContent = fm.mode === 'kg' ? 'kg' : 'pzas';
}

// --- PRODUCT DETAIL LOGIC ---
function renderDetalle(id) {
  const p = allProducts.find(x => x.id === id);
  const container = document.getElementById('detalle-content');
  if (!container) return;

  if (!p) {
    container.innerHTML = `<div class="section-wrap"><p style="padding:2rem;text-align:center;color:#666">Producto no encontrado. <a href="productos.html" style="color:var(--blue);text-decoration:underline">Ver catálogo</a></p></div>`;
    return;
  }

  const catRaw = categories.find(c => c.id === p.cat);

  container.innerHTML = `
    <div class="breadcrumb-nav">
      <a href="index.html">Inicio</a> <span>›</span> 
      <a href="productos.html?cat=${p.cat}">${catRaw ? catRaw.label : 'Productos'}</a> <span>›</span> 
      <span class="curr">${p.name}</span>
    </div>
    
    <div class="detalle-grid">
      <div class="detalle-left">
        <div class="detalle-img-card">
          ${p.img ? `<img src="${p.img}" alt="${p.name}">` : `<span class="prod-emoji">${p.emoji}</span>`}
          <div class="carousel-nav">
            <button class="c-prev">❮</button>
            <div class="c-dots"><span class="c-dot active"></span><span class="c-dot"></span><span class="c-dot"></span></div>
            <button class="c-next">❯</button>
          </div>
        </div>
        <div class="detalle-thumbs">
          <img src="${p.img || ''}" class="active" onerror="this.style.display='none'">
          <div class="thumb-placeholder">📊</div>
          <div class="thumb-placeholder">🥗</div>
        </div>
      </div>
      
      <div class="detalle-right">
        <div class="detalle-ref">Referencia: ${777000 + p.id}</div>
        <h1 class="detalle-title">${p.name}</h1>
        <div class="detalle-main-price">$${p.price.toFixed(2)}</div>
        
        <div class="detalle-actions">
          <div class="detalle-qty-wrap">
            <div class="detalle-qty">
              <button onclick="changeQty(${p.id},-1,true)">-</button>
              <span id="det-qty-${p.id}">${qtys[p.id] || 1}</span>
              <button onclick="changeQty(${p.id},1,true)">+</button>
            </div>
            ${p.cat === 'frutas' ? '<div style="display: flex; align-items: center; font-size: 0.85rem; color: #666; font-weight: 700; margin-left:10px;">KILOGRAMOS/UNIDADES</div>' : ''}
          </div>
          <button class="btn-buy-now" onclick="addToCart(${p.id})">AGREGAR</button>
        </div>

        <div class="detalle-replacement">
          <h3>Si no está en stock, remplázalo por:</h3>
          <div class="replacement-grid" id="replacement-grid"></div>
        </div>
      </div>
    </div>
  `;

  // Similar products for replacements & related
  const similar = allProducts.filter(x => x.cat === p.cat && x.id !== p.id);

  // Replacements (first 2)
  const replGrid = document.getElementById('replacement-grid');
  if (replGrid) {
    replGrid.innerHTML = similar.slice(0, 2).map(x => `
      <div class="repl-item" onclick="window.location.href='producto-detalle.html?id=${x.id}'">
        ${x.badge ? `<div class="repl-badge">${x.badge}</div>` : ''}
        <img src="${x.img}" alt="${x.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <span class="repl-emoji" style="display:none">${x.emoji}</span>
        <div class="repl-item-info">
          <div class="repl-name">${x.name}</div>
          <div class="repl-price">$${x.price.toFixed(2)}</div>
        </div>
      </div>
    `).join('');
  }
  // Related products bottom
  const relatedGrid = document.getElementById('related-grid');
  if (relatedGrid) {
    relatedGrid.innerHTML = similar.slice(0, 6).map(x => cardHTML(x)).join('');
  }
}

function updateCartUI() {
  const items = Object.values(cart);
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.oldPrice || item.price) * item.qty, 0);
  const total    = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const savings  = subtotal - total;

  const countEl = document.getElementById('hdr-count');
  if (countEl) countEl.innerText = count;

  const totalEl = document.getElementById('hdr-total');
  if (totalEl) totalEl.innerText = `$${total.toFixed(2)}`;

  const floatCountEl = document.getElementById('float-count');
  if (floatCountEl) floatCountEl.innerText = count;

  const cb = document.getElementById('cart-body');
  const cf = document.getElementById('cart-footer');

  if (!cb) return;

  if (!items.length) {
    cb.innerHTML = '<div class="cart-empty">Tu carrito está vacío 🛒</div>';
    if (cf) cf.style.display = 'none';
    return;
  }

  cb.innerHTML = items.map(i => {
    const isFruta    = i.unitLabel !== undefined;
    const qtyLabel   = isFruta ? `${i.qty} ${i.unitLabel}` : i.qty;
    const brand      = extractBrand(i.name);
    const imgHtml    = i.img
      ? `<img src="${i.img}" alt="${i.name}" onerror="this.style.display='none'">`
      : `<span style="font-size:2rem">${i.emoji || '📦'}</span>`;
    const oldPriceHtml = i.oldPrice
      ? `<span class="cr-old-price">$${(i.oldPrice * i.qty).toFixed(2)}</span>` : '';
    return `
    <div class="cr-item">
      <div class="cr-img">${imgHtml}</div>
      <div class="cr-info">
        <div class="cr-brand">${brand}</div>
        <div class="cr-name">${i.name}</div>
        <div class="cr-qty-row">
          <button class="cr-qty-btn" onclick="cartQty('${i.id}',-1)">−</button>
          <span class="cr-qty-val">${qtyLabel}</span>
          <button class="cr-qty-btn" onclick="cartQty('${i.id}',1)">+</button>
        </div>
        <div class="cr-prices">
          ${oldPriceHtml}
          <span class="cr-price">$${(i.price * i.qty).toFixed(2)}</span>
        </div>
      </div>
      <button class="cr-delete" onclick="cartQty('${i.id}', -9999)" title="Eliminar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>`;
  }).join('');

  if (cf) {
    cf.style.display = 'block';
    const subEl = document.getElementById('cart-subtotal');
    const savEl = document.getElementById('cart-savings');
    const totEl = document.getElementById('cart-total-val');
    const savRow = document.getElementById('cart-savings-row');
    if (subEl) subEl.textContent = `$${subtotal.toFixed(2)}`;
    if (totEl) totEl.textContent = `$${total.toFixed(2)}`;
    if (savEl) savEl.textContent = `-$${savings.toFixed(2)}`;
    if (savRow) savRow.style.display = savings > 0 ? 'flex' : 'none';
  }
}

// --- CART LOGIC ---
function changeQty(id, delta, isDetalle = false) {
  qtys[id] = (qtys[id] || 1) + delta;
  if (qtys[id] < 1) qtys[id] = 1;

  if (isDetalle) {
    const elDet = document.getElementById('det-qty-' + id);
    if (elDet) elDet.textContent = qtys[id];
  } else {
    const el = document.getElementById('qty-' + id);
    if (el) el.textContent = qtys[id];
  }
}

function addToCart(id) {
  const p = allProducts.find(x => x.id === id);

  if (p.cat === 'frutas') {
    // Use frutas segmented-control state
    if (!frutaModes[id]) frutaModes[id] = { mode: 'kg', val: 0.5 };
    const fm = frutaModes[id];
    const qty    = fm.val;
    const suffix = fm.mode === 'kg' ? 'kg' : 'pzas';
    const key    = id + '_' + fm.mode;   // separate cart slot per mode

    if (cart[key]) {
      cart[key].qty = Math.round((cart[key].qty + qty) * 10) / 10;
    } else {
      cart[key] = { ...p, id: key, qty, unitLabel: suffix };
    }
  } else {
    const qty = qtys[id] || 1;
    if (cart[id]) {
      cart[id].qty += qty;
    } else {
      cart[id] = { ...p, qty };
    }
  }

  saveCart();
  updateCartUI();
  _animateFloatCart();   // 🎯 bounce animation
  refreshAllAddBtns();
}

function cartQty(id, delta) {
  if (!cart[id]) return;
  if (delta <= -9999) {
    delete cart[id]; // trash button = full delete
  } else {
    cart[id].qty += delta;
    if (cart[id].qty <= 0) delete cart[id];
  }
  saveCart();
  updateCartUI();
  refreshAllAddBtns();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
}

/* ── Refresca el estado visual de todos los botones "Agregar" ─── */
function refreshAllAddBtns() {
  document.querySelectorAll('[id^="abtn-"]').forEach(btn => {
    const id = parseInt(btn.id.replace('abtn-', ''), 10);
    // Un producto está en el carrito si existe cart[id]
    // Para frutas, el key incluye sufijo (_kg/_unit), chequeamos ambos
    const inCart = cart[id] ||
                   cart[id + '_kg'] ||
                   cart[id + '_unit'];
    if (inCart) {
      btn.classList.add('added');
      btn.textContent = '✓ Agregado';
    } else {
      btn.classList.remove('added');
      btn.textContent = 'AGREGAR';
    }
  });
}

function toggleCart() {
  const overlay = document.getElementById('cart-overlay');
  if (overlay) overlay.classList.toggle('open');
}

function outsideClose(e) {
  if (e.target === document.getElementById('cart-overlay')) toggleCart();
}

// Bounce the floating cart button
function _animateFloatCart() {
  const btn = document.getElementById('float-cart-btn') || document.querySelector('.float-cart');
  if (!btn) return;
  btn.classList.remove('bounce');
  // Force reflow to restart animation
  void btn.offsetWidth;
  btn.classList.add('bounce');
  btn.addEventListener('animationend', () => btn.classList.remove('bounce'), { once: true });
}

async function sendWA() {
  const items = Object.values(cart);
  if (!items.length) {
    alert('Tu carrito está vacío.');
    return;
  }

  // 1. Verificar sesión activa
  const { data: { session } } = await window.supabaseClient.auth.getSession();

  if (session?.user) {
    // 2. Si hay sesión, buscar perfil
    try {
      const { data: perfil, error } = await window.supabaseClient
        .from('perfiles')
        .select('nombre, direccion')
        .eq('id', session.user.id)
        .single();

      if (perfil && perfil.nombre && perfil.direccion) {
        // Tomar datos automáticamente y enviar
        _executeWAFinal(perfil.nombre, perfil.direccion);
      } else {
        // Si el perfil no está completo, pedir los datos (o usar metadata del nombre como fallback)
        const nameFallback = session.user.user_metadata?.full_name || session.user.email.split('@')[0];
        openGuestModal((data) => {
          _executeWAFinal(data.nombre, data.direccion);
        });
      }
    } catch (err) {
      console.error('Error al obtener perfil:', err);
      // Fallback a modal de invitado si falla la DB
      openGuestModal((data) => {
        _executeWAFinal(data.nombre, data.direccion);
      });
    }
  } else {
    // 3. Si no hay sesión, abrir modal de invitado
    if (typeof openGuestModal === 'function') {
      openGuestModal((data) => {
        _executeWAFinal(data.nombre, data.direccion);
      });
    } else {
      // Fallback básico si auth.js no cargó
      const nombre = prompt('Ingresa tu nombre para el pedido:');
      const direccion = prompt('Ingresa tu dirección de entrega:');
      if (nombre && direccion) {
        _executeWAFinal(nombre, direccion);
      }
    }
  }
}

function _executeWAFinal(nombre, direccion) {
  const items = Object.values(cart);
  const total = items.reduce((a, i) => a + i.price * i.qty, 0);
  
  // Formato de fecha: DD/MM/YYYY HH:mm
  const now = new Date();
  const d = now.getDate().toString().padStart(2, '0');
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const y = now.getFullYear();
  const h = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const fechaStr = `${d}/${m}/${y} ${h}:${min}`;

  let msg = `🛒 *Nuevo pedido - Abarrotes el Rosal*\n\n`;
  msg += `👤 Cliente: ${nombre}\n`;
  msg += `📍 Dirección: ${direccion}\n\n`;
  msg += `🧾 Pedido:\n`;
  
  items.forEach(i => {
    const subtotal = (i.price * i.qty).toFixed(2);
    msg += `• ${i.qty} x ${i.name} — $${subtotal}\n`;
  });
  
  msg += `\n💰 *Total: $${total.toFixed(2)}*\n\n`;
  msg += `🕐 Fecha: ${fechaStr}\n\n`;
  msg += `Por favor, confirmar disponibilidad. ¡Gracias!`;

  const waUrl = `https://wa.me/526643944760?text=${encodeURIComponent(msg)}`;
  window.open(waUrl, '_blank');
}


function searchProducts(q, forceDetail = false) {
  const main = document.getElementById('main-content') ||
    document.getElementById('detalle-content') ||
    document.getElementById('promo-container') ||
    document.getElementById('featured-section');
  const sr = document.getElementById('search-results');
  const sg = document.getElementById('search-grid');

  if (!q.trim()) {
    if (sr) sr.style.display = 'none';
    if (main) main.style.display = '';
    return;
  }

  const res = allProducts.filter(p => (p.name + p.cat).toLowerCase().includes(q.toLowerCase()));

  if (forceDetail && res.length > 0) {
    const bestMatch = res.find(p => p.name.toLowerCase().startsWith(q.toLowerCase())) || res[0];
    window.location.href = `producto-detalle.html?id=${bestMatch.id}`;
    return;
  }

  if (!sr || !sg) {
    if (event && event.type === 'input') return;
    window.location.href = `productos.html?q=${encodeURIComponent(q)}${forceDetail ? '&jump=true' : ''}`;
    return;
  }

  if (main) main.style.display = 'none';
  if (sr) sr.style.display = 'block';
  if (sg) {
    sg.innerHTML = res.length
      ? res.map(p => cardHTML(p)).join('')
      : '<p style="color:#666;padding:1rem;grid-column:1/-1">No se encontraron productos.</p>';
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'search-input') {
    searchProducts(e.target.value, true);
  }
});
