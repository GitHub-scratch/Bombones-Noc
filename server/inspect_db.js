const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

console.log("--- INSPECCIÓN DE BASE DE DATOS ---");

db.all("PRAGMA table_info(production)", (err, rows) => {
    if (err) {
        console.error("Error leyendo info de tabla production:", err);
    } else {
        console.log("\nColumnas en tabla 'production':");
        rows.forEach(row => console.log(`- ${row.name} (${row.type})`));
    }
    
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        console.log("\nTablas existentes:");
        tables.forEach(t => console.log(`- ${t.name}`));
        db.close();
    });
});
