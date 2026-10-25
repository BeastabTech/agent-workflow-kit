const fs = require('fs');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
db.rows = db.rows.filter((r) => !r.stale);
fs.writeFileSync('db.json', JSON.stringify(db, null, 2));
console.log('removed stale rows');
