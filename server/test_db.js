const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath);

const query = `
    SELECT m.id as material_id, m.name, m.unit, m.min_stock,
           b.id as batch_id, b.lote, b.quantity, b.expiry_date
    FROM materials m
    LEFT JOIN batches b ON m.id = b.material_id AND b.quantity > 0
    ORDER BY m.name ASC, b.expiry_date ASC
`;

db.all(query, [], (err, rows) => {
    if (err) {
        console.error('ERROR EN QUERY:', err.message);
    } else {
        console.log('RESULTADOS:', rows.length);
        console.log(JSON.stringify(rows.slice(0, 2), null, 2));
    }
    db.close();
});
