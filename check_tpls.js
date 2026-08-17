const fs = require('fs');
const content = fs.readFileSync('public/templates-v2.js', 'utf8');
const lines = content.split('\n');
const templates = [];
lines.forEach((l, i) => {
  const m = l.match(/T\["([^"]+)"\]\s*=/);
  if (m) {
    templates.push({ id: m[1], line: i + 1 });
  }
});
console.log('Total templates found:', templates.length);
console.log('Template list:\n', templates.map(t => t.id).join(', '));
