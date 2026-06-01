const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

const tables = [
  'materials',
  'batches',
  'movements',
  'production',
  'production_ingredients',
  'production_sessions',
  'production_session_ingredients',
  'production_progress',
  'pt_movements',
  'usuarios',
  'audit_log'
];

console.log("--- CONTEO DE FILAS EN TABLAS ---");

let completed = 0;
tables.forEach(table => {
  db.get(`SELECT COUNT(*) as count FROM ${table}`, [], (err, row) => {
    if (err) {
      console.error(`Error en ${table}:`, err.message);
    } else {
      console.log(`- ${table}: ${row.count} filas`);
    }
    completed++;
    if (completed === tables.length) {
      db.close();
    }
  });
});
