// ================================================================
//  ABARROTES EL ROSAL - L├│gica General
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
window.currentDeliveryMode = 'domicilio'; // 'domicilio' | 'pickup'
let visibleProductsLimit = 24;

// INICIALIZACI├ôN
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
    
    // Cargar info de entrega si hay sesión
    if (typeof updateDeliveryInfo === 'function') updateDeliveryInfo();
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

// Nueva funci├│n unificada para departamentos
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
    // Si estamos en otra p├ígina, navegamos a productos con el par├ímetro
    window.location.href = id === 'all' ? 'productos.html' : `productos.html?cat=${id}`;
  }
}

// --- HOME PAGE LOGIC ---
function initHome() {
  buildCatStrip('cat-strip-home');
  renderFeatured(8);
  renderRecientes(5);
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

function updateFilters(isPromoPage = false, keepLimit = false) {
  if (!keepLimit) {
    visibleProductsLimit = 24;
  }
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

  const totalCount = filtered.length;
  if (countEl) countEl.textContent = `${totalCount} PRODUCTOS`;

  if (!container) return;

  const displayed = filtered.slice(0, visibleProductsLimit);

  if (displayed.length === 0) {
    container.innerHTML = '';
    if (noRes) noRes.style.display = 'block';
  } else {
    container.innerHTML = displayed.map(p => cardHTML(p)).join('');
    if (noRes) noRes.style.display = 'none';
  }

  // Update "Cargar Más" button visibility
  const loadMoreContainer = document.getElementById('load-more-container');
  if (loadMoreContainer) {
    if (totalCount > visibleProductsLimit) {
      loadMoreContainer.style.display = 'flex';
    } else {
      loadMoreContainer.style.display = 'none';
    }
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

function loadMoreProducts() {
  const btn = document.getElementById('load-more-btn');
  if (!btn || btn.classList.contains('loading')) return;

  btn.classList.add('loading');

  setTimeout(() => {
    visibleProductsLimit += 24;
    const isPromoPage = document.querySelector('.page-promociones') !== null;
    updateFilters(isPromoPage, true);
    btn.classList.remove('loading');
  }, 600);
}

// --- CATALOG RENDERING ---
function buildCatStrip(containerId) {
  const s = document.getElementById(containerId);
  if (!s) return;
  let h = `<div class="cat-chip active" id="chip-all" style="background:#333" onclick="selectCategory('all')"><span class="ico">­ƒÅ¬</span><span class="lbl">Todos</span></div>`;
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

function renderRecientes(limit) {
  const container = document.getElementById('recientes-products');
  if (!container) return;
  // Show recently added: products without badge (not on sale), shuffled for variety
  const nonSale = allProducts.filter(p => !p.badge);
  // Pick a spread of categories for variety
  const picks = nonSale.slice(0, limit * 4);
  const shuffled = picks.sort(() => Math.random() - 0.5).slice(0, limit);
  container.innerHTML = shuffled.map(p => cardHTML(p)).join('');
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
    const suffix = fm.mode === 'kg' ? 'kg' : 'pzas';
    return `
    <div class="prod-card">
      ${badge}
      <a href="producto-detalle.html?id=${p.id}" class="prod-img-wrap">${imgPart}</a>
      
      <div class="frutas-qty-row">
        <button class="frutas-qty-btn" onclick="changeFrutaQty(${p.id},-1)">-</button>
        <span class="frutas-qty-val" id="frutas-qty-${p.id}">${displayVal}</span>
        <span class="frutas-qty-sfx" id="frutas-sfx-${p.id}">${suffix}</span>
        <button class="frutas-qty-btn" onclick="changeFrutaQty(${p.id},1)">+</button>
      </div>

      <button class="add-btn${cart[p.id] ? ' added' : ''}" id="abtn-${p.id}" onclick="addToCart(${p.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> ${cart[p.id] ? 'Agregado' : 'Agregar'}</button>
      
      <div class="frutas-seg-ctrl" id="seg-${p.id}">
        <button class="seg-btn${fm.mode === 'kg' ? ' seg-active' : ''}" onclick="setFrutaMode(${p.id},'kg')">Kilogramos</button>
        <button class="seg-btn${fm.mode === 'unit' ? ' seg-active' : ''}" onclick="setFrutaMode(${p.id},'unit')">Unidades</button>
      </div>

      <a href="producto-detalle.html?id=${p.id}" class="prod-name">${p.name}</a>

      <div class="prod-price-area">
        ${p.oldPrice ? `
          <div class="prod-price-row">
            <span class="prod-price promo">$${p.price.toFixed(2)}</span>
            <span class="prod-price-old">$${p.oldPrice.toFixed(2)}</span>
          </div>
          <div class="prod-savings-badge">Ahorras $${(p.oldPrice - p.price).toFixed(2)}</div>
        ` : `
          <div class="prod-price-row">
            <span class="prod-price">$${p.price.toFixed(2)}</span>
          </div>
        `}
      </div>
    </div>`;
  }

  // ── Resto de categorías ──
  return `
    <div class="prod-card">
      ${badge}
      <a href="producto-detalle.html?id=${p.id}" class="prod-img-wrap">${imgPart}</a>
      
      <div class="prod-qty-row">
        <div class="prod-qty-ctrl">
          <button onclick="changeQty(${p.id},-1)">-</button>
          <span id="qty-${p.id}">${qtys[p.id] || 1}</span>
          <button onclick="changeQty(${p.id},1)">+</button>
        </div>
      </div>

      <button class="add-btn${cart[p.id] ? ' added' : ''}" id="abtn-${p.id}" onclick="addToCart(${p.id})"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> ${cart[p.id] ? 'Agregado' : 'Agregar'}</button>

      <a href="producto-detalle.html?id=${p.id}" class="prod-name">${p.name}</a>
      
      <div class="prod-price-area">
        ${p.oldPrice ? `
          <div class="prod-price-row">
            <span class="prod-price promo">$${p.price.toFixed(2)}</span>
            <span class="prod-price-old">$${p.oldPrice.toFixed(2)}</span>
          </div>
          <div class="prod-savings-badge">Ahorras $${(p.oldPrice - p.price).toFixed(2)}</div>
        ` : `
          <div class="prod-price-row">
            <span class="prod-price">$${p.price.toFixed(2)}</span>
          </div>
        `}
      </div>
    </div>`;
}

function setUnitType(id, type, el) {
  const parent = el.parentElement;
  parent.querySelectorAll('.unit-opt').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

// ÔöÇÔöÇ FRUTAS Y VERDURAS: segmented control logic ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function setFrutaMode(id, mode) {
  if (!frutaModes[id]) frutaModes[id] = { mode: 'kg', val: 0.5 };
  const prev = frutaModes[id];

  if (mode === 'kg' && prev.mode === 'unit') {
    // Convert units ÔåÆ kg (1 pza Ôëê 0.1 kg, minimum 0.1)
    frutaModes[id] = { mode: 'kg', val: Math.max(0.1, Math.round(prev.val * 0.1 * 10) / 10) };
  } else if (mode === 'unit' && prev.mode === 'kg') {
    // Convert kg ÔåÆ units (round, minimum 1)
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
    container.innerHTML = `<div style="padding:4rem;text-align:center;color:#666">Producto no encontrado. <a href="productos.html" style="color:var(--blue);text-decoration:underline">Ver catálogo</a></div>`;
    return;
  }

  const catRaw = categories.find(c => c.id === p.cat);
  const sku = 777000 + p.id;
  const hasPromo = p.badge && p.oldPrice;
  const promoText = hasPromo ? `${p.badge} — ${p.unit || '1 pza'} por $${p.oldPrice.toFixed(2)}` : null;

  container.innerHTML = `
    <div class="detalle-wrapper">
      <!-- Breadcrumb -->
      <nav class="breadcrumb-nav">
        <a href="index.html">Inicio</a>
        <span class="bc-sep">&rsaquo;</span>
        <a href="productos.html?cat=${p.cat}">${catRaw ? catRaw.label : 'Productos'}</a>
        <span class="bc-sep">&rsaquo;</span>
        <span class="curr">${p.name}</span>
      </nav>

      <!-- Main product grid -->
      <div class="detalle-grid">

        <!-- LEFT: thumb strip + main image -->
        <div class="detalle-left">
          <!-- Vertical thumbnail strip -->
          <div class="detalle-thumbstrip">
            <button class="thumb-arrow" id="thumb-up" onclick="scrollThumbs(-1)">&#8679;</button>
            <img src="${p.img || ''}" alt="${p.name}" class="detalle-thumb-img active" id="thumb-0"
              onclick="switchImg(this, '${p.img || ''}')"
              onerror="this.style.display='none'">
            <button class="thumb-arrow" id="thumb-down" onclick="scrollThumbs(1)">&#8681;</button>
          </div>

          <!-- Main image -->
          <div class="detalle-img-main" id="detalle-img-main">
            ${p.img
              ? `<img src="${p.img}" alt="${p.name}" id="detalle-main-img">`
              : `<span style="font-size:9rem;line-height:1">${p.emoji}</span>`
            }
            <button class="detalle-zoom-btn" title="Ampliar imagen">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
          </div>
        </div>

        <!-- RIGHT: product info -->
        <div class="detalle-right">
          <h1 class="detalle-title">${p.name}</h1>
          <div class="detalle-sku">SKU: ${sku}</div>

          ${hasPromo ? `<div class="detalle-promo-badge">${promoText}</div>` : ''}

          <div class="detalle-price-area">
            ${p.oldPrice ? `
              <div class="detalle-price-row">
                <span class="detalle-main-price promo">$${p.price.toFixed(2)}</span>
                <span class="detalle-price-old">$${p.oldPrice.toFixed(2)}</span>
              </div>
              <div class="prod-savings-badge" style="margin-bottom: 1.5rem; font-size: 0.95rem; padding: 4px 10px;">Ahorras $${(p.oldPrice - p.price).toFixed(2)}</div>
            ` : `
              <div class="detalle-main-price">$${p.price.toFixed(2)}</div>
            `}
          </div>

          <button class="btn-agregar" onclick="addToCart(${p.id})">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Agregar
          </button>

          <hr class="detalle-divider">

          ${p.oldPrice ? `
          <div class="detalle-promos-label">Promociones</div>
          <div class="detalle-promo-box">
            ${p.name.toUpperCase().substring(0, 40)}${p.name.length > 40 ? '...' : ''} ${p.badge || ''}
            <div class="promo-qty">${qtys[p.id] || 1}</div>
          </div>` : ''}
        </div>
      </div>

      <!-- Productos similares horizontal scroll -->
      <div class="similares-section">
        <div class="similares-header">
          <h2>Productos similares</h2>
          <div class="similares-nav">
            <button class="similares-arrow" onclick="scrollSimilares(-1)">&#8249;</button>
            <button class="similares-arrow" onclick="scrollSimilares(1)">&#8250;</button>
            <a href="productos.html?cat=${p.cat}" class="ver-todos-link">Ver todos &rsaquo;</a>
          </div>
        </div>
        <div class="similares-scroll" id="similares-scroll"></div>
      </div>
    </div>
  `;

  // Populate similar products horizontal scroll
  const similar = allProducts.filter(x => x.cat === p.cat && x.id !== p.id);
  const similScroll = document.getElementById('similares-scroll');
  if (similScroll) {
    similScroll.innerHTML = similar.slice(0, 10).map(x => `
      <a class="similar-card" href="producto-detalle.html?id=${x.id}">
        <img src="${x.img || ''}" alt="${x.name}" onerror="this.style.display='none'">
        <div class="similar-card-name">${x.name}</div>
        <div class="similar-card-price-area">
          ${x.oldPrice ? `
            <div class="similar-price-row">
              <span class="similar-card-price promo">$${x.price.toFixed(2)}</span>
              <span class="similar-card-price-old">$${x.oldPrice.toFixed(2)}</span>
            </div>
            <div class="prod-savings-badge" style="font-size: 0.68rem; padding: 2px 6px; margin-top: 2px;">Ahorras $${(x.oldPrice - x.price).toFixed(2)}</div>
          ` : `
            <div class="similar-card-price">$${x.price.toFixed(2)}</div>
          `}
        </div>
      </a>
    `).join('');
  }

  // Scroll helpers
  window.scrollSimilares = (dir) => {
    const el = document.getElementById('similares-scroll');
    if (el) el.scrollBy({ left: dir * 600, behavior: 'smooth' });
  };
  window.switchImg = (thumb, src) => {
    document.querySelectorAll('.detalle-thumb-img').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    const main = document.getElementById('detalle-main-img');
    if (main) main.src = src;
  };
}

// Delivery Drawer functions (Calimax Style)
async function injectDeliveryDrawer() {
  let container = document.getElementById('delivery-drawer-container');
  
  // Check if logged in
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  const isLoggedIn = !!session?.user;

  if (!container) {
    const html = `
      <div id="delivery-drawer-container">
        <div class="delivery-overlay" id="delivery-overlay" onclick="closeDeliveryModal()"></div>
        <div class="delivery-drawer" id="delivery-drawer">
          <div class="delivery-header">
            <h2>¿Cómo recibirás tu pedido?</h2>
            <button class="delivery-close" onclick="closeDeliveryModal()">✕</button>
          </div>
          
          <div class="delivery-tabs-nav">
            <button class="delivery-tab-btn active" onclick="switchDeliveryTab('domicilio')">Domicilio</button>
            <button class="delivery-tab-btn" onclick="switchDeliveryTab('pickup')">Pickup</button>
          </div>
   
          <div class="delivery-content" id="delivery-tab-content">
            <!-- Dynamically filled -->
          </div>
   
          <div class="delivery-footer" id="delivery-drawer-footer">
            <!-- Filled dynamically -->
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    container = document.getElementById('delivery-drawer-container');
    switchDeliveryTab('domicilio'); // Default tab
  }

  // Always update the footer button based on current session
  const footer = document.getElementById('delivery-drawer-footer');
  if (footer) {
    footer.innerHTML = isLoggedIn 
      ? `<button class="btn-delivery-confirm" onclick="confirmDelivery()">CONFIRMAR ENTREGA</button>`
      : `<button class="btn-delivery-confirm" onclick="closeDeliveryModal(); openAuthModal()">INICIAR SESIÓN</button>`;
  }
}

window.openDeliveryModal = async () => {
  await injectDeliveryDrawer();
  const overlay = document.getElementById('delivery-overlay');
  const drawer = document.getElementById('delivery-drawer');
  
  if (!overlay || !drawer) return;
  
  overlay.style.display = 'block';
  setTimeout(() => {
    overlay.classList.add('active');
    drawer.classList.add('active');
  }, 10);
  document.body.style.overflow = 'hidden';
};

window.closeDeliveryModal = () => {
  const overlay = document.getElementById('delivery-overlay');
  const drawer = document.getElementById('delivery-drawer');
  
  if (!drawer) return;
  
  drawer.classList.remove('active');
  overlay.classList.remove('active');
  
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300);
  document.body.style.overflow = '';
};

window.switchDeliveryTab = (tab) => {
  window.currentDeliveryMode = tab;
  const btns = document.querySelectorAll('.delivery-tab-btn');
  const content = document.getElementById('delivery-tab-content');
  if (!content) return;

  btns.forEach(b => b.classList.remove('active'));
  
  if (tab === 'domicilio') {
    btns[0].classList.add('active');
    
    // Check for saved address if logged in
    _getSavedAddress().then(perfil => {
      let addressContent = '';
      if (perfil?.direccion) {
        // Mostrar dirección completa de forma elegante
        const parts = perfil.direccion.split(' | ').filter(p => p.trim());
        const mainAddr = parts[0] || '';
        const extraInfo = parts.slice(1).join(', ');
        
        addressContent = `
          <div class="delivery-option-card selected" style="margin-bottom: 1.5rem; cursor: pointer;" onclick="confirmDelivery()">
            <div class="delivery-option-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>
            <div class="delivery-option-info">
              <strong>Dirección Guardada</strong>
              <p>${mainAddr}</p>
              ${extraInfo ? `<p style="font-size:0.8rem; color:#666; margin-top:2px;">${extraInfo}</p>` : ''}
            </div>
          </div>
        `;
      }

      content.innerHTML = `
        <div class="delivery-search-box" style="margin-bottom: 1.5rem;">
          <div style="position:relative">
            <input type="text" id="delivery-search-input" placeholder="Ingresa tu dirección (Calle, número...)" 
              style="width:100%; padding:12px 45px 12px 15px; border:1px solid #ddd; border-radius:8px; font-size:0.9rem;">
            <span style="position:absolute; right:15px; top:50%; transform:translateY(-50%); color:var(--blue)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </span>
          </div>
        </div>
        ${addressContent}
        <div class="delivery-empty-state" style="${perfil?.direccion ? 'display:none' : ''}">
          <span class="delivery-empty-icon" style="color: var(--blue);">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          </span>
          <p style="margin-top: 1rem; color: #555; font-weight: 500;">Inicia sesión para ver tus direcciones guardadas o busca una nueva arriba.</p>
          <button class="btn-primary" style="margin-top:1.5rem; width:auto; padding:12px 24px; border-radius: 8px;" onclick="closeDeliveryModal(); openAuthModal()">INICIAR SESIÓN</button>
        </div>
      `;
    });
  } else {
    btns[1].classList.add('active');
    content.innerHTML = `
      <div class="delivery-option-card selected" onclick="confirmDelivery()">
        <div class="delivery-option-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </div>
        <div class="delivery-option-info">
          <strong>Anexa 20 de Noviembre</strong>
          <p>Blvd. Díaz Ordaz, Tijuana B.C.</p>
          <p><small>Horario: 9:00 AM - 9:00 PM</small></p>
        </div>
      </div>
      <p style="font-size:0.85rem; color:#999; margin-top:1.5rem; text-align:center; font-style: italic;">Más sucursales próximamente.</p>
    `;
  }
};

async function _getSavedAddress() {
  if (!window.supabaseClient) return null;
  const { data: { session } } = await window.supabaseClient.auth.getSession();
  if (!session?.user) return null;

  const { data: perfil } = await window.supabaseClient
    .from('perfiles')
    .select('direccion')
    .eq('id', session.user.id)
    .single();
  return perfil;
}

window.updateDeliveryInfo = async function() {
  const perfil = await _getSavedAddress();
  if (perfil?.direccion) {
    const navSuc = document.querySelector('.nav-sucursal span');
    if (navSuc) {
      const parts = perfil.direccion.split(' | ').filter(p => p.trim());
      const cleanAddr = parts[0] || '';
      navSuc.innerHTML = `Entrega: <strong>${cleanAddr}</strong>`;
    }
    
    // Also re-inject drawer to update footer button if it exists
    const drawer = document.getElementById('delivery-drawer-container');
    if (drawer) {
      drawer.remove(); // Force re-injection next time it's opened
    }
  }
};

window.confirmDelivery = () => {
  // Placeholder for real selection logic
  closeDeliveryModal();
};

function updateCartUI() {
  const items = Object.values(cart);
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce((sum, item) => sum + (item.oldPrice || item.price) * item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const savings = subtotal - total;

  const countEl = document.getElementById('hdr-count');
  if (countEl) {
    countEl.innerText = count;
    // countEl.style.display = count > 0 ? 'flex' : 'none'; // Removed as per user request
  }

  const totalEl = document.getElementById('hdr-total');
  if (totalEl) totalEl.innerText = `$${total.toFixed(2)}`;

  const floatCountEl = document.getElementById('float-count');
  if (floatCountEl) {
    floatCountEl.innerText = count;
    // floatCountEl.style.display = count > 0 ? 'flex' : 'none'; // Removed as per user request
  }

  const cb = document.getElementById('cart-body');
  const cf = document.getElementById('cart-footer');

  if (!cb) return;

  if (!items.length) {
    cb.innerHTML = '<div class="cart-empty">Tu carrito está vacío 📦</div>';
    if (cf) cf.style.display = 'none';
    return;
  }

  cb.innerHTML = items.map(i => {
    const isFruta = i.unitLabel !== undefined;
    const qtyLabel = isFruta ? `${i.qty} ${i.unitLabel}` : i.qty;
    const brand = extractBrand(i.name);
    const imgHtml = i.img
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
          <button class="cr-qty-btn" onclick="cartQty('${i.id}',-1)">-</button>
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
    const qty = fm.val;
    const suffix = fm.mode === 'kg' ? 'kg' : 'pzas';
    const key = id + '_' + fm.mode;   // separate cart slot per mode

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
  _animateFloatCart();   // ­ƒÄ» bounce animation
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

/* ÔöÇÔöÇ Refresca el estado visual de todos los botones "Agregar" ÔöÇÔöÇÔöÇ */
function refreshAllAddBtns() {
  document.querySelectorAll('[id^="abtn-"]').forEach(btn => {
    const id = parseInt(btn.id.replace('abtn-', ''), 10);
    // Un producto est├í en el carrito si existe cart[id]
    // Para frutas, el key incluye sufijo (_kg/_unit), chequeamos ambos
    const inCart = cart[id] ||
      cart[id + '_kg'] ||
      cart[id + '_unit'];
    if (inCart) {
      btn.classList.add('added');
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> Agregado';
    } else {
      btn.classList.remove('added');
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Agregar';
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

  let msg = `📦 *Nuevo pedido - Abarrotes el Rosal*\n\n`;
  msg += `👤 Cliente: ${nombre}\n`;
  
  if (window.currentDeliveryMode === 'pickup') {
    msg += `📍 *Entrega:* Recoger en tienda (Anexa 20 de Noviembre)\n`;
    msg += `🕒 *Tiempo estimado:* Listo para recoger en 10-20 minutos.\n\n`;
  } else {
    msg += `📍 Dirección: ${direccion}\n\n`;
  }
  msg += `🛒 Pedido:\n`;

  items.forEach(i => {
    const subtotal = (i.price * i.qty).toFixed(2);
    msg += `• ${i.qty} x ${i.name} — $${subtotal}\n`;
  });

  msg += `\n💰 *Total: $${total.toFixed(2)}*\n\n`;
  msg += `🕒 Fecha: ${fechaStr}\n\n`;
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
    // Hide dropdown on enter
    const dd = document.getElementById('search-suggestions-dropdown');
    if (dd) dd.classList.remove('active');
    
    // Jump directly if we have forceDetail logic, or just let searchProducts handle it
    searchProducts(e.target.value, false); 
    // Wait, the original was: searchProducts(e.target.value, true);
    // But "forceDetail=true" jumps to the first product detail page if there is a match!
    // The user said: "no cargue automaticamente y le tengan que dar enter para cargar la otra pagina".
    // Let's go to `productos.html?q=...` instead of detail page.
    window.location.href = `productos.html?q=${encodeURIComponent(e.target.value)}`;
  }
});

// Hide dropdown if clicked outside
document.addEventListener('click', (e) => {
  const dd = document.getElementById('search-suggestions-dropdown');
  const input = document.getElementById('search-input');
  if (dd && input && !dd.contains(e.target) && e.target !== input) {
    dd.classList.remove('active');
  }
});

// Pagination state for search suggestions carousel
let currentSuggestionIndex = 0;
let suggestedProducts = [];
let lastQueryText = '';

// Expose navigation functions to global window context
window.slideSuggestions = function(dir, event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const step = 5;
  if (dir === 1) {
    if (currentSuggestionIndex + step < suggestedProducts.length) {
      currentSuggestionIndex += step;
    }
  } else {
    if (currentSuggestionIndex - step >= 0) {
      currentSuggestionIndex -= step;
    }
  }
  renderSuggestedProductsGrid();
};

function renderSuggestedProductsGrid() {
  const grid = document.querySelector('.ss-products-grid');
  if (!grid) return;
  
  const prevBtn = document.getElementById('ss-carousel-prev');
  const nextBtn = document.getElementById('ss-carousel-next');
  
  if (prevBtn) {
    if (currentSuggestionIndex === 0) {
      prevBtn.style.opacity = '0.4';
      prevBtn.style.pointerEvents = 'none';
    } else {
      prevBtn.style.opacity = '1';
      prevBtn.style.pointerEvents = 'auto';
    }
  }
  
  if (nextBtn) {
    if (currentSuggestionIndex + 5 >= suggestedProducts.length) {
      nextBtn.style.opacity = '0.4';
      nextBtn.style.pointerEvents = 'none';
    } else {
      nextBtn.style.opacity = '1';
      nextBtn.style.pointerEvents = 'auto';
    }
  }

  const visibleProds = suggestedProducts.slice(currentSuggestionIndex, currentSuggestionIndex + 5);
  
  grid.innerHTML = visibleProds.map(p => {
    const imgPart = p.img ? `<img src="${p.img}" alt="${p.name}" class="ss-prod-img" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="prod-emoji" style="display:none">${p.emoji}</span>` : `<div style="font-size:2rem;height:70px;margin-bottom:8px;display:flex;align-items:center;justify-content:center;">${p.emoji}</div>`;
    const isAdded = cart[p.id] ? 'added' : '';
    const addText = cart[p.id] ? 'Agregado' : 'Agregar';
    
    return `
      <div class="ss-prod-card">
        <a href="producto-detalle.html?id=${p.id}" style="text-decoration:none; display:flex; flex-direction:column; align-items:center; width: 100%;">
          ${imgPart}
        </a>
        <a href="producto-detalle.html?id=${p.id}" class="ss-prod-name">${p.name}</a>
        <div class="ss-prod-price-area" style="width: 100%; text-align: center; margin-bottom: 8px;">
          ${p.oldPrice ? `
            <div class="ss-price-row" style="display: flex; align-items: baseline; justify-content: center; gap: 6px;">
              <span class="ss-prod-price promo">$${p.price.toFixed(2)}</span>
              <span class="ss-prod-price-old">$${p.oldPrice.toFixed(2)}</span>
            </div>
            <div class="prod-savings-badge" style="font-size: 0.65rem; padding: 2px 6px; margin: 2px auto 0; display: inline-flex;">Ahorras $${(p.oldPrice - p.price).toFixed(2)}</div>
          ` : `
            <div class="ss-prod-price">$${p.price.toFixed(2)}</div>
          `}
        </div>
        <button class="ss-prod-add ${isAdded}" id="ssbtn-${p.id}" onclick="ssAddToCart(event, ${p.id})">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          ${addText}
        </button>
      </div>
    `;
  }).join('');
}

function showSuggestions(q) {
  let dd = document.getElementById('search-suggestions-dropdown');
  const searchBar = document.querySelector('.search-bar');
  
  if (!dd && searchBar) {
    dd = document.createElement('div');
    dd.id = 'search-suggestions-dropdown';
    dd.className = 'search-suggestions-dropdown';
    searchBar.appendChild(dd);
  }
  
  if (!dd) return;

  if (!q || !q.trim()) {
    dd.classList.remove('active');
    return;
  }

  const query = q.toLowerCase();
  
  // Reset index if search query changes
  if (query !== lastQueryText) {
    currentSuggestionIndex = 0;
    lastQueryText = query;
  }
  
  // Find matching products
  suggestedProducts = allProducts.filter(p => (p.name + ' ' + p.cat).toLowerCase().includes(query));
  
  if (suggestedProducts.length === 0) {
    dd.innerHTML = `<div style="padding: 1rem; color: #666;">No se encontraron resultados para "${q}"</div>`;
    dd.classList.add('active');
    return;
  }

  // Top 5 text suggestions
  const topTextMatches = suggestedProducts.slice(0, 5);
  // Find related category
  const matchCat = categories.find(c => c.id === suggestedProducts[0].cat);

  let html = `
    <div class="ss-left">
      <div class="ss-title">Sugerencias de búsqueda</div>
      ${topTextMatches.map(p => `
        <a href="productos.html?q=${encodeURIComponent(p.name)}" class="ss-item">
          <span>${p.name}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
        </a>
      `).join('')}
    </div>
    <div class="ss-right">
      <div class="ss-right-header">
        <div class="ss-right-title">Productos relacionados</div>
        <div class="ss-carousel-nav" style="display: flex; align-items: center; gap: 8px; margin-left: auto; margin-right: 16px;">
          <button class="ss-carousel-arrow prev" id="ss-carousel-prev" onclick="slideSuggestions(-1, event)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <button class="ss-carousel-arrow next" id="ss-carousel-next" onclick="slideSuggestions(1, event)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>
        <a href="productos.html?q=${encodeURIComponent(q)}" class="ss-view-all">Ver todos <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg></a>
      </div>
      <div class="ss-products-grid">
        <!-- Rendered dynamically by renderSuggestedProductsGrid -->
      </div>
      ${matchCat ? `
      <div class="ss-cats-area">
        <div class="ss-right-title">Categorías relacionadas</div>
        <a href="productos.html?cat=${matchCat.id}" class="ss-cat-btn">${matchCat.label}</a>
      </div>` : ''}
    </div>
  `;

  dd.innerHTML = html;
  dd.classList.add('active');
  
  // Render initial grid
  renderSuggestedProductsGrid();
}

// Helper to add to cart from suggestion without redirecting
window.ssAddToCart = function(e, id) {
  e.preventDefault();
  e.stopPropagation();
  addToCart(id);
  // Re-render suggestions to update "Agregar" to "Agregado"
  const input = document.getElementById('search-input');
  if (input) showSuggestions(input.value);
};

// Global scroll listener for "Volver arriba" button visibility
window.addEventListener('scroll', () => {
  const btn = document.querySelector('.float-scroll-top');
  if (btn) {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }
});

// Scroll to top with premium smooth behavior
window.scrollToTop = function() {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};

