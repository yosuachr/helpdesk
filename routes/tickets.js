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

router.get('/', requireLogin, (req, res) => {
  const user = req.session.user;
  const sql = `SELECT t.*, u.nama as pelapor, t.departemen_tiket as departemen, a.nama as assignee_nama,
    (SELECT MAX(created_at) FROM komentar WHERE ticket_id=t.id) as last_komentar_at,
    CASE WHEN (SELECT MAX(created_at) FROM komentar WHERE ticket_id=t.id) > t.updated_at
      THEN (SELECT MAX(created_at) FROM komentar WHERE ticket_id=t.id)
      ELSE t.updated_at END as last_activity
    FROM tickets t JOIN users u ON t.user_id=u.id LEFT JOIN users a ON t.assigned_to=a.id
    ${user.role !== 'admin' ? 'WHERE t.user_id=?' : ''} ORDER BY last_activity DESC`;
  res.json(user.role !== 'admin' ? all(sql, [user.id]) : all(sql));
});

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

router.get('/notif/count', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const isAdmin = req.session.user.role === 'admin';
  const ticketFilter = isAdmin ? '1=1' : '(t.user_id=? OR t.assigned_to=?)';
  const params = isAdmin ? [] : [userId, userId];

  const sql = 'SELECT t.id FROM tickets t WHERE ' + ticketFilter;
  const tickets = all(sql, params);
  let totalUnread = 0;
  const detail = [];

  tickets.forEach(function(t) {
    const lastRead = get('SELECT last_read_at FROM ticket_read_status WHERE ticket_id=? AND user_id=?', [t.id, userId]);
    const sqlC = lastRead
      ? 'SELECT COUNT(*) as n FROM komentar WHERE ticket_id=? AND created_at > ? AND user_id != ?'
      : 'SELECT COUNT(*) as n FROM komentar WHERE ticket_id=? AND user_id != ?';
    const sqlParams = lastRead ? [t.id, lastRead.last_read_at, userId] : [t.id, userId];
    const result = get(sqlC, sqlParams);
    if (result && result.n > 0) {
      totalUnread += result.n;
      detail.push({ ticket_id: t.id, unread: result.n });
    }
  });

  res.json({ total: totalUnread, detail: detail });
});

router.post('/:id/read', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const existing = get('SELECT id FROM ticket_read_status WHERE ticket_id=? AND user_id=?', [req.params.id, userId]);
  if (existing) {
    run("UPDATE ticket_read_status SET last_read_at=datetime('now') WHERE id=?", [existing.id]);
  } else {
    run("INSERT INTO ticket_read_status (ticket_id,user_id,last_read_at) VALUES (?,?,datetime('now'))", [req.params.id, userId]);
  }
  res.json({ ok: true });
});

router.get('/:id', requireLogin, (req, res) => {
  const user = req.session.user;
  const t = get(`SELECT t.*, u.nama as pelapor, t.departemen_tiket as departemen, a.nama as assignee_nama
    FROM tickets t JOIN users u ON t.user_id=u.id LEFT JOIN users a ON t.assigned_to=a.id
    WHERE t.id=?`, [req.params.id]);
  if (!t) return res.status(404).json({ error: 'Tiket tidak ditemukan' });
  if (user.role !== 'admin' && t.user_id !== user.id)
    return res.status(403).json({ error: 'Akses ditolak' });
  const komentar = all(`SELECT k.*, u.nama as nama_user, u.role FROM komentar k
    JOIN users u ON k.user_id=u.id WHERE k.ticket_id=? ORDER BY k.created_at ASC`, [t.id]);
  const riwayat = all(`SELECT r.*, u.nama as nama_user FROM ticket_riwayat r
    JOIN users u ON r.user_id=u.id WHERE r.ticket_id=? ORDER BY r.created_at ASC`, [t.id]);
  res.json({ ...t, komentar, riwayat });
});

router.post('/', requireLogin, (req, res) => {
  const { kategori, judul, deskripsi, prioritas, departemen } = req.body;
  if (!kategori || !judul || !deskripsi)
    return res.status(400).json({ error: 'Kategori, judul, dan deskripsi wajib diisi' });
  const nomor = nextNomor();
  const result = run(`INSERT INTO tickets (nomor,kategori,judul,deskripsi,prioritas,user_id,departemen_tiket) VALUES (?,?,?,?,?,?,?)`,
    [nomor, kategori, judul, deskripsi, prioritas || 'sedang', req.session.user.id, departemen || '']);
  run('INSERT INTO ticket_riwayat (ticket_id,user_id,aksi,detail) VALUES (?,?,?,?)',
    [result.lastInsertRowid, req.session.user.id, 'Dibuat', 'Tiket baru dibuat']);
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
  if (status) {
    updates.push('status=?'); vals.push(status);
    if (status === 'done') updates.push("closed_at=datetime('now')");
    else updates.push('closed_at=NULL');
  }
  if (assigned_to !== undefined) { updates.push('assigned_to=?'); vals.push(assigned_to || null); }
  if (prioritas) { updates.push('prioritas=?'); vals.push(prioritas); }
  updates.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(req.params.id);
  run('UPDATE tickets SET ' + updates.join(',') + ' WHERE id=?', vals);
  const statusLabel = {open:'Open', in_progress:'In Progress', done:'Selesai'};
  const aksiMap = {open:'Dibuka kembali', in_progress:'Mulai diproses', done:'Diselesaikan'};
  if (status) {
    run('INSERT INTO ticket_riwayat (ticket_id,user_id,aksi,detail) VALUES (?,?,?,?)',
      [req.params.id, user.id, aksiMap[status]||status, 'Status berubah ke '+(statusLabel[status]||status)]);
  }
  if (assigned_to) {
    run('INSERT INTO ticket_riwayat (ticket_id,user_id,aksi,detail) VALUES (?,?,?,?)',
      [req.params.id, user.id, 'Ditugaskan', 'Tiket ditugaskan ke teknisi']);
  }
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
