const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'helpdesk.db');
let db;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    db = new SQL.Database();
  }
  db.run(`PRAGMA foreign_keys = ON;`);
  initSchema();
  return db;
}

function save() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      nama TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      departemen TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomor TEXT UNIQUE NOT NULL,
      kategori TEXT NOT NULL,
      judul TEXT NOT NULL,
      deskripsi TEXT NOT NULL,
      prioritas TEXT NOT NULL DEFAULT 'sedang',
      status TEXT NOT NULL DEFAULT 'open',
      user_id INTEGER NOT NULL,
      assigned_to INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS komentar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      isi TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const adminCheck = db.exec("SELECT id FROM users WHERE username='admin'");
  if (!adminCheck.length || !adminCheck[0].values.length) {
    const hash1 = bcrypt.hashSync('admin123', 10);
    const hash2 = bcrypt.hashSync('staff123', 10);
    db.run("INSERT INTO users (username,password,nama,role,departemen) VALUES (?,?,?,?,?)", ['admin', hash1, 'Administrator', 'admin', 'IT']);
    db.run("INSERT INTO users (username,password,nama,role,departemen) VALUES (?,?,?,?,?)", ['staff1', hash2, 'Budi Santoso', 'staff', 'Finance']);
    const aId = db.exec("SELECT id FROM users WHERE username='admin'")[0].values[0][0];
    const sId = db.exec("SELECT id FROM users WHERE username='staff1'")[0].values[0][0];
    const ins = [
      ['TKT-0001','akun','Permintaan akun email karyawan baru','Perlu akun email untuk karyawan magang yang mulai Senin.','sedang','open',sId,null],
      ['TKT-0002','hardware','Monitor tidak menyala','Monitor di meja kerja tidak menyala sejak pagi, sudah coba restart.','tinggi','in_progress',sId,aId],
      ['TKT-0003','sistem','Aplikasi HRIS error 500','Tidak bisa login ke HRIS sejak kemarin sore, muncul error 500.','kritis','open',sId,null],
      ['TKT-0004','akses','Akses folder shared Finance','Butuh akses ke shared drive Finance untuk laporan Q2.','rendah','done',sId,aId],
    ];
    ins.forEach(r => db.run("INSERT INTO tickets (nomor,kategori,judul,deskripsi,prioritas,status,user_id,assigned_to) VALUES (?,?,?,?,?,?,?,?)", r));
    save();
  }
}

// Helper: all rows as array of objects
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function get(sql, params = []) {
  return all(sql, params)[0] || null;
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
  return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
}

module.exports = { getDb, all, get, run, save };
