const fs = require('fs');
const { retry } = require('./src/retry');
const db = JSON.parse(fs.readFileSync('db.json', 'utf8'));
if (db.rows.some((r) => r.stale)) { console.error('FAIL: stale rows in db.json'); process.exit(1); }
if (retry(() => 1) !== 1) process.exit(1);
console.log('ok');
