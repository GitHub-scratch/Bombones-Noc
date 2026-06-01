const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

console.log("--- REVISIÓN DE PT Y MOVIMIENTOS ---");

db.all("SELECT * FROM production LIMIT 5", (err, rows) => {
    console.log("\nÚltimas Producciones registradas:");
    console.table(rows);
    
    db.all("SELECT * FROM pt_movements", (err, rows) => {
        console.log("\nMovimientos de Stock PT (pt_movements):");
        console.table(rows);
        db.close();
    });
});
