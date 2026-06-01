const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'inventory.db');
const backupsDir = path.resolve(__dirname, 'backups');

// 1. Crear backup de seguridad
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir);
}
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupPath = path.join(backupsDir, `backup_PRE_RESET_${timestamp}.db`);

console.log("Creando copia de seguridad en:", backupPath);
try {
  fs.copyFileSync(dbPath, backupPath);
  console.log("¡Copia de seguridad creada con éxito!");
} catch (e) {
  console.error("Error al crear copia de seguridad. Abortando reset:", e.message);
  process.exit(1);
}

// 2. Conectar a la base de datos
const db = new sqlite3.Database(dbPath);

const tablesToReset = [
  'batches',
  'movements',
  'production',
  'production_ingredients',
  'production_sessions',
  'production_session_ingredients',
  'production_progress',
  'pt_movements',
  'audit_log'
];

db.serialize(() => {
  console.log("\nIniciando proceso de reseteo...");

  // Desactivar claves foráneas temporalmente para evitar restricciones de borrado
  db.run("PRAGMA foreign_keys = OFF");

  tablesToReset.forEach(table => {
    db.run(`DELETE FROM ${table}`, (err) => {
      if (err) {
        console.error(`Error al vaciar tabla ${table}:`, err.message);
      } else {
        console.log(`- Tabla '${table}' vaciada.`);
      }
    });
  });

  // Resetear contadores de autoincremento en sqlite_sequence para las tablas vaciadas
  tablesToReset.forEach(table => {
    db.run(`DELETE FROM sqlite_sequence WHERE name = ?`, [table], (err) => {
      if (err) {
        console.error(`Error al resetear secuencia de ${table}:`, err.message);
      }
    });
  });

  // Reactivar claves foráneas
  db.run("PRAGMA foreign_keys = ON");

  // Registrar el reset en la tabla de auditoría para trazabilidad básica
  db.run(`INSERT INTO audit_log (usuario_id, username, accion, detalle) VALUES (?, ?, ?, ?)`, 
    [1, 'admin', 'RESET_BASE_DATOS', `Reseteo total de stock e historial. Copia previa guardada como ${path.basename(backupPath)}`], 
    (err) => {
      if (err) {
        console.error("Error registrando auditoría del reset:", err.message);
      } else {
        console.log("- Registro de auditoría del reseteo insertado con éxito.");
      }
    }
  );

  console.log("\n¡Reseteo completado con éxito!");
});

db.close();
