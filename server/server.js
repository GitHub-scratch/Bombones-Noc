const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'bombones_noc_secret_2026';

// ── Configuración Respaldo Local ──
const BACKUPS_LOCAL_PATH = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUPS_LOCAL_PATH)) fs.mkdirSync(BACKUPS_LOCAL_PATH);

const doBackup = async () => {
  const dbPath = path.resolve(__dirname, 'inventory.db');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupName = `backup_${timestamp}.db`;
  const localBackupPath = path.join(BACKUPS_LOCAL_PATH, backupName);
  fs.copyFileSync(dbPath, localBackupPath);
  console.log(`[Backup] Guardado: ${backupName}`);
  const allFiles = fs.readdirSync(BACKUPS_LOCAL_PATH);
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  allFiles.forEach(f => {
    const fp = path.join(BACKUPS_LOCAL_PATH, f);
    if (fs.statSync(fp).mtimeMs < cutoff) fs.unlinkSync(fp);
  });
  return { name: backupName };
};

setInterval(async () => {
  try { await doBackup(); console.log('[Backup] Automático completado'); }
  catch (e) { console.error('[Backup] Error automático:', e.message); }
}, 24 * 60 * 60 * 1000);

const app = express();
const PORT = 3001;

const PRINTER_NAME = "\\\\PC-NOC\\ZDesigner ZD420-203dpi ZPL";
const LABELS_PATH = path.join(__dirname, '..', 'client', 'src', 'Etiquetas a imprimir');

app.use(cors());
app.use(bodyParser.json());

