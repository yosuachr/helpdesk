const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { requireLogin, requireAdmin } = require('../middleware/auth');

function nextNomor() {
  const last = get("SELECT nomor FROM tickets ORDER BY id DESC LIMIT 1");
  if (!last) return 'TKT-0001';
  const num = parseInt(last.nomor.split('-')[1]) + 1;
  return 'TKT-' + String(num).padStart(4, '0');
}

router.get('/admin/stats', requireAdmin, (req, res) => {
  const total = get('SELECT COUNT(*) as n FROM tickets').n;
  const open  = get("SELECT COUNT(*) as n FROM tickets WHERE status='open'").n;
  const prog  = get("SELECT COUNT(*) as n FROM tickets WHERE status='in_progress'").n;
  const done  = get("SELECT COUNT(*) as n FROM tickets WHERE status='done'").n;
  const byKat = all("SELECT kategori, COUNT(*) as n FROM tickets GROUP BY kategori");
  res.json({ total, open, in_progress: prog, done, byKategori: byKat });
});

router.get('/admin/users', requireAdmin, (req, res) => {
  res.json(all('SELECT id, username, nama, role, departemen FROM users ORDER BY nama'));
});

router.get('/', requireLogin, (req, res) => {
  const user = req.session.user;
  const sql = `SELECT t.*, u.nama as pelapor, u.departemen, a.nama as assignee_nama
    FROM tickets t JOIN users u ON t.user_id=u.id LEFT JOIN users a ON t.assigned_to=a.id
    ${user.role !== 'admin' ? 'WHERE t.user_id=?' : ''} ORDER BY t.created_at DESC`;
  res.json(user.role !== 'admin' ? all(sql, [user.id]) : all(sql));
});

router.get('/:id', requireLogin, (req, res) => {
  const user = req.session.user;
  const t = get(`SELECT t.*, u.nama as pelapor, u.departemen, a.nama as assignee_nama
    FROM tickets t JOIN users u ON t.user_id=u.id LEFT JOIN users a ON t.assigned_to=a.id
    WHERE t.id=?`, [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  if (user.role !== 'admin' && t.user_id !== user.id)
    return res.status(403).json({ error: 'Akses ditolak' });
  const komentar = all(`SELECT k.*, u.nama as nama_user, u.role FROM komentar k
    JOIN users u ON k.user_id=u.id WHERE k.ticket_id=? ORDER BY k.created_at ASC`, [t.id]);
  res.json({ ...t, komentar });
});

router.post('/', requireLogin, (req, res) => {
  const { kategori, judul, deskripsi, prioritas } = req.body;
  if (!kategori || !judul || !deskripsi)
    return res.status(400).json({ error: 'Kategori, judul, dan deskripsi wajib diisi' });
  const nomor = nextNomor();
  const result = run(`INSERT INTO tickets (nomor,kategori,judul,deskripsi,prioritas,user_id) VALUES (?,?,?,?,?,?)`,
    [nomor, kategori, judul, deskripsi, prioritas || 'sedang', req.session.user.id]);
  res.json({ ok: true, id: result.lastInsertRowid, nomor });
});

router.patch('/:id', requireLogin, (req, res) => {
  const user = req.session.user;
  const t = get('SELECT * FROM tickets WHERE id=?', [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  if (user.role !== 'admin' && t.user_id !== user.id)
    return res.status(403).json({ error: 'Akses ditolak' });
  const { status, assigned_to, prioritas } = req.body;
  const updates = []; const vals = [];
  if (status) { updates.push('status=?'); vals.push(status); }
  if (assigned_to !== undefined) { updates.push('assigned_to=?'); vals.push(assigned_to || null); }
  if (prioritas) { updates.push('prioritas=?'); vals.push(prioritas); }
  updates.push('updated_at=datetime(\'now\')');
  vals.push(req.params.id);
  run(`UPDATE tickets SET ${updates.join(',')} WHERE id=?`, vals);
  res.json({ ok: true });
});

router.post('/:id/komentar', requireLogin, (req, res) => {
  const { isi } = req.body;
  if (!isi) return res.status(400).json({ error: 'Komentar tidak boleh kosong' });
  if (!get('SELECT id FROM tickets WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  run('INSERT INTO komentar (ticket_id,user_id,isi) VALUES (?,?,?)',
    [req.params.id, req.session.user.id, isi]);
  res.json({ ok: true });
});

module.exports = router;
