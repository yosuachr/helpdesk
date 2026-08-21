const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const DB_PATH = path.join(__dirname, 'helpdesk.db');
async function patch() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));
  db.run(`CREATE TABLE IF NOT EXISTS asset_kategori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT UNIQUE NOT NULL,
    urutan INTEGER NOT NULL DEFAULT 0
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode TEXT UNIQUE NOT NULL,
    nama TEXT NOT NULL,
    kategori_id INTEGER,
    serial_number TEXT,
    kondisi TEXT NOT NULL DEFAULT 'baik',
    lokasi TEXT,
    assigned_to INTEGER,
    tanggal_beli TEXT,
    nilai_aset INTEGER DEFAULT 0,
    keterangan TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS asset_riwayat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    aksi TEXT NOT NULL,
    detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);
  const existing = db.exec("SELECT COUNT(*) as n FROM asset_kategori")[0].values[0][0];
  if (!existing) {
    const cats = ['Laptop','Monitor','Printer','Server','Jaringan','Telepon','UPS','Lainnya'];
    cats.forEach(function(c,i){ db.run("INSERT OR IGNORE INTO asset_kategori (nama,urutan) VALUES (?,?)",[c,i+1]); });
  }
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('OK - tabel asset siap');
}
patch().catch(console.error);
