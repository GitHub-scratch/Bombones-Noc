const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT * FROM materials", [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log("Materiales:", rows);
  }
  db.close();
});
