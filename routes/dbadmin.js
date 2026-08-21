const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');

const DBADMIN_USER = process.env.DBADMIN_USER || 'dbadmin';
const DBADMIN_PASS = process.env.DBADMIN_PASS || 'dbadmin123!';

function requireDbAdmin(req, res, next) {
  if (!req.session || !req.session.dbadmin) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === DBADMIN_USER && password === DBADMIN_PASS) {
    req.session.dbadmin = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Username atau password salah' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.dbadmin = false;
  res.json({ ok: true });
});

// GET daftar semua tabel
router.get('/tables', requireDbAdmin, (req, res) => {
  const tables = all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  res.json(tables.map(t => t.name));
});

// GET data tabel dengan pagination
router.get('/tables/:table', requireDbAdmin, (req, res) => {
  const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  const page = parseInt(req.query.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;
  const search = req.query.search || '';

  try {
    // Ambil info kolom
    const cols = all(`PRAGMA table_info(${table})`);
    if (!cols.length) return res.status(404).json({ error: 'Tabel tidak ditemukan' });

    // Hitung total
    let totalSql = `SELECT COUNT(*) as n FROM ${table}`;
    let dataSql = `SELECT * FROM ${table}`;
    const params = [];

    if (search) {
      const searchCols = cols.filter(c => c.type.includes('TEXT') || c.type === '').map(c => `${c.name} LIKE ?`);
      if (searchCols.length) {
        const where = ' WHERE ' + searchCols.join(' OR ');
        totalSql += where;
        dataSql += where;
        searchCols.forEach(() => params.push(`%${search}%`));
      }
    }

    dataSql += ` LIMIT ${limit} OFFSET ${offset}`;
    const total = get(totalSql, params).n;
    const rows = all(dataSql, params);
    res.json({ cols: cols.map(c => c.name), rows, total, page, limit });
  } catch(e) {
    res.status(400).json({ error: e.message });
  }
});

// POST tambah row
router.post('/tables/:table/rows', requireDbAdmin, (req, res) => {
  const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  const data = req.body;
  delete data.id;
  const keys = Object.keys(data);
  const vals = Object.values(data);
  if (!keys.length) return res.status(400).json({ error: 'Data kosong' });
  try {
    run(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`, vals);
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// PATCH update row
router.patch('/tables/:table/rows/:id', requireDbAdmin, (req, res) => {
  const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  const data = req.body;
  delete data.id;
  const keys = Object.keys(data);
  const vals = Object.values(data);
  if (!keys.length) return res.status(400).json({ error: 'Data kosong' });
  try {
    run(`UPDATE ${table} SET ${keys.map(k=>k+'=?').join(',')} WHERE id=?`, [...vals, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// DELETE row
router.delete('/tables/:table/rows/:id', requireDbAdmin, (req, res) => {
  const table = req.params.table.replace(/[^a-zA-Z0-9_]/g, '');
  try {
    run(`DELETE FROM ${table} WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

// POST jalankan SQL custom
router.post('/query', requireDbAdmin, (req, res) => {
  const { sql } = req.body;
  if (!sql) return res.status(400).json({ error: 'SQL kosong' });
  try {
    const upper = sql.trim().toUpperCase();
    if (upper.startsWith('SELECT')) {
      const rows = all(sql);
      res.json({ ok: true, rows, type: 'select' });
    } else {
      run(sql);
      res.json({ ok: true, type: 'exec' });
    }
  } catch(e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
