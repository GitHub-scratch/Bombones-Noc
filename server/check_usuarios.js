const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./inventory.db');

// Ver qué hay exactamente en la tabla usuarios
db.all("SELECT id, username, nombre, rol, permisos, activo FROM usuarios", [], (err, rows) => {
  if (err) { console.log('Error:', err.message); db.close(); return; }
  console.log('Usuarios encontrados:', rows.length);
  rows.forEach(r => {
    console.log('---');
    console.log('ID:', r.id, '| User:', r.username, '| Rol:', r.rol, '| Activo:', r.activo);
    console.log('Permisos raw:', JSON.stringify(r.permisos));
    try { JSON.parse(r.permisos); console.log('Permisos JSON: OK'); }
    catch(e) { console.log('Permisos JSON: INVALIDO -', e.message); }
  });
  db.close();
});
