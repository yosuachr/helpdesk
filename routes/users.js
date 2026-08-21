const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { all, get, run } = require('../db');
const { requireAdmin } = require('../middleware/auth');

router.post('/', requireAdmin, (req, res) => {
  const { username, password, nama, departemen, role } = req.body;
  if (!username || !password || !nama)
    return res.status(400).json({ error: 'Nama, username, dan password wajib diisi' });
  if (get('SELECT id FROM users WHERE username=?', [username]))
    return res.status(400).json({ error: 'Username sudah digunakan' });
  const hash = bcrypt.hashSync(password, 10);
  run('INSERT INTO users (username,password,nama,role,departemen) VALUES (?,?,?,?,?)',
    [username, hash, nama, role||'staff', departemen||'']);
  res.json({ ok: true });
});

router.patch('/:id', requireAdmin, (req, res) => {
  const { password, role, departemen } = req.body;
  const user = get('SELECT id FROM users WHERE id=?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    run('UPDATE users SET password=? WHERE id=?', [hash, req.params.id]);
  }
  if (role) run('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
  if (departemen !== undefined) run('UPDATE users SET departemen=? WHERE id=?', [departemen, req.params.id]);
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.session.user.id)
    return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
  const user = get('SELECT id FROM users WHERE id=?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
  run('DELETE FROM users WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