// ── API Routes para Impresión ──
app.post('/api/label-preview', (req, res) => {
  const { pt_lote, date, exp_date } = req.body;
  console.log(`--- Solicitud de Preview para Lote: ${pt_lote} ---`);
  if (!pt_lote) return res.status(400).json({ error: 'Lote no proporcionado' });

  let fileName = "";
  if (pt_lote.startsWith('FBD')) fileName = "ETIQUETA_L.zpl";
  else if (pt_lote.startsWith('FBA')) fileName = "ETIQUETA_A.zpl";
  else if (pt_lote.startsWith('FRB')) fileName = "ETIQUETA_R.zpl";
  else return res.status(400).json({ error: 'Prefijo no reconocido (Use FBD, FBA o FRB)' });

  const filePath = path.join(LABELS_PATH, fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo .zpl no encontrado' });

  try {
    const buffer = fs.readFileSync(filePath);
    let zpl = buffer.toString('utf8');
    const firstXA = zpl.indexOf('^XA');
    if (firstXA !== -1) zpl = zpl.substring(firstXA);
    const prodDateStr = (date || new Date().toISOString()).split('T')[0];
    const expDateStr = exp_date
      ? exp_date.split('T')[0]
      : (() => {
          const parts = prodDateStr.split('-');
          return `${parseInt(parts[0]) + 1}-${parts[1]}-${parts[2]}`;
        })();
    const fp = `${prodDateStr.slice(5,7)}/${prodDateStr.slice(2,4)}`;
    const fv = `${expDateStr.slice(5,7)}/${expDateStr.slice(2,4)}`;
    console.log(`Reemplazando: FP=${fp}, FV=${fv}, Lote=${pt_lote}`);
    zpl = zpl.replace(/FDF\.P \d{2}\/\d{2}/g, `FDF.P ${fp}`);
    zpl = zpl.replace(/FDF\.V \d{2}\/\d{2}/g, `FDF.V ${fv}`);
    zpl = zpl.replace(/FDLOTE: [A-Z0-9]+/g, `FDLOTE: ${pt_lote}`);
    res.json({ zpl: zpl.trim() });
  } catch (err) {
    console.error("Error en preview:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/print-labels', (req, res) => {
  const { pt_lote, pt_quantity, date, custom_zpl } = req.body;
  if (!pt_lote && !custom_zpl) return res.status(400).json({ error: 'Datos insuficientes' });
  try {
    let zplContent = "";
    if (custom_zpl) {
      zplContent = custom_zpl;
    } else {
      let fileName = pt_lote.startsWith('FBD') ? "ETIQUETA_L.prn" : pt_lote.startsWith('FBA') ? "ETIQUETA_A.prn" : "ETIQUETA_R.prn";
      zplContent = fs.readFileSync(path.join(LABELS_PATH, fileName), 'utf8');
    }
    const qty = Math.ceil(parseFloat(pt_quantity) || 1);
    zplContent = zplContent.replace(/\^PQ\d+/, `^PQ${qty}`);
    const tempFilePath = path.join(__dirname, 'temp_label.zpl');
    fs.writeFileSync(tempFilePath, zplContent);
    const command = `copy /b "${tempFilePath}" "${PRINTER_NAME}"`;
    exec(command, (error) => {
      if (error) return res.status(500).json({ error: 'Error de impresora: ' + error.message });
      res.json({ success: true, message: `Imprimiendo ${qty} etiquetas...` });
      setTimeout(() => { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); }, 5000);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Base de Datos ──
const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Error opening database', err);
  else console.log('Connected to SQLite database');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    category TEXT DEFAULT 'OTRO',
    min_stock REAL DEFAULT 0
  )`);
  db.run("ALTER TABLE materials ADD COLUMN category TEXT DEFAULT 'OTRO'", (err) => {
    if (err) { /* columna ya existe */ }
  });
  db.run(`CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id INTEGER,
    lote TEXT NOT NULL,
    quantity REAL NOT NULL,
    expiry_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (material_id) REFERENCES materials (id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS movements (
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
  db.run(`CREATE TABLE IF NOT EXISTS production (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pt_name TEXT,
    pt_lote TEXT,
    pt_quantity REAL,
    pt_unit TEXT,
    chocolate_left REAL DEFAULT 0,
    crumble_waste REAL DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run("ALTER TABLE production ADD COLUMN pt_unit TEXT", (err) => {
    if (err) { /* columna ya existe */ }
  });
  db.run("ALTER TABLE production ADD COLUMN crumble_waste REAL DEFAULT 0", (err) => {
    if (err) { /* columna ya existe */ }
  });
  db.run("ALTER TABLE production ADD COLUMN chocolate_left REAL DEFAULT 0", (err) => {
    if (err) { /* columna ya existe */ }
  });
  db.run("ALTER TABLE production ADD COLUMN est1_final_est REAL DEFAULT 0", (err) => {
    if (err) { /* columna ya existe */ }
  });
  db.run("ALTER TABLE production ADD COLUMN est2_final_est REAL DEFAULT 0", (err) => {
    if (err) { /* columna ya existe */ }
  });
  db.run("ALTER TABLE production ADD COLUMN kg_frambuesa_total REAL DEFAULT 0", (err) => {
    if (err) { /* columna ya existe */ }
  });
  db.run(`CREATE TABLE IF NOT EXISTS production_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'ACTIVE',
    description TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS production_session_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    batch_id INTEGER,
    quantity REAL NOT NULL,
    FOREIGN KEY (session_id) REFERENCES production_sessions (id),
    FOREIGN KEY (batch_id) REFERENCES batches (id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS production_ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    production_id INTEGER,
    batch_id INTEGER,
    quantity REAL NOT NULL,
    FOREIGN KEY (production_id) REFERENCES production (id),
    FOREIGN KEY (batch_id) REFERENCES batches (id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS pt_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pt_name TEXT NOT NULL,
    pt_lote TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    type TEXT CHECK(type IN ('PROD', 'OUT')),
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    destination TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS production_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES production_sessions (id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nombre TEXT NOT NULL,
    rol TEXT CHECK(rol IN ('admin', 'operador')) DEFAULT 'operador',
    permisos TEXT DEFAULT '{}',
    activo INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    username TEXT,
    accion TEXT NOT NULL,
    detalle TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.get("SELECT id FROM usuarios WHERE username = 'admin'", [], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin123', 10);
      const permisos = JSON.stringify({ dashboard: true, inventory: true, production: true, guarda: true, settings: true, respaldo: true });
      db.run("INSERT INTO usuarios (username, password_hash, nombre, rol, permisos) VALUES (?, ?, ?, 'admin', ?)", ['admin', hash, 'Administrador', permisos]);
    }
  });

  db.get("SELECT id FROM usuarios WHERE username = 'operador1'", [], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('operador123', 10);
      const permisos = JSON.stringify({ dashboard: true, inventory: true, production: true, guarda: true, settings: false, respaldo: false });
      db.run("INSERT INTO usuarios (username, password_hash, nombre, rol, permisos) VALUES (?, ?, ?, 'operador', ?)", ['operador1', hash, 'Operador 1', permisos]);
    }
  });
});

// ── API Routes para Sesiones de Producción ──
app.get('/api/production/sessions', (req, res) => {
  db.all('SELECT * FROM production_sessions WHERE status = "ACTIVE" ORDER BY start_date DESC', [], (err, sessions) => {
    if (err) return res.status(500).json({ error: err.message });
    const ingQuery = `
      SELECT psi.*, m.name as material_name, b.lote, m.unit
      FROM production_session_ingredients psi
      JOIN batches b ON psi.batch_id = b.id
      JOIN materials m ON b.material_id = m.id
    `;
    db.all(ingQuery, [], (err, allIngredients) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all('SELECT * FROM production_progress', [], (err, allProgress) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json(sessions.map(s => ({ 
          ...s, 
          ingredients: allIngredients.filter(i => i.session_id === s.id),
          progress: allProgress.filter(p => p.session_id === s.id)
        })));
      });
    });
  });
});

app.post('/api/production/sessions/progress', (req, res) => {
  const { session_id, quantity, unit } = req.body;
  if (!session_id || !quantity || !unit) return res.status(400).json({ error: 'Datos incompletos para el avance' });

  db.run('INSERT INTO production_progress (session_id, quantity, unit) VALUES (?, ?, ?)',
    [session_id, quantity, unit], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    });
});

app.post('/api/production/sessions/start', (req, res) => {
  const { ingredients, description, product_name, format } = req.body;
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0)
    return res.status(400).json({ error: 'Se requiere al menos una materia prima' });

  const validatePromises = ingredients.map(ing =>
    new Promise((resolve, reject) => {
      db.get('SELECT b.*, m.name FROM batches b JOIN materials m ON b.material_id = m.id WHERE b.id = ?', [ing.batch_id], (err, batch) => {
        if (err || !batch) reject(`Lote de ingrediente ${ing.batch_id} no encontrado`);
        else if (batch.quantity < ing.quantity) reject(`Stock insuficiente para ${batch.name} (Lote: ${batch.lote})`);
        else resolve(batch);
      });
    })
  );

  Promise.all(validatePromises).then(batches => {
    db.serialize(() => {
      db.run('INSERT INTO production_sessions (description, product_name, format) VALUES (?, ?, ?)', 
        [description || 'Nueva carga', product_name, format || 'CAJAS'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const sessionId = this.lastID;
        const ingredientPromises = ingredients.map((ing, index) => {
          const batch = batches[index];
          const newQty = batch.quantity - ing.quantity;
          return new Promise((res_ing, rej_ing) => {
            db.run('UPDATE batches SET quantity = ? WHERE id = ?', [newQty, ing.batch_id], (err) => {
              if (err) return rej_ing(err.message);
              db.run('INSERT INTO production_session_ingredients (session_id, batch_id, quantity) VALUES (?, ?, ?)',
                [sessionId, ing.batch_id, ing.quantity], (err) => {
                  if (err) return rej_ing(err.message);
                  db.run('INSERT INTO movements (material_id, batch_id, lote, type, quantity, description) VALUES (?, ?, ?, "PROD", ?, ?)',
                    [batch.material_id, ing.batch_id, batch.lote, ing.quantity, `Carga Producción: Sesión ${sessionId}`], (err) => {
                      if (err) return rej_ing(err.message);
                      res_ing();
                    });
                });
            });
          });
        });
        Promise.all(ingredientPromises).then(() => {
          res.json({ success: true, id: sessionId });
        }).catch(err_msg => res.status(500).json({ error: 'Error procesando ingredientes: ' + err_msg }));
      });
    });
  }).catch(error => res.status(400).json({ error }));
});

app.post('/api/production/sessions/refill', (req, res) => {
  const { session_id, ingredients } = req.body;
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0)
    return res.status(400).json({ error: 'Se requiere al menos una materia prima para la recarga' });

  const validatePromises = ingredients.map(ing =>
    new Promise((resolve, reject) => {
      db.get('SELECT b.*, m.name FROM batches b JOIN materials m ON b.material_id = m.id WHERE b.id = ?', [ing.batch_id], (err, batch) => {
        if (err || !batch) reject(`Lote de ingrediente ${ing.batch_id} no encontrado`);
        else if (batch.quantity < ing.quantity) reject(`Stock insuficiente para ${batch.name} (Lote: ${batch.lote})`);
        else resolve(batch);
      });
    })
  );

  Promise.all(validatePromises).then(batches => {
    db.serialize(() => {
      const ingredientPromises = ingredients.map((ing, index) => {
        const batch = batches[index];
        const newQty = batch.quantity - ing.quantity;
        return new Promise((res_ing, rej_ing) => {
          db.run('UPDATE batches SET quantity = ? WHERE id = ?', [newQty, ing.batch_id], (err) => {
            if (err) return rej_ing(err.message);
            db.run('INSERT INTO production_session_ingredients (session_id, batch_id, quantity) VALUES (?, ?, ?)',
              [session_id, ing.batch_id, ing.quantity], (err) => {
                if (err) return rej_ing(err.message);
                db.run('INSERT INTO movements (material_id, batch_id, lote, type, quantity, description) VALUES (?, ?, ?, "PROD", ?, ?)',
                  [batch.material_id, ing.batch_id, batch.lote, ing.quantity, `Recarga Producción: Sesión ${session_id}`], (err) => {
                    if (err) return rej_ing(err.message);
                    res_ing();
                  });
              });
          });
        });
      });
      Promise.all(ingredientPromises).then(() => {
        res.json({ success: true });
      }).catch(err_msg => res.status(500).json({ error: 'Error procesando recarga: ' + err_msg }));
    });
  }).catch(error => res.status(400).json({ error }));
});

app.post('/api/production/sessions/finish', (req, res) => {
  const { session_id, pt_name, pt_lote, pt_quantity, pt_unit, crumble_waste, est1_final_est, est2_final_est, kg_frambuesa_total, recover_e1, recover_e2 } = req.body;
  
  const valE1 = parseFloat(est1_final_est) || 0;
  const valE2 = parseFloat(est2_final_est) || 0;

  db.get('SELECT * FROM production_sessions WHERE id = ? AND status = "ACTIVE"', [session_id], (err, session) => {
    if (err || !session) return res.status(404).json({ error: 'Sesión no encontrada o ya finalizada' });
    
    db.all('SELECT psi.*, m.id as material_id, m.name as material_name, b.lote FROM production_session_ingredients psi JOIN batches b ON psi.batch_id = b.id JOIN materials m ON b.material_id = m.id WHERE psi.session_id = ?', [session_id], (err, ingredients) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.serialize(() => {
        // 1. Insertar registro de producción
        db.run('INSERT INTO production (pt_name, pt_lote, pt_quantity, pt_unit, crumble_waste, est1_final_est, est2_final_est, kg_frambuesa_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [pt_name, pt_lote, pt_quantity, pt_unit || 'Cajas', crumble_waste || 0, valE1, valE2, kg_frambuesa_total || 0], function(err) {
            if (err) return res.status(500).json({ error: 'Error en tabla production: ' + err.message });
            const productionId = this.lastID;
            
            // 2. Mover ingredientes de sesión a producción definitiva
            ingredients.forEach(ing => {
              db.run('INSERT INTO production_ingredients (production_id, batch_id, quantity) VALUES (?, ?, ?)',
                [productionId, ing.batch_id, ing.quantity]);
            });

            // 3. Finalizar sesión
            db.run('UPDATE production_sessions SET status = "FINISHED" WHERE id = ?', [session_id]);
            
            // 4. Lógica de Recuperación de Estanques (Secuencial dentro de serialize)
            if (recover_e1 && valE1 > 0) {
              const baseIng = ingredients.find(i => {
                const n = (i.material_name || '').toLowerCase();
                return n.includes('blanco') || n.includes('white');
              });
              if (baseIng) {
                const loteRec = `rec-${baseIng.lote || 'S/L'}`;
                db.run('INSERT INTO batches (material_id, lote, quantity, expiry_date) VALUES (?, ?, ?, ?)',
                  [baseIng.material_id, loteRec, valE1, 'N/A'], function() {
                    const newBatchId = this.lastID;
                    db.run('INSERT INTO movements (material_id, batch_id, lote, type, quantity, description) VALUES (?, ?, ?, "IN", ?, ?)',
                      [baseIng.material_id, newBatchId, loteRec, valE1, `Recuperado de Estanque 1 (Sesión ${session_id}) - Origen: ${baseIng.lote || 'N/A'}`]);
                  });
              }
            }

            if (recover_e2 && valE2 > 0) {
              const e1Ing = ingredients.find(i => {
                const n = (i.material_name || '').toLowerCase();
                return n.includes('blanco') || n.includes('white');
              });
              const cobIng = ingredients.find(i => {
                const n = (i.material_name || '').toLowerCase();
                return i.material_name !== e1Ing?.material_name && (n.includes('leche') || n.includes('cobertura') || n.includes('amargo') || n.includes('dark') || n.includes('rub') || n.includes('choc'));
              });
              if (cobIng) {
                const loteRec = `rec-${cobIng.lote || 'S/L'}`;
                db.run('INSERT INTO batches (material_id, lote, quantity, expiry_date) VALUES (?, ?, ?, ?)',
                  [cobIng.material_id, loteRec, valE2, 'N/A'], function() {
                    const newBatchId = this.lastID;
                    db.run('INSERT INTO movements (material_id, batch_id, lote, type, quantity, description) VALUES (?, ?, ?, "IN", ?, ?)',
                      [cobIng.material_id, newBatchId, loteRec, valE2, `Recuperado de Estanque 2 (Sesión ${session_id}) - Origen: ${cobIng.lote || 'N/A'}`]);
                  });
              }
            }

            // 5. Registrar Producto Terminado y finalizar petición
            db.run('INSERT INTO pt_movements (pt_name, pt_lote, quantity, unit, type, destination) VALUES (?, ?, ?, ?, "PROD", "BODEGA")',
              [pt_name, pt_lote, pt_quantity, pt_unit || 'Cajas'], (err) => {
                if (err) return res.status(500).json({ error: 'Error al registrar stock de PT: ' + err.message });
                
                if (parseFloat(crumble_waste) > 0) {
                  db.run('INSERT INTO pt_movements (pt_name, pt_lote, quantity, unit, type, destination) VALUES (?, ?, ?, "Kg", "PROD", "BODEGA")',
                    ['Merma Crumble', pt_lote, crumble_waste]);
                }
                res.json({ success: true, id: productionId });
              });
          });
      });
    });
  });
});

