import re

with open(r'c:\Users\Omar\Desktop\New folder\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

new_section = '''

  <!-- ── SECCION: RECIEN AGREGADOS ── -->
  <div class="section-wrap" id="recientes-section">
    <div class="recientes-banner">
      <img src="img/recien_agregados.png" alt="Recien Agregados" class="recientes-banner-img">
      <div class="recientes-banner-overlay">
        <div class="recientes-banner-content">
          <div class="recientes-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Nuevo
          </div>
          <h2 class="recientes-title">Recien Agregados</h2>
          <p class="recientes-sub">Lo mas nuevo en nuestra tienda</p>
        </div>
        <a href="productos.html" class="recientes-ver-mas">
          Ver catalogo completo
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>
    </div>
    <div class="products-grid" id="recientes-products"></div>
  </div>'''

# Find the marker: closing of featured-section and opening of search-results
marker = '<div id="search-results"'
pos = content.find(marker)
if pos != -1:
    content = content[:pos] + new_section + '\n\n  ' + content[pos:]
    with open(r'c:\Users\Omar\Desktop\New folder\index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Done - inserted Recien Agregados section at position', pos)
else:
    print('Marker not found!')
    print(repr(content[7000:7200]))
