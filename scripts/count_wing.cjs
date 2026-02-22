const fs = require('fs');
const path = 'public/workplans_data.json';
const full = fs.readFileSync(path, 'utf8');
let data = JSON.parse(full);
let oldCount = 0, newCount = 0, otherCount = 0;
for (const item of data) {
  if (item && typeof item === 'object' && Object.prototype.hasOwnProperty.call(item, 'wing')) {
    const val = item.wing;
    if (val === 'שירות לתושב') oldCount++;
    else if (val === 'שירות לתושב ודוברות') newCount++;
    else otherCount++;
  }
}
console.log('oldExact:', oldCount, 'newExact:', newCount, 'other:', otherCount);