app.delete('/api/production/sessions/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM production_sessions WHERE id = ? AND status = "ACTIVE"', [id], (err, session) => {
    if (err || !session) return res.status(404).json({ error: 'Sesión no encontrada' });
    db.all('SELECT * FROM production_session_ingredients WHERE session_id = ?', [id], (err, ingredients) => {
      if (err) return res.status(500).json({ error: err.message });
      db.serialize(() => {
        ingredients.forEach(ing => {
          db.run('UPDATE batches SET quantity = quantity + ? WHERE id = ?', [ing.quantity, ing.batch_id]);
        });
        db.run('DELETE FROM movements WHERE description = ?', [`Carga Producción: Sesión ${id}`]);
        db.run('UPDATE production_sessions SET status = "CANCELLED" WHERE id = ?', [id], (err) => {
          if (err) res.status(500).json({ error: err.message });
          else res.json({ success: true });
        });
      });
    });
  });
});

// ── API Routes ──
app.get('/api/materials', (req, res) => {
  db.all('SELECT * FROM materials ORDER BY name', [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.post('/api/materials', (req, res) => {
  const { name, unit, min_stock, category, base_cost } = req.body;
  db.run('INSERT INTO materials (name, unit, min_stock, category, base_cost) VALUES (?, ?, ?, ?, ?)', 
    [name, unit, min_stock || 0, category || 'OTRO', parseFloat(base_cost) || 0], function(err) {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ id: this.lastID, name, unit, min_stock, category, base_cost: parseFloat(base_cost) || 0 });
  });
});

app.put('/api/materials/:id', (req, res) => {
  const { id } = req.params;
  const { name, unit, min_stock, category, base_cost } = req.body;
  if (!name || !unit) return res.status(400).json({ error: 'Nombre y Unidad son requeridos' });
  db.run('UPDATE materials SET name = ?, unit = ?, min_stock = ?, category = ?, base_cost = ? WHERE id = ?',
    [name, unit, parseFloat(min_stock) || 0, category || 'OTRO', parseFloat(base_cost) || 0, id], function(err) {
      if (err) res.status(500).json({ error: 'Error en la base de datos: ' + err.message });
      else if (this.changes === 0) res.status(404).json({ error: 'Material no encontrado' });
      else res.json({ success: true });
    });
});

app.delete('/api/materials/:id', (req, res) => {
  db.run('DELETE FROM materials WHERE id = ?', [req.params.id], (err) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ success: true });
  });
});

