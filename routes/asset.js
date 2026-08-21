const express = require('express');
const router = express.Router();
const { all, get, run } = require('../db');
const { requireAdmin } = require('../middleware/auth');

function nextKode() {
  const last = get("SELECT kode FROM assets ORDER BY id DESC LIMIT 1");
  if (!last) return 'AST-0001';
  const num = parseInt(last.kode.split('-')[1]) + 1;
  return 'AST-' + String(num).padStart(4, '0');
}

router.get('/kategori', requireAdmin, (req, res) => {
  res.json(all("SELECT * FROM asset_kategori ORDER BY urutan ASC"));
});
router.post('/kategori', requireAdmin, (req, res) => {
  const { nama } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama wajib diisi' });
  if (get('SELECT id FROM asset_kategori WHERE nama=?', [nama]))
    return res.status(400).json({ error: 'Nama kategori sudah ada' });
  const max = get("SELECT MAX(urutan) as m FROM asset_kategori");
  run('INSERT INTO asset_kategori (nama,urutan) VALUES (?,?)', [nama, (max&&max.m?max.m:0)+1]);
  res.json({ ok: true });
});
router.delete('/kategori/:id', requireAdmin, (req, res) => {
  const used = get('SELECT COUNT(*) as n FROM assets WHERE kategori_id=?', [req.params.id]);
  if (used && used.n > 0) return res.status(400).json({ error: 'Kategori digunakan oleh '+used.n+' aset' });
  run('DELETE FROM asset_kategori WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

router.get('/', requireAdmin, (req, res) => {
  res.json(all(`SELECT a.*,k.nama as kategori_nama,a.assigned_to as assigned_nama
    FROM assets a
    LEFT JOIN asset_kategori k ON a.kategori_id=k.id
    ORDER BY a.created_at DESC`));
});

router.get('/:id', requireAdmin, (req, res) => {
  const a = get(`SELECT a.*,k.nama as kategori_nama,a.assigned_to as assigned_nama,a.ttd_penyerah_at,a.ttd_penerima_at
    FROM assets a
    LEFT JOIN asset_kategori k ON a.kategori_id=k.id
    WHERE a.id=?`, [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Aset tidak ditemukan' });
  const riwayat = all(`SELECT r.*,u.nama as nama_user FROM asset_riwayat r
    JOIN users u ON r.user_id=u.id WHERE r.asset_id=? ORDER BY r.created_at DESC`, [a.id]);
  res.json({ ...a, riwayat });
});

router.post('/', requireAdmin, (req, res) => {
  const { nama, kategori_id, serial_number, kondisi, lokasi, assigned_to, tanggal_beli, nilai_aset, keterangan } = req.body;
  if (!nama) return res.status(400).json({ error: 'Nama aset wajib diisi' });
  const kode = nextKode();
  run(`INSERT INTO assets (kode,nama,kategori_id,serial_number,kondisi,lokasi,assigned_to,tanggal_beli,nilai_aset,keterangan) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [kode,nama,kategori_id||null,serial_number||'',kondisi||'baik',lokasi||'',assigned_to||'',tanggal_beli||'',nilai_aset||0,keterangan||'']);
  const newId = get("SELECT id FROM assets WHERE kode=?", [kode]).id;
  run('INSERT INTO asset_riwayat (asset_id,user_id,aksi,detail) VALUES (?,?,?,?)',
    [newId, req.session.user.id, 'Ditambahkan', 'Aset baru ditambahkan ke sistem']);
  res.json({ ok: true, kode });
});

router.patch('/:id', requireAdmin, (req, res) => {
  const a = get('SELECT * FROM assets WHERE id=?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Aset tidak ditemukan' });
  const { nama, kategori_id, serial_number, kondisi, lokasi, assigned_to, tanggal_beli, nilai_aset, keterangan } = req.body;
  const updates = []; const vals = [];
  if (nama !== undefined)          { updates.push('nama=?');          vals.push(nama); }
  if (kategori_id !== undefined)   { updates.push('kategori_id=?');   vals.push(kategori_id||null); }
  if (serial_number !== undefined) { updates.push('serial_number=?'); vals.push(serial_number); }
  if (kondisi !== undefined)       { updates.push('kondisi=?');       vals.push(kondisi); }
  if (lokasi !== undefined)        { updates.push('lokasi=?');        vals.push(lokasi); }
  if (assigned_to !== undefined)   { updates.push('assigned_to=?');   vals.push(assigned_to||''); }
  if (tanggal_beli !== undefined)  { updates.push('tanggal_beli=?');  vals.push(tanggal_beli); }
  if (nilai_aset !== undefined)    { updates.push('nilai_aset=?');    vals.push(nilai_aset); }
  if (keterangan !== undefined)    { updates.push('keterangan=?');    vals.push(keterangan); }
  updates.push("updated_at=datetime('now')");
  vals.push(req.params.id);
  run('UPDATE assets SET '+updates.join(',')+' WHERE id=?', vals);
  const changes = [];
  if (kondisi !== undefined && kondisi !== a.kondisi) changes.push('Kondisi: '+a.kondisi+' -> '+kondisi);
  if (lokasi !== undefined && lokasi !== a.lokasi) changes.push('Lokasi: '+(a.lokasi||'-')+' -> '+lokasi);
  if (assigned_to !== undefined && assigned_to != a.assigned_to) changes.push('Pengguna berubah');
  run('INSERT INTO asset_riwayat (asset_id,user_id,aksi,detail) VALUES (?,?,?,?)',
    [req.params.id, req.session.user.id, 'Diperbarui', changes.length?changes.join(', '):'Data aset diperbarui']);
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  if (!get('SELECT id FROM assets WHERE id=?', [req.params.id]))
    return res.status(404).json({ error: 'Aset tidak ditemukan' });
  run('DELETE FROM asset_riwayat WHERE asset_id=?', [req.params.id]);
  run('DELETE FROM assets WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// PATCH simpan TTD
router.patch('/:id/ttd', requireAdmin, (req, res) => {
  const { ttd_penyerah, ttd_penerima } = req.body;
  const a = get('SELECT id FROM assets WHERE id=?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Aset tidak ditemukan' });
  const updates = []; const vals = [];
  if (ttd_penyerah !== undefined) { updates.push('ttd_penyerah=?'); vals.push(ttd_penyerah||null); updates.push("ttd_penyerah_at=datetime('now')"); }
  if (ttd_penerima !== undefined) { updates.push('ttd_penerima=?'); vals.push(ttd_penerima||null); updates.push("ttd_penerima_at=datetime('now')"); }
  if (!updates.length) return res.status(400).json({ error: 'Tidak ada data' });
  vals.push(req.params.id);
  run('UPDATE assets SET '+updates.join(',')+ ' WHERE id=?', vals);
  res.json({ ok: true });
});

module.exports = router;
