const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

console.log("--- REVISIÓN DE INGREDIENTES GUARDADOS ---");

db.all("SELECT * FROM production_ingredients", (err, rows) => {
    if (err) console.error(err);
    else {
        console.log("Registros en 'production_ingredients':", rows.length);
        console.table(rows);
    }
    
    db.all("SELECT id, pt_name, pt_lote FROM production ORDER BY id DESC LIMIT 5", (err, rows) => {
        console.log("\nÚltimas Producciones:");
        console.table(rows);
        db.close();
    });
});