app.get('/api/stock', (req, res) => {
  const query = `
    SELECT m.id as material_id, m.name, m.unit, m.category, m.min_stock,
    b.id as batch_id, b.lote, b.quantity, b.expiry_date, b.cost_per_unit
    FROM materials m
    LEFT JOIN batches b ON m.id = b.material_id AND b.quantity > 0
    ORDER BY m.name ASC, b.expiry_date ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.post('/api/inventory/in', (req, res) => {
  const { material_id, lote, quantity, expiry_date, description, cost_per_unit } = req.body;
  db.serialize(() => {
    db.run('INSERT INTO batches (material_id, lote, quantity, expiry_date, cost_per_unit) VALUES (?, ?, ?, ?, ?)',
      [material_id, lote, quantity, expiry_date, parseFloat(cost_per_unit) || 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        const batch_id = this.lastID;
        db.run('INSERT INTO movements (material_id, batch_id, lote, type, quantity, description) VALUES (?, ?, ?, "IN", ?, ?)',
          [material_id, batch_id, lote, quantity, description || 'Ingreso manual'], (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ success: true, batch_id });
          });
      });
  });
});

// Nueva API para Valorización de Negocio
app.get('/api/business/valuation', (req, res) => {
  const query = `
    SELECT 
      SUM(CASE WHEN quantity > 0 THEN quantity * cost_per_unit ELSE 0 END) as total_valuation
    FROM batches
  `;
  db.get(query, [], (err, row) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json({ total_valuation: row.total_valuation || 0 });
  });
});

app.post('/api/inventory/out', (req, res) => {
  const { batch_id, quantity, description } = req.body;
  db.get('SELECT * FROM batches WHERE id = ?', [batch_id], (err, batch) => {
    if (err || !batch) return res.status(404).json({ error: 'Lote no encontrado' });
    if (batch.quantity < quantity) return res.status(400).json({ error: 'Stock insuficiente en este lote' });
    const newQuantity = batch.quantity - quantity;
    db.serialize(() => {
      db.run('UPDATE batches SET quantity = ? WHERE id = ?', [newQuantity, batch_id]);
      db.run('INSERT INTO movements (material_id, batch_id, lote, type, quantity, description) VALUES (?, ?, ?, "OUT", ?, ?)',
        [batch.material_id, batch_id, batch.lote, quantity, description], (err) => {
          if (err) res.status(500).json({ error: err.message });
          else res.json({ success: true });
        });
    });
  });
});

app.post('/api/production', (req, res) => {
  const { ingredients, pt_name, pt_lote, pt_quantity, pt_unit, crumble_waste } = req.body;
  if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0)
    return res.status(400).json({ error: 'Se requiere al menos una materia prima' });

  const validatePromises = ingredients.map(ing =>
    new Promise((resolve, reject) => {
      db.get('SELECT b.*, m.name FROM batches b JOIN materials m ON b.material_id = m.id WHERE b.id = ?', [ing.batch_id], (err, batch) => {
        if (err || !batch) reject(`Lote de ingrediente ${ing.batch_id} no encontrado`);
        else if (batch.quantity < ing.quantity) reject(`Stock insuficiente para ${batch.name} (Lote: ${batch.lote})`);
        else resolve(batch);
      });
    })
  );

  Promise.all(validatePromises).then(batches => {
    db.serialize(() => {
      db.run('INSERT INTO production (pt_name, pt_lote, pt_quantity, crumble_waste) VALUES (?, ?, ?, ?)',
        [pt_name, pt_lote, pt_quantity, crumble_waste || 0], function(err) {
          if (err) return res.status(500).json({ error: 'Error en tabla production: ' + err.message });
          const productionId = this.lastID;
          const ingredientPromises = ingredients.map((ing, index) => {
            const batch = batches[index];
            const newQty = batch.quantity - ing.quantity;
            return new Promise((res_ing, rej_ing) => {
              db.run('UPDATE batches SET quantity = ? WHERE id = ?', [newQty, ing.batch_id], (err) => {
                if (err) return rej_ing(err.message);
                db.run('INSERT INTO production_ingredients (production_id, batch_id, quantity) VALUES (?, ?, ?)',
                  [productionId, ing.batch_id, ing.quantity], (err) => {
                    if (err) return rej_ing(err.message);
                    db.run('INSERT INTO movements (material_id, batch_id, lote, type, quantity, description) VALUES (?, ?, ?, "PROD", ?, ?)',
                      [batch.material_id, ing.batch_id, batch.lote, ing.quantity, `Producción: ${pt_name} (Lote: ${pt_lote})`], (err) => {
                        if (err) return rej_ing(err.message);
                        res_ing();
                      });
                  });
              });
            });
          });
          Promise.all(ingredientPromises).then(() => {
            db.run('INSERT INTO pt_movements (pt_name, pt_lote, quantity, unit, type, destination) VALUES (?, ?, ?, ?, "PROD", "BODEGA")',
              [pt_name, pt_lote, pt_quantity, pt_unit || 'Cajas'], (err) => {
                if (err) res.status(500).json({ error: 'Error al registrar stock de PT: ' + err.message });
                else res.json({ success: true, id: productionId });
              });
          }).catch(err_msg => res.status(500).json({ error: 'Error procesando ingredientes: ' + err_msg }));
        });
    });
  }).catch(error => res.status(400).json({ error }));
});

app.get('/api/pt_stock', (req, res) => {
  const query = `
    SELECT pt_name, unit,
    SUM(CASE WHEN type = 'PROD' THEN quantity ELSE -quantity END) as total_quantity
    FROM pt_movements GROUP BY pt_name, unit HAVING total_quantity > 0 ORDER BY pt_name ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.get('/api/pt_batches', (req, res) => {
  const query = `
    SELECT pt_name, pt_lote, unit, REPLACE(MIN(date), ' ', 'T') as date,
    SUM(CASE WHEN type = 'PROD' THEN quantity ELSE -quantity END) as total_quantity
    FROM pt_movements GROUP BY pt_name, pt_lote, unit HAVING total_quantity > 0 ORDER BY pt_name ASC, pt_lote ASC
  `;
  db.all(query, [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.get('/api/pt_history', (req, res) => {
  db.all('SELECT * FROM pt_movements ORDER BY date DESC LIMIT 100', [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows || []);
  });
});

app.post('/api/pt_dispatch', (req, res) => {
  const { pt_name, pt_lote, quantity, unit, destination } = req.body;
  db.run('INSERT INTO pt_movements (pt_name, pt_lote, quantity, unit, type, destination) VALUES (?, ?, ?, ?, "OUT", ?)',
    [pt_name, pt_lote, quantity, unit, destination || 'GUARDA'], function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ success: true, id: this.lastID });
    });
});

app.get('/api/movements', (req, res) => {
  db.all(`SELECT mov.*, mat.name as material_name, mat.unit FROM movements mov
    JOIN materials mat ON mov.material_id = mat.id ORDER BY mov.date DESC LIMIT 100`,
    [], (err, rows) => {
      if (err) res.status(500).json({ error: err.message });
      else res.json(rows || []);
    });
});

app.get('/api/production', (req, res) => {
  db.all('SELECT * FROM production ORDER BY date DESC', [], (err, productions) => {
    if (err) return res.status(500).json({ error: err.message });
    const query = `
      SELECT pi.*, m.name as material_name, m.category as material_category, b.lote, m.unit
      FROM production_ingredients pi
      JOIN batches b ON pi.batch_id = b.id
      JOIN materials m ON b.material_id = m.id
    `;
    db.all(query, [], (err, allIngredients) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(productions.map(p => ({ ...p, ingredients: allIngredients.filter(i => i.production_id === p.id) })));
    });
  });
});

app.delete('/api/pt_dispatch/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM pt_movements WHERE id = ? AND type = "OUT"', [id], (err, mov) => {
    if (err || !mov) return res.status(404).json({ error: 'Despacho no encontrado' });
    db.run('DELETE FROM pt_movements WHERE id = ?', [id], function(err) {
      if (err) res.status(500).json({ error: err.message });
      else res.json({ success: true, message: 'Despacho anulado y stock retornado a bodega' });
    });
  });
});

