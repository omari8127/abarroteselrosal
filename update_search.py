import os
import glob
import re

html_files = glob.glob('c:/Users/El Rosal/Desktop/New folder/*.html')
for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the searchProducts call in oninput with showSuggestions
    content = re.sub(r'oninput="searchProducts\(&#36;this\.value\)"', 'oninput="showSuggestions(this.value)"', content)
    content = re.sub(r'oninput="searchProducts && searchProducts\(&#36;this\.value\)"', 'oninput="showSuggestions(this.value)"', content)
    
    # Actually wait, the regex above has &#36; instead of $? No, the original is searchProducts(this.value)
    # Let me fix the regex string
    content = re.sub(r'oninput="searchProducts\(this\.value\)"', 'oninput="showSuggestions(this.value)"', content)
    content = re.sub(r'oninput="searchProducts && searchProducts\(this\.value\)"', 'oninput="showSuggestions(this.value)"', content)
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print(f"Updated {len(html_files)} HTML files.")
