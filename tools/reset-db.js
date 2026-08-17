const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
fs.copyFileSync(path.join(root,'data','seed_db.json'), path.join(root,'data','db.json'));
console.log('Database reset to source seed.');