app.delete('/api/production/:id', (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM production WHERE id = ?', [id], (err, prod) => {
    if (err || !prod) return res.status(404).json({ error: 'Producción no encontrada' });
    db.all('SELECT * FROM production_ingredients WHERE production_id = ?', [id], (err, ingredients) => {
      if (err) return res.status(500).json({ error: err.message });
      db.serialize(() => {
        ingredients.forEach(ing => {
          db.run('UPDATE batches SET quantity = quantity + ? WHERE id = ?', [ing.quantity, ing.batch_id]);
        });
        const descPattern = `Producción: ${prod.pt_name} (Lote: ${prod.pt_lote})`;
        db.run('DELETE FROM movements WHERE description = ?', [descPattern]);
        db.run('DELETE FROM pt_movements WHERE pt_lote = ? AND type = "PROD" AND (pt_name = ? OR pt_name = "Merma Crumble")', [prod.pt_lote, prod.pt_name]);
        db.run('DELETE FROM production_ingredients WHERE production_id = ?', [id]);
        db.run('DELETE FROM production WHERE id = ?', [id], (err) => {
          if (err) res.status(500).json({ error: err.message });
          else res.json({ success: true });
        });
      });
    });
  });
});

app.put('/api/movements/:id', (req, res) => {
  const { id } = req.params;
  const { quantity, lote, description, date, cost_per_unit } = req.body;
  db.get('SELECT * FROM movements WHERE id = ?', [id], (err, mov) => {
    if (err || !mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
    db.get('SELECT * FROM batches WHERE id = ?', [mov.batch_id], (err, batch) => {
      if (err || !batch) return res.status(404).json({ error: 'Lote asociado no encontrado' });
      const diff = quantity - mov.quantity;
      const newBatchQty = mov.type === 'IN' ? batch.quantity + diff : batch.quantity - diff;
      if (newBatchQty < 0) return res.status(400).json({ error: 'La edición resultaría en stock negativo en el lote' });
      
      const newCost = cost_per_unit !== undefined ? parseFloat(cost_per_unit) : batch.cost_per_unit;

      db.serialize(() => {
        db.run('UPDATE batches SET quantity = ?, lote = ?, cost_per_unit = ? WHERE id = ?', [newBatchQty, lote, newCost, mov.batch_id]);
        db.run('UPDATE movements SET quantity = ?, lote = ?, description = ?, date = ? WHERE id = ?',
          [quantity, lote, description, date || mov.date, id], (err) => {
            if (err) res.status(500).json({ error: err.message });
            else res.json({ success: true });
          });
      });
    });
  });
});

app.delete('/api/movements/:id', (req, res) => {
  const { id } = req.params;
  console.log(`Intentando borrar movimiento ID: ${id}`);
  db.get('SELECT * FROM movements WHERE id = ?', [id], (err, mov) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });

    // PROTECCIÓN: No permitir borrar movimientos de producción desde aquí
    if (mov.type === 'PROD') {
      return res.status(400).json({ error: 'No se puede borrar un registro de producción desde el historial general. Use el módulo de Producción para revertir jornadas completas.' });
    }

    db.get('SELECT * FROM batches WHERE id = ?', [mov.batch_id], (err, batch) => {
      db.serialize(() => {
        if (batch) {
          if (mov.type === 'IN') {
            // Si borramos una entrada, el stock bajará. No puede ser menor a 0.
            const newQty = batch.quantity - mov.quantity;
            if (newQty < 0) return res.status(400).json({ error: 'No se puede borrar esta entrada porque parte del lote ya ha sido utilizado en producción.' });
            
            if (newQty <= 0) db.run('DELETE FROM batches WHERE id = ?', [mov.batch_id]);
            else db.run('UPDATE batches SET quantity = ? WHERE id = ?', [newQty, mov.batch_id]);
          } else {
            // Si borramos una salida, el stock subirá.
            const newQty = batch.quantity + mov.quantity;
            db.run('UPDATE batches SET quantity = ? WHERE id = ?', [newQty, mov.batch_id]);
          }
        }
        db.run('DELETE FROM movements WHERE id = ?', [id], (err) => {
          if (err) res.status(500).json({ error: err.message });
          else { console.log(`Movimiento ${id} borrado con éxito`); res.json({ success: true }); }
        });
      });
    });
  });
});

