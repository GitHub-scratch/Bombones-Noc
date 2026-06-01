const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Iniciando reparación de tabla 'movements'...");

    // 1. Crear tabla temporal con la estructura correcta
    db.run(`CREATE TABLE movements_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        material_id INTEGER,
        batch_id INTEGER,
        lote TEXT,
        type TEXT CHECK(type IN ('IN', 'OUT', 'PROD')),
        quantity REAL NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        FOREIGN KEY (material_id) REFERENCES materials (id)
    )`);

    // 2. Copiar datos
    db.run(`INSERT INTO movements_new (id, material_id, batch_id, lote, type, quantity, date, description)
            SELECT id, material_id, batch_id, lote, type, quantity, date, description FROM movements`);

    // 3. Eliminar vieja y renombrar nueva
    db.run(`DROP TABLE movements`);
    db.run(`ALTER TABLE movements_new RENAME TO movements`);

    console.log("¡Tabla 'movements' reparada con éxito!");

    // Reparar también pt_movements por si acaso tiene el mismo problema
    db.get("SELECT sql FROM sqlite_master WHERE name='pt_movements'", (err, row) => {
        if (row && !row.sql.includes('PROD')) {
            console.log("Reparando pt_movements...");
            // Procedimiento similar para pt_movements si fuera necesario
        }
    });
});

db.close();
