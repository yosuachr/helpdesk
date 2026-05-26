const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { get, run, all } = require('../db');

router.get('/login', (req, res) => {
  if (req.session && req.session.user) return res.redirect('/');
  res.sendFile('login.html', { root: './public' });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  const user = get('SELECT * FROM users WHERE username = ?', [username]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Username atau password salah' });
  req.session.user = { id: user.id, username: user.username, nama: user.nama, role: user.role, departemen: user.departemen };
  res.json({ ok: true, role: user.role });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.post('/register', (req, res) => {
  const { username, password, nama, departemen } = req.body;
  if (!username || !password || !nama)
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  if (get('SELECT id FROM users WHERE username = ?', [username]))
    return res.status(400).json({ error: 'Username sudah digunakan' });
  const hash = bcrypt.hashSync(password, 10);
  run('INSERT INTO users (username, password, nama, role, departemen) VALUES (?, ?, ?, ?, ?)',
    [username, hash, nama, 'staff', departemen || '']);
  res.json({ ok: true });
});

module.exports = router;