// ── Middleware de autenticación ──
const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido o expirado' }); }
};

const logAudit = (usuario_id, username, accion, detalle) => {
  db.run('INSERT INTO audit_log (usuario_id, username, accion, detalle) VALUES (?, ?, ?, ?)', [usuario_id, username, accion, detalle]);
};

// ── Rutas de Autenticación ──
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM usuarios WHERE username = ? AND activo = 1", [username], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    if (!bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    const token = jwt.sign(
      { id: user.id, username: user.username, rol: user.rol, nombre: user.nombre, permisos: JSON.parse(user.permisos || '{}') },
      JWT_SECRET, { expiresIn: '12h' }
    );
    logAudit(user.id, user.username, 'LOGIN', 'Inicio de sesión');
    res.json({ token, user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol, permisos: JSON.parse(user.permisos || '{}') } });
  });
});

app.post('/api/auth/logout', authMiddleware, (req, res) => {
  logAudit(req.user.id, req.user.username, 'LOGOUT', 'Cierre de sesión');
  res.json({ success: true });
});

// ── Rutas de Usuarios (solo admin) ──
app.get('/api/usuarios', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  db.all("SELECT id, username, nombre, rol, permisos, activo FROM usuarios ORDER BY id", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows.map(u => ({ ...u, permisos: JSON.parse(u.permisos || '{}') })));
  });
});

