import os
import re

# Nuevo diseño de footer - Oscuro y Premium
fixed_footer = """
  <footer class="site-footer">
    <div class="sf-inner">
      <div class="sf-col sf-col--brand">
        <div class="sf-brand">
          <span class="sf-brand-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: text-bottom; margin-right: 4px;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg></span>
          <span class="sf-brand-name">Abarrotes El Rosal</span>
        </div>
        <p class="sf-tagline">Calidad y frescura en cada pedido.<br>Tu supermercado de confianza en línea.</p>
        <ul class="sf-info-list">
          <li>
            <svg class="sf-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Anexa 20 de Noviembre, Tijuana, B.C.
          </li>
        </ul>
      </div>

      <div class="sf-col">
        <h3 class="sf-col-title">Centro de Ayuda</h3>
        <ul class="sf-links">
          <li><a href="index.html">Inicio</a></li>
          <li><a href="productos.html">Productos</a></li>
          <li><a href="promociones.html">Promociones</a></li>
        </ul>
      </div>

      <div class="sf-col">
        <h3 class="sf-col-title">Servicio al cliente</h3>
        <ul class="sf-links">
          <li class="sf-link-text">Horario de Atención</li>
          <li class="sf-link-text sf-schedule">Lunes a Domingo<br>9:00 AM a 9:00 PM</li>
          <li><a href="https://wa.me/526643944760" target="_blank">WhatsApp: 664-394-4760</a></li>
        </ul>
      </div>

      <div class="sf-col sf-col--social">
        <h3 class="sf-col-title">Síguenos</h3>
        <div class="sf-social-row">
          <a href="#" class="sf-soc" aria-label="Facebook"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg></a>
          <a href="#" class="sf-soc" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg></a>
          <a href="https://wa.me/526643944760" target="_blank" class="sf-soc" aria-label="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg></a>
        </div>
      </div>
    </div>
    <div class="sf-sub">
      <span class="sf-copy">© 2026 Abarrotes El Rosal. Todos los derechos reservados.</span>
      <span class="sf-address">Tijuana, Baja California, México.</span>
    </div>

    <style>
      .site-footer { background: #111; color: rgba(255,255,255,0.7); margin-top: 4rem; font-family: 'Barlow', sans-serif; }
      .sf-inner { max-width: 1200px; margin: 0 auto; padding: 3rem 2rem 2rem; display: grid; grid-template-columns: 1.5fr 1fr 1.2fr 1fr; gap: 2rem; }
      .sf-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid rgba(255,255,255,0.1); }
      .sf-brand-name { font-family: 'Barlow Condensed', sans-serif; font-size: 1.25rem; font-weight: 900; color: #fff; }
      .sf-tagline { font-size: 0.82rem; color: rgba(255,255,255,0.5); line-height: 1.5; margin-bottom: 12px; }
      .sf-info-list { list-style: none; padding: 0; margin: 0; }
      .sf-info-list li { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: rgba(255,255,255,0.6); }
      .sf-icon { width: 16px; height: 16px; opacity: 0.6; }
      .sf-col-title { font-size: 0.95rem; font-weight: 800; color: #fff; margin-bottom: 1rem; border-bottom: 2px solid var(--blue); display: inline-block; padding-bottom: 4px; }
      .sf-links { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
      .sf-links a { color: rgba(255,255,255,0.6); text-decoration: none; font-size: 0.88rem; transition: color 0.2s; }
      .sf-links a:hover { color: #fff; }
      .sf-link-text { font-size: 0.88rem; color: rgba(255,255,255,0.6); }
      .sf-social-row { display: flex; gap: 10px; }
      .sf-soc { display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 8px; background: rgba(255,255,255,0.05); color: #fff; transition: all 0.2s; }
      .sf-soc:hover { background: var(--blue); transform: translateY(-2px); }
      .sf-sub { border-top: 1px solid rgba(255,255,255,0.05); padding: 1rem 2rem; max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; font-size: 0.75rem; color: rgba(255,255,255,0.4); }
      @media (max-width: 800px) { .sf-inner { grid-template-columns: 1fr 1fr; } }
      @media (max-width: 500px) { .sf-inner { grid-template-columns: 1fr; } .sf-sub { flex-direction: column; gap: 10px; text-align: center; } }
    </style>
  </footer>
"""

emojis = [
    '🛒', '🍻', '🍎', '🥚', '🥫', '🥤', '🧼', '🍿', '🍞', '🐶', '🍬', 
    '🍤', '🐟', '🥩', '🥑', '🌿', '🥜', '🛍️', '🚚', '🏪', '💵', '📲', '✅', '🏠', '👤', '✏️', '📦', 'Door', 'Lock',
    '🚪', '🔒', '🥛', '🍚', '🧴', '🍺', '🥦', '🐾', '🫙', '🧀', '🧈', '☕', '💧', '🍊', '🥭', '🌺', '⚡', '🌶️', '🫘', '🫒', '🧂', '🍜', '🍝', '🍅', '🍗', '🌽', '🌾', '🥞', '🧺', '🌸', '🌲', '💜', '🍋', '✨', '🧻', '🗒️', '🧽', '🗑️', '🚽', '🪲', '🚿', '🪥', '🥔', '🥖', '🍌'
]

def update_content(content):
    # Eliminar emojis
    for emoji in emojis:
        content = content.replace(emoji, '')
    
    # Reducir rojo excesivo con Regex para manejar espacios
    content = re.sub(r'background:\s*var\(--red\)', 'background: var(--blue)', content)
    content = re.sub(r'background-color:\s*var\(--red\)', 'background-color: var(--blue)', content)
    content = re.sub(r'color:\s*var\(--red\)', 'color: var(--blue)', content)
    
    # Colores específicos en productos.js
    content = content.replace('#c0392b', '#2c3e50') # Red to Dark Blue/Grey
    
    return content

def update_html(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    content = update_content(content)

    if '<footer' in content:
        content = re.sub(r'<footer.*?</footer>', fixed_footer, content, flags=re.DOTALL)
        content = re.sub(r'<style>\s*/\* ── SITE FOOTER.*?\s*</style>', '', content, flags=re.DOTALL)
    else:
        content = content.replace('</body>', fixed_footer + '\n</body>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def update_js(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    content = update_content(content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

# HTML files
for f in os.listdir('.'):
    if f.endswith('.html'):
        update_html(f)

# JS files
if os.path.exists('js'):
    for f in os.listdir('js'):
        if f.endswith('.js'):
            update_js(os.path.join('js', f))

# Data files
if os.path.exists('data'):
    for f in os.listdir('data'):
        if f.endswith('.js'):
            update_js(os.path.join('data', f))

print("¡Listo! Emojis eliminados, rojo reducido y footer actualizado en todo el proyecto.")
