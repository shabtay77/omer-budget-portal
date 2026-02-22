const fs = require('fs');
const path = 'public/workplans_data.json';
const full = fs.readFileSync(path, 'utf8');
let data;
try {
  data = JSON.parse(full);
} catch (e) {
  console.error('JSON parse error:', e.message);
  process.exit(1);
}
let changed = 0;
for (const item of data) {
  if (item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'wing')) {
    const val = item.wing;
    if (typeof val === 'string') {
      const norm = val.normalize ? val.normalize('NFC') : val;
      if (norm === 'שירות לתושב' || norm.includes('שירות לתושב')) {
        item.wing = 'שירות לתושב ודוברות';
        changed++;
      }
    }
  }
}
fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log('Updated', changed, 'entries');