app.post('/api/usuarios', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const { username, password, nombre, rol, permisos } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO usuarios (username, password_hash, nombre, rol, permisos) VALUES (?, ?, ?, ?, ?)",
    [username, hash, nombre, rol || 'operador', JSON.stringify(permisos || {})], function(err) {
      if (err) res.status(500).json({ error: err.message });
      else {
        logAudit(req.user.id, req.user.username, 'CREAR_USUARIO', `Creó usuario: ${username}`);
        res.json({ success: true, id: this.lastID });
      }
    });
});

app.put('/api/usuarios/:id', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const { nombre, rol, permisos, activo, password } = req.body;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.run("UPDATE usuarios SET nombre=?, rol=?, permisos=?, activo=?, password_hash=? WHERE id=?",
      [nombre, rol, JSON.stringify(permisos || {}), activo ? 1 : 0, hash, req.params.id], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else {
          logAudit(req.user.id, req.user.username, 'EDITAR_USUARIO', `Editó usuario ID: ${req.params.id}`);
          res.json({ success: true });
        }
      });
  } else {
    db.run("UPDATE usuarios SET nombre=?, rol=?, permisos=?, activo=? WHERE id=?",
      [nombre, rol, JSON.stringify(permisos || {}), activo ? 1 : 0, req.params.id], (err) => {
        if (err) res.status(500).json({ error: err.message });
        else {
          logAudit(req.user.id, req.user.username, 'EDITAR_USUARIO', `Editó usuario ID: ${req.params.id}`);
          res.json({ success: true });
        }
      });
  }
});

