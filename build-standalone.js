const fs = require('fs');
const path = require('path');

// Read the built HTML file
const htmlPath = path.join(__dirname, 'dist', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf-8');

// Find the script tag
const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
if (scriptMatch) {
  const jsFile = scriptMatch[1];
  const jsPath = path.join(__dirname, 'dist', jsFile);
  
  // Read the JS file
  const jsContent = fs.readFileSync(jsPath, 'utf-8');
  
  // Replace the script tag with inline script
  html = html.replace(
    scriptMatch[0],
    `<script type="module">\n${jsContent}\n</script>`
  );
  
  // Write standalone HTML
  fs.writeFileSync(path.join(__dirname, 'index-standalone.html'), html);
  console.log('Standalone HTML generated: index-standalone.html');
}
