const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { all, get, run } = require('../db');
const { requireLogin } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname);
    const name = Date.now() + '-' + Math.random().toString(36).substr(2,8) + ext;
    cb(null, name);
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // max 10MB per file

// POST upload lampiran ke tiket
router.post('/:ticketId', requireLogin, upload.array('files', 20), (req, res) => {
  const ticketId = req.params.ticketId;
  const ticket = get('SELECT id FROM tickets WHERE id=?', [ticketId]);
  if (!ticket) return res.status(404).json({ error: 'Tiket tidak ditemukan' });

  if (!req.files || !req.files.length)
    return res.status(400).json({ error: 'Tidak ada file yang diupload' });

  req.files.forEach(function(file) {
    run('INSERT INTO ticket_lampiran (ticket_id,user_id,filename,originalname,mimetype,size) VALUES (?,?,?,?,?,?)',
      [ticketId, req.session.user.id, file.filename, file.originalname, file.mimetype, file.size]);
  });

  res.json({ ok: true, count: req.files.length });
});

// GET lampiran tiket
router.get('/:ticketId', requireLogin, (req, res) => {
  const files = all('SELECT * FROM ticket_lampiran WHERE ticket_id=? ORDER BY created_at ASC', [req.params.ticketId]);
  res.json(files);
});

// DELETE lampiran
router.delete('/:ticketId/:id', requireLogin, (req, res) => {
  const f = get('SELECT * FROM ticket_lampiran WHERE id=? AND ticket_id=?', [req.params.id, req.params.ticketId]);
  if (!f) return res.status(404).json({ error: 'File tidak ditemukan' });
  const filePath = path.join(__dirname, '../public/uploads', f.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  run('DELETE FROM ticket_lampiran WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
