const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("C:/Users/el_re/everest-inventory/server/inventory.db");
db.all("PRAGMA table_info(usuarios)", [], (err, rows) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(JSON.stringify(rows, null, 2));
  db.close();
});
