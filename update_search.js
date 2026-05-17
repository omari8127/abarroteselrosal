const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/El Rosal/Desktop/New folder';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    content = content.replace(/oninput="searchProducts\(this\.value\)"/g, 'oninput="showSuggestions(this.value)"');
    content = content.replace(/oninput="searchProducts && searchProducts\(this\.value\)"/g, 'oninput="showSuggestions(this.value)"');
    
    fs.writeFileSync(filePath, content, 'utf8');
});

console.log(`Updated ${files.length} HTML files.`);
