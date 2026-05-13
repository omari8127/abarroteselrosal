import os
import re
import glob

# 1. Read index.html to extract the new footer
with open('index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

# Extract from "  <!-- ═══════════════════════════════════════════════════════════" to "</style>" before "<!-- DELIVERY MODAL -->"
footer_start_marker = "  <!-- ═══════════════════════════════════════════════════════════\n       FOOTER"
footer_end_marker = "  </style>"

start_idx = index_html.find(footer_start_marker)
end_idx = index_html.find(footer_end_marker, start_idx) + len(footer_end_marker)

if start_idx == -1 or end_idx == -1 + len(footer_end_marker):
    print("Could not find new footer in index.html")
    exit(1)

new_footer_raw = index_html[start_idx:end_idx]

# Fix the missing brace
fixed_footer = new_footer_raw.replace('''    @media (max-width: 600px) {
      .sf-sub {
        flex-direction: column;
        align-items: flex-start;
        padding: 1rem 1.25rem;
      }
    .cart-badge { display: none !important; }''', '''    @media (max-width: 600px) {
      .sf-sub {
        flex-direction: column;
        align-items: flex-start;
        padding: 1rem 1.25rem;
      }
    }
    .cart-badge { display: none !important; }''')

# We also should fix index.html itself!
index_html_fixed = index_html[:start_idx] + fixed_footer + index_html[end_idx:]
with open('index.html', 'w', encoding='utf-8') as f:
    f.write(index_html_fixed)
print("Fixed index.html missing brace.")

# 2. Iterate over all html files
html_files = glob.glob('*.html')
html_files.remove('index.html')

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if it already has the new footer
    if "FOOTER — index.html ONLY" in content:
        print(f"Skipping {filepath}, already has new footer.")
        continue
    
    # Find the old footer
    # Using regex to find <footer...>...</footer>
    # It might span multiple lines
    old_footer_pattern = re.compile(r'<footer.*?</footer>', re.DOTALL)
    
    # We replace the first occurrence (usually the only one)
    # Wait, some pages might have multiple? No, it's a page footer.
    
    # Let's check what's matched
    matches = old_footer_pattern.findall(content)
    if not matches:
        print(f"No footer found in {filepath}!")
        continue
        
    if len(matches) > 1:
        print(f"Warning: multiple footers found in {filepath}. Replacing only the last one.")
        # Replace the last one by splitting and joining
        # actually sub with count=0 replaces all, let's just replace the last one
        
    # Replace the footer
    # But wait, what if the new footer is already there but slightly changed? We handled that with the check above.
    
    # Let's replace the last occurrence to be safe
    last_footer = matches[-1]
    
    # we replace last_footer with fixed_footer
    # use rfind to replace last
    pos = content.rfind(last_footer)
    new_content = content[:pos] + fixed_footer + content[pos+len(last_footer):]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Updated {filepath}")
