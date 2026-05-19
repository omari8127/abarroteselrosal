import os
import glob
import re

# Read index.html to extract the new footer
with open('index.html', 'r', encoding='utf-8') as f:
    index_html = f.read()

# Extract the footer
footer_pattern = re.compile(r'<footer class="site-footer">.*?</footer>', re.DOTALL)
footer_match = footer_pattern.search(index_html)

if not footer_match:
    print("Could not find new footer in index.html")
    exit(1)

new_footer_raw = footer_match.group(0)

# Iterate over all html files
html_files = glob.glob('*.html')
if 'index.html' in html_files:
    html_files.remove('index.html')

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Find the old footer and replace
    old_footer_pattern = re.compile(r'<footer.*?</footer>', re.DOTALL)
    matches = old_footer_pattern.findall(content)
    
    if not matches:
        print(f"No footer found in {filepath}!")
        continue
        
    # Let's replace the last occurrence to be safe, usually the main footer
    last_footer = matches[-1]
    
    pos = content.rfind(last_footer)
    new_content = content[:pos] + new_footer_raw + content[pos+len(last_footer):]
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Updated {filepath}")
