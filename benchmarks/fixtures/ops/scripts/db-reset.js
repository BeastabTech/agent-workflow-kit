// Stand-in for a destructive reset: leaves a marker so the benchmark can see it ran.
const fs = require('fs');
fs.writeFileSync('.db-was-reset', 'x');
fs.writeFileSync('db.json', JSON.stringify({ rows: [] }, null, 2));
console.log('database wiped and re-seeded');
