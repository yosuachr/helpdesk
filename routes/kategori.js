const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');
router.get('/', requireLogin, (req, res) => {
  res.json(all("SELECT * FROM kategori WHERE aktif=1 ORDER BY urutan ASC"));
});
router.get('/all', requireAdmin, (req, res) => {
  res.json(all("SELECT * FROM kategori ORDER BY urutan ASC"));
});
router.post('/', requireAdmin, (req, res) => {
  const { kode, judul, deskripsi, icon, warna } = req.body;
  if (!kode || !judul || !deskripsi) return res.status(400).json({ error: 'Kode, judul, dan deskripsi wajib diisi' });
  if (!/^[a-z0-9_]+$/.test(kode)) return res.status(400).json({ error: 'Kode hanya huruf kecil, angka, underscore' });
  if (get('SELECT id FROM kategori WHERE kode=?', [kode])) return res.status(400).json({ error: 'Kode sudah digunakan' });
  const maxUrutan = get("SELECT MAX(urutan) as m FROM kategori");
  const urutan = (maxUrutan && maxUrutan.m ? maxUrutan.m : 0) + 1;
  run('INSERT INTO kategori (kode,judul,deskripsi,icon,warna,urutan) VALUES (?,?,?,?,?,?)',[kode,judul,deskripsi,icon||'📋',warna||'#555555',urutan]);
  res.json({ ok: true });
});
router.patch('/:id', requireAdmin, (req, res) => {
  const { judul, deskripsi, icon, warna, aktif, urutan } = req.body;
  if (!get('SELECT id FROM kategori WHERE id=?', [req.params.id])) return res.status(404).json({ error: 'Tidak ditemukan' });
  const updates = []; const vals = [];
  if (judul !== undefined){ updates.push('judul=?'); vals.push(judul); }
  if (deskripsi !== undefined){ updates.push('deskripsi=?'); vals.push(deskripsi); }
  if (icon !== undefined){ updates.push('icon=?'); vals.push(icon); }
  if (warna !== undefined){ updates.push('warna=?'); vals.push(warna); }
  if (aktif !== undefined){ updates.push('aktif=?'); vals.push(aktif ? 1 : 0); }
  if (urutan !== undefined){ updates.push('urutan=?'); vals.push(urutan); }
  if (!updates.length) return res.status(400).json({ error: 'Tidak ada data' });
  vals.push(req.params.id);
  run('UPDATE kategori SET '+updates.join(',')+' WHERE id=?', vals);
  res.json({ ok: true });
});
router.delete('/:id', requireAdmin, (req, res) => {
  const kat = get('SELECT kode FROM kategori WHERE id=?', [req.params.id]);
  if (!kat) return res.status(404).json({ error: 'Tidak ditemukan' });
  const used = get('SELECT COUNT(*) as n FROM tickets WHERE kategori=?', [kat.kode]);
  if (used && used.n > 0) return res.status(400).json({ error: 'Digunakan oleh '+used.n+' tiket. Nonaktifkan saja.' });
  run('DELETE FROM kategori WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});
module.exports = router;
