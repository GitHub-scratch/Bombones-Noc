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
  catch { res.status(401).json({ error: 'Token invalido o expirado' }); }
};

const logAudit = async (uid, uname, accion, detalle) => {
  try { await pool.query('INSERT INTO audit_log (usuario_id,username,accion,detalle) VALUES ($1,$2,$3,$4)', [uid, uname, accion, detalle]); } catch {}
};

// ── Impresion ──
app.post('/api/label-preview', (req, res) => {
  const { pt_lote, date, exp_date } = req.body;
  if (!pt_lote) return res.status(400).json({ error: 'Lote no proporcionado' });
  let fileName = pt_lote.startsWith('FBD') ? 'ETIQUETA_L.zpl' : pt_lote.startsWith('FBA') ? 'ETIQUETA_A.zpl' : pt_lote.startsWith('FRB') ? 'ETIQUETA_R.zpl' : null;
  if (!fileName) return res.status(400).json({ error: 'Prefijo no reconocido' });
  const filePath = path.join(LABELS_PATH, fileName);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo .zpl no encontrado' });
  try {
    let zpl = fs.readFileSync(filePath).toString('utf8');
    const fx = zpl.indexOf('^XA'); if (fx !== -1) zpl = zpl.substring(fx);
    const prodDateStr = (date || new Date().toISOString()).split('T')[0];
    const expDateStr = exp_date ? exp_date.split('T')[0] : (() => { const p = prodDateStr.split('-'); return `${parseInt(p[0])+1}-${p[1]}-${p[2]}`; })();
    const fp = `${prodDateStr.slice(5,7)}/${prodDateStr.slice(2,4)}`;
    const fv = `${expDateStr.slice(5,7)}/${expDateStr.slice(2,4)}`;
    zpl = zpl.replace(/FDF\.P \d{2}\/\d{2}/g, `FDF.P ${fp}`).replace(/FDF\.V \d{2}\/\d{2}/g, `FDF.V ${fv}`).replace(/FDLOTE: [A-Z0-9]+/g, `FDLOTE: ${pt_lote}`);
    res.json({ zpl: zpl.trim() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/print-labels', (req, res) => {
  const { pt_lote, pt_quantity, custom_zpl } = req.body;
  if (!pt_lote && !custom_zpl) return res.status(400).json({ error: 'Datos insuficientes' });
  try {
    let zplContent = custom_zpl || fs.readFileSync(path.join(LABELS_PATH, pt_lote.startsWith('FBD') ? 'ETIQUETA_L.prn' : pt_lote.startsWith('FBA') ? 'ETIQUETA_A.prn' : 'ETIQUETA_R.prn'), 'utf8');
    const qty = Math.ceil(parseFloat(pt_quantity) || 1);
    zplContent = zplContent.replace(/\^PQ\d+/, `^PQ${qty}`);
    const tmp = path.join(__dirname, 'temp_label.zpl');
    fs.writeFileSync(tmp, zplContent);
    exec(`copy /b "${tmp}" "${PRINTER_NAME}"`, err => {
      if (err) return res.status(500).json({ error: 'Error impresora: ' + err.message });
      res.json({ success: true });
      setTimeout(() => { try { fs.unlinkSync(tmp); } catch {} }, 5000);
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Auth ──
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const r = await pool.query("SELECT * FROM usuarios WHERE username=$1 AND activo=1", [username]);
    const user = r.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
    const token = jwt.sign({ id: user.id, username: user.username, rol: user.rol, nombre: user.nombre, permisos: JSON.parse(user.permisos||'{}') }, JWT_SECRET, { expiresIn: '12h' });
    await logAudit(user.id, user.username, 'LOGIN', 'Inicio de sesion');
    res.json({ token, user: { id: user.id, username: user.username, nombre: user.nombre, rol: user.rol, permisos: JSON.parse(user.permisos||'{}') } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  await logAudit(req.user.id, req.user.username, 'LOGOUT', 'Cierre de sesion');
  res.json({ success: true });
});

// ── Materiales ──
app.get('/api/materials', async (req, res) => {
  try { res.json((await pool.query('SELECT * FROM materials ORDER BY name')).rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/materials', async (req, res) => {
  try {
    const { name, unit, min_stock, category, base_cost } = req.body;
    const r = await pool.query('INSERT INTO materials (name,unit,min_stock,category,base_cost) VALUES ($1,$2,$3,$4,$5) RETURNING id', [name, unit, min_stock||0, category||'OTRO', parseFloat(base_cost)||0]);
    res.json({ id: r.rows[0].id, name, unit, min_stock, category, base_cost: parseFloat(base_cost)||0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/materials/:id', async (req, res) => {
  try {
    const { name, unit, min_stock, category, base_cost } = req.body;
    if (!name || !unit) return res.status(400).json({ error: 'Nombre y Unidad son requeridos' });
    const r = await pool.query('UPDATE materials SET name=$1,unit=$2,min_stock=$3,category=$4,base_cost=$5 WHERE id=$6', [name, unit, parseFloat(min_stock)||0, category||'OTRO', parseFloat(base_cost)||0, req.params.id]);
    if (r.rowCount===0) return res.status(404).json({ error: 'Material no encontrado' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/materials/:id', async (req, res) => {
  try { await pool.query('DELETE FROM materials WHERE id=$1',[req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Stock ──
app.get('/api/stock', async (req, res) => {
  try {
    const r = await pool.query('SELECT m.id as material_id,m.name,m.unit,m.category,m.min_stock,b.id as batch_id,b.lote,b.quantity,b.expiry_date,b.cost_per_unit FROM materials m LEFT JOIN batches b ON m.id=b.material_id AND b.quantity>0 ORDER BY m.name,b.expiry_date');
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Inventario ──
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
    if (!b) return res.status(404).json({ error: 'Lote no encontrado' });
    if (b.quantity < quantity) return res.status(400).json({ error: 'Stock insuficiente' });
    await client.query('UPDATE batches SET quantity=$1 WHERE id=$2',[b.quantity-quantity,batch_id]);
    await client.query('INSERT INTO movements (material_id,batch_id,lote,type,quantity,description) VALUES ($1,$2,$3,$4,$5,$6)',[b.material_id,batch_id,b.lote,'OUT',quantity,description]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ error: e.message }); }
  finally { client.release(); }
});

// ── Valorizacion ──
app.get('/api/business/valuation', async (req, res) => {
  try {
    const r = await pool.query('SELECT SUM(CASE WHEN quantity>0 THEN quantity*cost_per_unit ELSE 0 END) as total_valuation FROM batches');
    res.json({ total_valuation: r.rows[0].total_valuation||0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Movimientos ──
app.get('/api/movements', async (req, res) => {
  try {
    res.json((await pool.query('SELECT mov.*,mat.name as material_name,mat.unit FROM movements mov JOIN materials mat ON mov.material_id=mat.id ORDER BY mov.date DESC LIMIT 100')).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/movements/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { quantity, lote, description, date, cost_per_unit } = req.body;
    const mov = (await client.query('SELECT * FROM movements WHERE id=$1',[req.params.id])).rows[0];
    if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
    const batch = (await client.query('SELECT * FROM batches WHERE id=$1',[mov.batch_id])).rows[0];
    if (!batch) return res.status(404).json({ error: 'Lote no encontrado' });
    const diff = quantity - mov.quantity;
    const newQty = mov.type==='IN' ? batch.quantity+diff : batch.quantity-diff;
    if (newQty < 0) return res.status(400).json({ error: 'Stock negativo resultante' });
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
    if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado' });
    if (mov.type==='PROD') return res.status(400).json({ error: 'No se puede borrar un registro de produccion desde el historial general