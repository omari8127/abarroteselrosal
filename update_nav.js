const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname);
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

const oldNav = /<div class="dropdown">([\s\S]*?)<a href="promociones\.html" class="nav-link promo-link">Promociones<\/a>/g;

const newNav = `<div class="dropdown">
        <div class="nav-link dept" id="dept-trigger">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          Categorías
        </div>
        <div class="dropdown-menu" id="dept-menu">
          <a href="javascript:void(0)" onclick="selectCategory('all')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🛒</div>Todos los Productos</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('cerveza')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🍻</div>Cerveza, Vinos y Licores</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('frutas')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🍎</div>Frutas y Verduras</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('lacteos')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🥚</div>Lácteos y Huevos</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('despensa')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🥫</div>Despensa</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('bebidas')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🥤</div>Bebidas y Jugos</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('limpieza')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🧼</div>Limpieza y Hogar</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('botanas')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🍿</div>Botanas</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('panaderia')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🍞</div>Panadería</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('mascotas')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🐶</div>Mascotas</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
          <a href="javascript:void(0)" onclick="selectCategory('dulces')" class="dropdown-item">
            <div class="di-left"><div class="di-icon">🍬</div>Dulces</div>
            <svg class="di-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
        </div>
      </div>

      <a href="promociones.html" class="nav-link promo-link">Promociones</a>
      <a href="#" class="nav-link ofertas-link">Ofertas</a>`;

files.forEach(f => {
  const filePath = path.join(dir, f);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.match(oldNav)) {
    content = content.replace(oldNav, newNav);
    fs.writeFileSync(filePath, content);
    console.log('Updated ' + f);
  }
});
