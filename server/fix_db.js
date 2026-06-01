const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Verificando y actualizando tablas...');
    
    // Añadir min_stock a materials si no existe
    db.run("ALTER TABLE materials ADD COLUMN min_stock REAL DEFAULT 0", (err) => {
        if (err) {
            if (err.message.includes('duplicate column name')) {
                console.log('- Columna min_stock ya existe.');
            } else {
                console.error('- Error al añadir min_stock:', err.message);
            }
        } else {
            console.log('- Columna min_stock añadida con éxito.');
        }
    });

    // Verificar tabla production (por si acaso)
    db.run(`CREATE TABLE IF NOT EXISTS production (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rm_batch_id INTEGER,
        rm_quantity REAL,
        pt_name TEXT,
        pt_lote TEXT,
        pt_quantity REAL,
        chocolate_waste REAL DEFAULT 0,
        crumble_waste REAL DEFAULT 0,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (rm_batch_id) REFERENCES batches (id)
    )`, (err) => {
        if (err) console.error('- Error verificando tabla production:', err.message);
        else console.log('- Tabla production verificada.');
    });
});

db.close();
