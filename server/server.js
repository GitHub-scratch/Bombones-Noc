const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'bombones_noc_secret_2026';
const PORT = process.env.PORT || 3001;
const PRINTER_NAME = "\\\\PC-NOC\\ZDesigner ZD420-203dpi ZPL";
const LABELS_PATH = path.join(__dirname, '..', 'client', 'src', 'Etiquetas a imprimir');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.connect(err => { if (err) console.error('Error PostgreSQL:', err.message); else console.log('Conectado a Supabase PostgreSQL'); });

const app = express();
app.use(cors());
app.use(bodyParser.json());

const authMiddleware = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Token invalido' }); }
};

const logAudit = async (uid, uname, accion, detalle) => {
  try { await pool.query('INSERT INTO audit_log (usuario_id,username,accion,detalle) VALUES ($1,$2,$3,$4)', [uid,uname,accion,detalle]); } catch {}
};

app.post('/api/label-preview', (req, res) => {
  const { pt_lote, date, exp_date } = req.body;
  if (!pt_lote) return res.status(400).json({ error: 'Lote no proporcionado' });
  let fileName = pt_lote.startsWith('FBD') ? 'ETIQUETA_L.zpl' : pt_lote.startsWith('FBA') ? 'ETIQUETA_A.zpl' : pt_lote.startsWith('FRB') ? 'ETIQUETA_R.zpl' : null;
  if (!fileName) return res.status(400).json({ error: 'Prefijo no reconocido' });
  const filePath = path.join(LABELS_PATH, fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo zpl no encontrado' });
  try {
    let zpl = fs.readFileSync(filePath).toString('utf8');
    const fx = zpl.indexOf('^XA'); if (fx !== -1) zpl = zpl.substring(fx);
    const pds = (date || new Date().toISOString()).split('T')[0];
    const eds = exp_date ? exp_date.split('T')[0] : (() => { const p = pds.split('-'); return (parseInt(p[0])+1)+'-'+p[1]+'-'+p[2]; })();
    zpl = zpl.replace(/FDF\.P \d{2}\/\d{2}/g,'FDF.P '+pds.slice(5,7)+'/'+pds.slice(2,4)).replace(/FDF\.V \d{2}\/\d{2}/g,'FDF.V '+eds.slice(5,7)+'/'+eds.slice(2,4)).replace(/FDLOTE: [A-Z0-9]+/g,'FDLOTE: '+pt_lote);
    res.json({ zpl: zpl.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/print-labels', (req, res) => {
  const { pt_lote, pt_quantity, custom_zpl } = req.body;
  if (!pt_lote && !custom_zpl) return res.status(400).json({ error: 'Datos insuficientes' });
  try {
    let zc = custom_zpl || fs.readFileSync(path.join(LABELS_PATH, pt_lote.startsWith('FBD') ? 'ETIQUETA_L.prn' : pt_lote.startsWith('FBA') ? 'ETIQUETA_A.prn' : 'ETIQUETA_R.prn'), 'utf8');
    const qty = Math.ceil(parseFloat(pt_quantity)||1);
    zc = zc.replace(/\^PQ\d+/,'^PQ'+qty);
    const tmp = path.join(__dirname,'temp_label.zpl');
    fs.writeFileSync(tmp, zc);
    exec('copy /b "'+tmp+'" "'+PRINTER_NAME+'"', err => {
      if (err) return res.status(500).json({ error: 'Error impresora: '+err.message });
      res.json({ success: true });
      setTimeout(() => { try { fs.unlinkSync(tmp); } catch {} }, 5000);
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const r = await pool.query('SELECT * FROM usuarios WHERE username=$1 AND activo=1', [username]);
    const user = r.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: user.id, username: user.username, rol: user.rol, nombre: user.nombre, permisos: (typeof user.permisos === 'string' ? JSON.parse(user.permisos||'{}') : (user.permisos||{})) }, JWT_SECRET, { expiresIn: '12h' });
    await logAudit(user.id, user.username, 'LOGIN', 'Inicio de sesion');
    res.json({ token, user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol, permisos: (typeof user.permisos === 'string' ? JSON.parse(user.permisos||'{}') : (user.permisos||{})) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  await logAudit(req.user.id, req.user.username, 'LOGOUT', 'Cierre de sesion');
  res.json({ success: true });
});

app.get('/api/materials', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM materials ORDER BY name')).rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/materials', async (req, res) => {
  try {
    const { name, unit, min_stock, category, base_cost } = req.body;
    const r = await pool.query('INSERT INTO materials (name,unit,min_stock,category,base_cost) VALUES ($1,$2,$3,$4,$5) RETURNING id', [name,unit,min_stock||0,category||'OTRO',parseFloat(base_cost)||0]);
    res.json({ id: r.rows[0].id, name, unit, min_stock, category, base_cost: parseFloat(base_cost)||0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/materials/:id', async (req, res) => {
  try {
    const { name, unit, min_stock, category, base_cost } = req.body;
    if (!name||!unit) return res.status(400).json({ error: 'Nombre y Unidad requeridos' });
    const r = await pool.query('UPDATE materials SET name=$1,unit=$2,min_stock=$3,category=$4,base_cost=$5 WHERE id=$6', [name,unit,parseFloat(min_stock)||0,category||'OTRO',parseFloat(base_cost)||0,req.params.id]);
    if (r.rowCount===0) return res.status(404).json({ error: 'Material no encontrado' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/materials/:id', async (req, res) => {
  try { await pool.query('DELETE FROM materials WHERE id=$1',[req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stock', async (req, res) => {
  try {
    res.json((await pool.query('SELECT m.id as material_id,m.name,m.unit,m.category,m.min_stock,b.id as batch_id,b.lote,b.quantity,b.expiry_date,b.cost_per_unit FROM materials m LEFT JOIN batches b ON m.id=b.material_id AND b.quantity>0 ORDER BY m.name,b.expiry_date')).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/inventory/in', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { material_id, lote, quantity, expiry_date, description, cost_per_unit } = req.body;
    const b = await client.query('INSERT INTO batches (material_id,lote,quantity,expiry_date,cost_per_unit) VALUES ($1,$2,$3,$4,$5) RETURNING id',[material_id,lote,quantity,expiry_date,parseFloat(cost_per_unit)||0]);
    await client.query('INSERT INTO movements (material_id,batch_id,lote,type,quantity,description) VALUES ($1,$2,$3,$4,$5,$6)',[material_id,b.rows[0].id,lote,'IN',quantity,description||'Ingreso manual']);
    await client.query('COMMIT');
    res.json({ success: true, batch_id: b.rows[0].id });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.post('/api/inventory/out', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { batch_id, quantity, description } = req.body;
const b = (await client.query('SELECT * FROM batches WHERE id=$1',[batch_id])).rows[0];
    if (!b) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    if (b.quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stock insuficiente' });
    }
    await client.query('UPDATE batches SET quantity=$1 WHERE id=$2',[b.quantity-quantity,batch_id]);
    await client.query('INSERT INTO movements (material_id,batch_id,lote,type,quantity,description) VALUES ($1,$2,$3,$4,$5,$6)',[b.material_id,batch_id,b.lote,'OUT',quantity,description]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.get('/api/business/valuation', async (req, res) => {
  try {
    res.json({ total_valuation: (await pool.query('SELECT SUM(CASE WHEN quantity>0 THEN quantity*cost_per_unit ELSE 0 END) as tv FROM batches')).rows[0].tv||0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/movements', async (req, res) => {
  try { res.json((await pool.query('SELECT mov.*,mat.name as material_name,mat.unit FROM movements mov JOIN materials mat ON mov.material_id=mat.id ORDER BY mov.date DESC LIMIT 100')).rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/movements/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { quantity, lote, description, date, cost_per_unit } = req.body;
    const mov = (await client.query('SELECT * FROM movements WHERE id=$1',[req.params.id])).rows[0];
    if (!mov) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }
    const batch = (await client.query('SELECT * FROM batches WHERE id=$1',[mov.batch_id])).rows[0];
    if (!batch) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    const newQty = mov.type==='IN' ? batch.quantity+(quantity-mov.quantity) : batch.quantity-(quantity-mov.quantity);
    if (newQty<0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stock negativo' });
    }
    await client.query('UPDATE batches SET quantity=$1,lote=$2,cost_per_unit=$3 WHERE id=$4',[newQty,lote,cost_per_unit!==undefined?parseFloat(cost_per_unit):batch.cost_per_unit,mov.batch_id]);
    await client.query('UPDATE movements SET quantity=$1,lote=$2,description=$3,date=$4 WHERE id=$5',[quantity,lote,description,date||mov.date,req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.delete('/api/movements/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mov = (await client.query('SELECT * FROM movements WHERE id=$1',[req.params.id])).rows[0];
    if (!mov) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Movimiento no encontrado' });
    }
    if (mov.type==='PROD') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Use el modulo de Produccion para revertir.' });
    }
    const batch = (await client.query('SELECT * FROM batches WHERE id=$1',[mov.batch_id])).rows[0];
    if (batch) {
      if (mov.type==='IN') {
        const nq = batch.quantity-mov.quantity;
        if (nq<0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Stock ya utilizado, no se puede borrar.' });
        }
        if (nq<=0) await client.query('DELETE FROM batches WHERE id=$1',[mov.batch_id]);
        else await client.query('UPDATE batches SET quantity=$1 WHERE id=$2',[nq,mov.batch_id]);
      } else {
        await client.query('UPDATE batches SET quantity=$1 WHERE id=$2',[batch.quantity+mov.quantity,mov.batch_id]);
      }
    }
    await client.query('DELETE FROM movements WHERE id=$1',[req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get('/api/production', async (req, res) => {
  try {
    const prods = (await pool.query('SELECT * FROM production ORDER BY date DESC')).rows;
    const ings = (await pool.query('SELECT pi.*,m.name as material_name,m.category as material_category,b.lote,m.unit FROM production_ingredients pi JOIN batches b ON pi.batch_id=b.id JOIN materials m ON b.material_id=m.id')).rows;
    res.json(prods.map(p => ({ ...p, ingredients: ings.filter(i => i.production_id===p.id) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/production/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prod = (await client.query('SELECT * FROM production WHERE id=$1',[req.params.id])).rows[0];
if (!prod) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Produccion no encontrada' });
    }
    const ings = (await client.query('SELECT * FROM production_ingredients WHERE production_id=$1',[req.params.id])).rows;
    for (const ing of ings) {
      await client.query('UPDATE batches SET quantity=quantity+$1 WHERE id=$2',[ing.quantity,ing.batch_id]);
    }
    await client.query('DELETE FROM movements WHERE description=$1',['Produccion: '+prod.pt_name+' (Lote: '+prod.pt_lote+')']);
    await client.query('DELETE FROM pt_movements WHERE pt_lote=$1 AND type=$2',[prod.pt_lote,'PROD']);
    await client.query('DELETE FROM production_ingredients WHERE production_id=$1',[req.params.id]);
    await client.query('DELETE FROM production WHERE id=$1',[req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.get('/api/pt_stock', async (req, res) => {
  try {
    res.json((await pool.query("SELECT pt_name,unit,SUM(CASE WHEN type='PROD' THEN quantity ELSE -quantity END) as total_quantity FROM pt_movements GROUP BY pt_name,unit HAVING SUM(CASE WHEN type='PROD' THEN quantity ELSE -quantity END)>0 ORDER BY pt_name")).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pt_batches', async (req, res) => {
  try {
    res.json((await pool.query("SELECT pt_name,pt_lote,unit,MIN(date) as date,SUM(CASE WHEN type='PROD' THEN quantity ELSE -quantity END) as total_quantity FROM pt_movements GROUP BY pt_name,pt_lote,unit HAVING SUM(CASE WHEN type='PROD' THEN quantity ELSE -quantity END)>0 ORDER BY pt_name,pt_lote")).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/pt_history', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM pt_movements ORDER BY date DESC LIMIT 100')).rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pt_dispatch', async (req, res) => {
  try {
    const { pt_name, pt_lote, quantity, unit, destination } = req.body;
    const r = await pool.query('INSERT INTO pt_movements (pt_name,pt_lote,quantity,unit,type,destination) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',[pt_name,pt_lote,quantity,unit,'OUT',destination||'GUARDA']);
    res.json({ success: true, id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/pt_dispatch/:id', async (req, res) => {
  try {
    const mov = (await pool.query("SELECT * FROM pt_movements WHERE id=$1 AND type='OUT'",[req.params.id])).rows[0];
    if (!mov) return res.status(404).json({ error: 'Despacho no encontrado' });
    await pool.query('DELETE FROM pt_movements WHERE id=$1',[req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/production/sessions', async (req, res) => {
  try {
    const sessions = (await pool.query("SELECT * FROM production_sessions WHERE status='ACTIVE' ORDER BY start_date DESC")).rows;
    const ings = (await pool.query('SELECT psi.*,m.name as material_name,b.lote,m.unit FROM production_session_ingredients psi JOIN batches b ON psi.batch_id=b.id JOIN materials m ON b.material_id=m.id')).rows;
    const prog = (await pool.query('SELECT * FROM production_progress')).rows;
    res.json(sessions.map(s => ({ ...s, ingredients: ings.filter(i=>i.session_id===s.id), progress: prog.filter(p=>p.session_id===s.id) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/production/sessions/progress', async (req, res) => {
  try {
    const { session_id, quantity, unit, material_id, batch_id, lote } = req.body;
    if (!session_id || !quantity || !unit) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const r = await pool.query(
      'INSERT INTO production_progress (session_id,quantity,unit,material_id,batch_id,lote) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [session_id, quantity, unit, material_id || null, batch_id || null, lote || null]
    );

    res.json({ success: true, id: r.rows[0].id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/production/sessions/start', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { ingredients, description, product_name, format } = req.body;

if (!ingredients || !ingredients.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Se requiere al menos una materia prima' });
    }
    }

    for (const ing of ingredients) {
      const b = (
        await client.query(
          'SELECT b.*, m.name, m.id as material_id FROM batches b JOIN materials m ON b.material_id=m.id WHERE b.id=$1',
          [ing.batch_id]
        )
      ).rows[0];

      if (!b) throw new Error('Lote no encontrado');
      if ((parseFloat(b.quantity) || 0) < (parseFloat(ing.quantity) || 0)) {
        throw new Error(`Stock insuficiente para ${b.name}`);
      }
    }

    const s = await client.query(
      'INSERT INTO production_sessions (description,product_name,format) VALUES ($1,$2,$3) RETURNING id',
      [description || '', product_name || '', format || 'CAJAS']
    );

    const sessionId = s.rows[0].id;

    for (const ing of ingredients) {
      const qty = parseFloat(ing.quantity) || 0;

      await client.query(
        'INSERT INTO production_session_ingredients (session_id,batch_id,quantity) VALUES ($1,$2,$3)',
        [sessionId, ing.batch_id, qty]
      );

      const b = (
        await client.query(
          'SELECT b.*, m.name, m.id as material_id FROM batches b JOIN materials m ON b.material_id=m.id WHERE b.id=$1',
          [ing.batch_id]
        )
      ).rows[0];

      await client.query(
        'UPDATE batches SET quantity = quantity - $1 WHERE id = $2',
        [qty, ing.batch_id]
      );

      await client.query(
        `INSERT INTO movements (material_id,batch_id,lote,type,quantity,description)
         VALUES ($1,$2,$3,'PROD',$4,$5)`,
        [
          b.material_id,
          ing.batch_id,
          b.lote,
          qty,
          'Carga Produccion: Sesion ' + sessionId
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, id: sessionId });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post('/api/production/sessions/refill', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { session_id, ingredients } = req.body;

if (!session_id || !ingredients || !ingredients.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Datos incompletos' });
      }
    }

    const session = (
      await client.query(
        "SELECT * FROM production_sessions WHERE id=$1 AND status='ACTIVE'",
        [session_id]
      )
    ).rows[0];

    if (!session) {
        await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sesion no encontrada' });
    }

    for (const ing of ingredients) {
      const b = (
        await client.query(
          'SELECT b.*, m.name FROM batches b JOIN materials m ON b.material_id=m.id WHERE b.id=$1',
          [ing.batch_id]
        )
      ).rows[0];

      if (!b) throw new Error('Lote no encontrado');
      if ((parseFloat(b.quantity) || 0) < (parseFloat(ing.quantity) || 0)) {
        throw new Error(`Stock insuficiente para ${b.name}`);
      }
    }

    for (const ing of ingredients) {
      const qty = parseFloat(ing.quantity) || 0;

      await client.query(
        'INSERT INTO production_session_ingredients (session_id,batch_id,quantity) VALUES ($1,$2,$3)',
        [session_id, ing.batch_id, qty]
      );

      const b = (
        await client.query(
          'SELECT b.*, m.name FROM batches b JOIN materials m ON b.material_id=m.id WHERE b.id=$1',
          [ing.batch_id]
        )
      ).rows[0];

      await client.query(
        'UPDATE batches SET quantity = quantity - $1 WHERE id = $2',
        [qty, ing.batch_id]
      );

      await client.query(
        `INSERT INTO movements (material_id,batch_id,lote,type,quantity,description)
         VALUES ($1,$2,$3,'PROD',$4,$5)`,
        [
          b.material_id,
          ing.batch_id,
          b.lote,
          qty,
          'Recarga Produccion: Sesion ' + session_id
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post('/api/production/sessions/finish', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      session_id,
      pt_name,
      pt_lote,
      pt_quantity,
      pt_unit,
      crumble_waste,
      est1_final_est,
      est2_final_est,
      kg_frambuesa_total,
      recover_e1,
      recover_e2
    } = req.body;

    const valE1 = parseFloat(est1_final_est) || 0;
    const valE2 = parseFloat(est2_final_est) || 0;

    const session = (
      await client.query(
        "SELECT * FROM production_sessions WHERE id=$1 AND status='ACTIVE'",
        [session_id]
      )
    ).rows[0];

    if (!session) {
        await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sesion no encontrada' });
    }

    const ings = (
      await client.query(
        `SELECT psi.*, m.id as material_id, m.name as material_name, b.lote
         FROM production_session_ingredients psi
         JOIN batches b ON psi.batch_id=b.id
         JOIN materials m ON b.material_id=m.id
         WHERE psi.session_id=$1`,
        [session_id]
      )
    ).rows;

    const iqfRows = (
      await client.query(
        `SELECT *
         FROM production_progress
         WHERE session_id=$1
           AND (unit='Frambuesa' OR lote IS NOT NULL OR batch_id IS NOT NULL)`,
        [session_id]
      )
    ).rows;

    let frambuesaLote = null;
    let frambuesaTotal = 0;

    for (const row of iqfRows) {
      const qty = parseFloat(row.quantity) || 0;
      if (qty <= 0) continue;

      frambuesaTotal += qty;

      if (!frambuesaLote && row.lote) {
        frambuesaLote = row.lote;
      }

      if (row.batch_id) {
        const batch = (
          await client.query(
            'SELECT b.*, m.name as material_name FROM batches b JOIN materials m ON b.material_id=m.id WHERE b.id=$1',
            [row.batch_id]
          )
        ).rows[0];

        if (!batch) throw new Error('Lote de frambuesa no encontrado');

        if ((parseFloat(batch.quantity) || 0) < qty) {
          throw new Error(`Stock insuficiente para frambuesa en lote ${batch.lote}`);
        }

        await client.query(
          'UPDATE batches SET quantity = quantity - $1 WHERE id = $2',
          [qty, row.batch_id]
        );

        await client.query(
          `INSERT INTO movements (material_id,batch_id,lote,type,quantity,description)
           VALUES ($1,$2,$3,'PROD',$4,$5)`,
          [
            batch.material_id,
            row.batch_id,
            batch.lote,
            qty,
            'Consumo Frambuesa Produccion: Sesion ' + session_id
          ]
        );

        if (!frambuesaLote) {
          frambuesaLote = batch.lote;
        }
      }
    }

    const frambuesaFinal = parseFloat(kg_frambuesa_total) || frambuesaTotal || 0;

    const prod = await client.query(
      `INSERT INTO production
       (pt_name,pt_lote,pt_quantity,pt_unit,crumble_waste,est1_final_est,est2_final_est,kg_frambuesa_total,frambuesa_lote)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        pt_name,
        pt_lote,
        pt_quantity,
        pt_unit || 'Cajas',
        crumble_waste || 0,
        valE1,
        valE2,
        frambuesaFinal,
        frambuesaLote
      ]
    );

    const pid = prod.rows[0].id;

    for (const ing of ings) {
      await client.query(
        'INSERT INTO production_ingredients (production_id,batch_id,quantity) VALUES ($1,$2,$3)',
        [pid, ing.batch_id, ing.quantity]
      );
    }

    for (const row of iqfRows) {
      const qty = parseFloat(row.quantity) || 0;
      if (qty > 0 && row.batch_id) {
        await client.query(
          'INSERT INTO production_ingredients (production_id,batch_id,quantity) VALUES ($1,$2,$3)',
          [pid, row.batch_id, qty]
        );
      }
    }

    await client.query(
      "UPDATE production_sessions SET status='FINISHED' WHERE id=$1",
      [session_id]
    );

    if (recover_e1 && valE1 > 0) {
      const baseIng = ings.find(i => {
        const n = (i.material_name || '').toLowerCase();
        return n.includes('blanco') || n.includes('white');
      });

      if (baseIng) {
        const loteRec = 'rec-' + (baseIng.lote || 'S/L');
        const nb = await client.query(
          'INSERT INTO batches (material_id,lote,quantity,expiry_date) VALUES ($1,$2,$3,$4) RETURNING id',
          [baseIng.material_id, loteRec, valE1, 'N/A']
        );

        await client.query(
          `INSERT INTO movements (material_id,batch_id,lote,type,quantity,description)
           VALUES ($1,$2,$3,'IN',$4,$5)`,
          [
            baseIng.material_id,
            nb.rows[0].id,
            loteRec,
            valE1,
            'Recuperado Estanque 1 - Sesion ' + session_id
          ]
        );
      }
    }

    if (recover_e2 && valE2 > 0) {
      const cobIng = ings.find(i => {
        const n = (i.material_name || '').toLowerCase();
        return n.includes('leche') || n.includes('cobertura') || n.includes('amargo') || n.includes('dark');
      });

      if (cobIng) {
        const loteRec = 'rec-' + (cobIng.lote || 'S/L');
        const nb = await client.query(
          'INSERT INTO batches (material_id,lote,quantity,expiry_date) VALUES ($1,$2,$3,$4) RETURNING id',
          [cobIng.material_id, loteRec, valE2, 'N/A']
        );

        await client.query(
          `INSERT INTO movements (material_id,batch_id,lote,type,quantity,description)
           VALUES ($1,$2,$3,'IN',$4,$5)`,
          [
            cobIng.material_id,
            nb.rows[0].id,
            loteRec,
            valE2,
            'Recuperado Estanque 2 - Sesion ' + session_id
          ]
        );
      }
    }

    await client.query(
      `INSERT INTO pt_movements (pt_name,pt_lote,quantity,unit,type,destination)
       VALUES ($1,$2,$3,$4,'PROD','BODEGA')`,
      [pt_name, pt_lote, pt_quantity, pt_unit || 'Cajas']
    );

    if (parseFloat(crumble_waste) > 0) {
      await client.query(
        `INSERT INTO pt_movements (pt_name,pt_lote,quantity,unit,type,destination)
         VALUES ('Merma Crumble',$1,$2,'Kg','PROD','BODEGA')`,
        [pt_lote, crumble_waste]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, id: pid });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.delete('/api/production/sessions/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = (await client.query("SELECT * FROM production_sessions WHERE id=$1 AND status='ACTIVE'",[req.params.id])).rows[0];
    if (!session) return res.status(404).json({ error: 'Sesion no encontrada' });
    const ings = (await client.query('SELECT * FROM production_session_ingredients WHERE session_id=$1',[req.params.id])).rows;
    for (const ing of ings) {
      await client.query('UPDATE batches SET quantity=quantity+$1 WHERE id=$2',[ing.quantity,ing.batch_id]);
    }
    await client.query("DELETE FROM movements WHERE description=$1",['Carga Produccion: Sesion '+req.params.id]);
    await client.query("UPDATE production_sessions SET status='CANCELLED' WHERE id=$1",[req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

app.get('/api/usuarios', authMiddleware, async (req, res) => {
  if (req.user.rol!=='admin') return res.status(403).json({ error: 'Sin permisos' });
  try {
    const r = await pool.query('SELECT id,username,nombre,rol,permisos,activo FROM usuarios ORDER BY id');
    res.json(r.rows.map(u => ({ ...u, permisos: JSON.parse(u.permisos||'{}') })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/usuarios', authMiddleware, async (req, res) => {
  if (req.user.rol!=='admin') return res.status(403).json({ error: 'Sin permisos' });
  try {
    const { username, password, nombre, rol, permisos } = req.body;
    const hash = bcrypt.hashSync(password, 10);
    const r = await pool.query('INSERT INTO usuarios (username,password_hash,nombre,rol,permisos) VALUES ($1,$2,$3,$4,$5) RETURNING id',[username,hash,nombre,rol||'operador',JSON.stringify(permisos||{})]);
    await logAudit(req.user.id, req.user.username, 'CREAR_USUARIO', 'Creo usuario: '+username);
    res.json({ success: true, id: r.rows[0].id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/usuarios/:id', authMiddleware, async (req, res) => {
  if (req.user.rol!=='admin') return res.status(403).json({ error: 'Sin permisos' });
  try {
    const { nombre, rol, permisos, activo, password } = req.body;
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      await pool.query('UPDATE usuarios SET nombre=$1,rol=$2,permisos=$3,activo=$4,password_hash=$5 WHERE id=$6',[nombre,rol,JSON.stringify(permisos||{}),activo?1:0,hash,req.params.id]);
    } else {
      await pool.query('UPDATE usuarios SET nombre=$1,rol=$2,permisos=$3,activo=$4 WHERE id=$5',[nombre,rol,JSON.stringify(permisos||{}),activo?1:0,req.params.id]);
    }
    await logAudit(req.user.id, req.user.username, 'EDITAR_USUARIO', 'Edito usuario ID: '+req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/audit_log', authMiddleware, async (req, res) => {
  if (req.user.rol!=='admin') return res.status(403).json({ error: 'Sin permisos' });
  try { res.json((await pool.query('SELECT * FROM audit_log ORDER BY fecha DESC LIMIT 100')).rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log('Server running on port '+PORT));
