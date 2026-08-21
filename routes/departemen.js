const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');

router.get('/', requireLogin, (req, res) => {
  res.json(all("SELECT * FROM departemen ORDER BY urutan ASC"));
});
router.post('/', requireAdmin, (req, res) => {
  const { nama } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
  if (get('SELECT id FROM departemen WHERE nama=?', [nama]))
    return res.status(400).json({ error: 'Departemen sudah ada' });
  const max = get("SELECT MAX(urutan) as m FROM departemen");
  run('INSERT INTO departemen (nama,urutan) VALUES (?,?)', [nama, (max&&max.m?max.m:0)+1]);
  res.json({ ok: true });
});
router.patch('/:id', requireAdmin, (req, res) => {
  const { nama } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
  if (!get('SELECT id FROM departemen WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Tidak ditemukan' });
  if (get('SELECT id FROM departemen WHERE nama=? AND id!=?', [nama, req.params.id]))
    return res.status(400).json({ error: 'Nama sudah digunakan' });
  run('UPDATE departemen SET nama=? WHERE id=?', [nama, req.params.id]);
  res.json({ ok: true });
});
router.delete('/:id', requireAdmin, (req, res) => {
  if (!get('SELECT id FROM departemen WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Tidak ditemukan' });
  run('DELETE FROM departemen WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});
module.exports = router;