app.get('/api/audit_log', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  db.all("SELECT * FROM audit_log ORDER BY fecha DESC LIMIT 100", [], (err, rows) => {
    if (err) res.status(500).json({ error: err.message });
    else res.json(rows);
  });
});

// ── Rutas de Respaldo ──
app.post('/api/backup', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  try {
    const result = await doBackup();
    logAudit(req.user.id, req.user.username, 'BACKUP', `Respaldo manual: ${result.name}`);
    res.json({ success: true, name: result.name });
  } catch (e) {
    console.error('[Backup] Error manual:', e.message);
    res.status(500).json({ error: 'Error al crear respaldo: ' + e.message });
  }
});

app.get('/api/backup/list', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  try {
    const files = fs.readdirSync(BACKUPS_LOCAL_PATH)
      .filter(f => f.endsWith('.db'))
      .map(f => {
        const fp = path.join(BACKUPS_LOCAL_PATH, f);
        const stat = fs.statSync(fp);
        return { name: f, size: stat.size, createdTime: stat.mtime };
      })
      .sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: 'Error al listar respaldos: ' + e.message });
  }
});

app.get('/api/backup/download/:name', authMiddleware, (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sin permisos' });
  const filePath = path.join(BACKUPS_LOCAL_PATH, path.basename(req.params.name));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.download(filePath);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
