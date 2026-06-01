const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

db.get("SELECT sql FROM sqlite_master WHERE name='movements'", (err, row) => {
    if (err) console.error(err);
    else console.log(row.sql);
    db.close();
});
