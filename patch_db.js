const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const DB_PATH = path.join(__dirname, 'helpdesk.db');
async function patch() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));
  db.run(`CREATE TABLE IF NOT EXISTS kategori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode TEXT UNIQUE NOT NULL,
    judul TEXT NOT NULL,
    deskripsi TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📋',
    warna TEXT NOT NULL DEFAULT '#555555',
    urutan INTEGER NOT NULL DEFAULT 0,
    aktif INTEGER NOT NULL DEFAULT 1
  );`);
  const existing = db.exec("SELECT COUNT(*) as n FROM kategori")[0].values[0][0];
  if (!existing) {
    const defaults = [
      ['akun','Permintaan Akun Baru','Email, sistem, atau akun aplikasi','🧑','#185FA5',1],
      ['akses','Akses Baru','Hak akses folder, aplikasi, sistem','🔑','#0F6E56',2],
      ['hardware','Kerusakan Hardware','Laptop, monitor, printer, periferal','🖥','#854F0B',3],
      ['sistem','Sistem Error','Aplikasi error, crash, tidak bisa diakses','🐛','#A32D2D',4],
    ];
    defaults.forEach(function(r){db.run("INSERT INTO kategori (kode,judul,deskripsi,icon,warna,urutan) VALUES (?,?,?,?,?,?)",r);});
  }
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('OK - tabel kategori siap');
}
patch().catch(console.error);
