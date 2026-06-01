const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./inventory.db');

db.serialize(() => {
  // Eliminar tabla vieja y recrear con todas las columnas correctas
  db.run('DROP TABLE IF EXISTS usuarios', (err) => {
    if (err) { console.log('Error al eliminar tabla:', err.message); return; }
    console.log('Tabla antigua eliminada');

    db.run(`CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT DEFAULT 'operador',
      permisos TEXT DEFAULT '{}',
      activo INTEGER DEFAULT 1
    )`, (err) => {
      if (err) { console.log('Error al crear tabla:', err.message); return; }
      console.log('Tabla nueva creada');

      const hash1 = bcrypt.hashSync('admin123', 10);
      const p1 = JSON.stringify({dashboard:true,inventory:true,production:true,guarda:true,settings:true,respaldo:true});
      db.run('INSERT INTO usuarios (username,password,nombre,rol,permisos) VALUES (?,?,?,?,?)',
        ['admin', hash1, 'Administrador', 'admin', p1],
        (err) => { console.log(err ? 'Error admin: ' + err.message : 'Usuario admin OK'); }
      );

      const hash2 = bcrypt.hashSync('operador123', 10);
      const p2 = JSON.stringify({dashboard:true,inventory:true,production:true,guarda:true,settings:false,respaldo:false});
      db.run('INSERT INTO usuarios (username,password,nombre,rol,permisos) VALUES (?,?,?,?,?)',
        ['operador1', hash2, 'Operador 1', 'operador', p2],
        (err) => {
          console.log(err ? 'Error operador: ' + err.message : 'Usuario operador1 OK');
          db.close(() => console.log('--- Listo ---'));
        }
      );
    });
  });
});
