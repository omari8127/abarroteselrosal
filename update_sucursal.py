import os
import re

svg_icon = '<span class="icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></span>'
new_content_inner = f'\n        {svg_icon}\n        <span>Sucursal: <strong>Anexa 20 de Noviembre</strong></span>\n      '

# Regex to find <div class="nav-sucursal">...</div> blocks
pattern = re.compile(r'(<div class="nav-sucursal">)(.*?)(</div>)', re.DOTALL)

for filename in os.listdir('.'):
    if filename.endswith('.html'):
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = pattern.sub(rf'\1{new_content_inner}\3', content)
            
            if new_content != content:
                with open(filename, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filename}")
        except Exception as e:
            print(f"Error updating {filename}: {e}")
