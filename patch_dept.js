const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const DB_PATH = path.join(__dirname, 'helpdesk.db');
async function patch() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));
  db.run(`CREATE TABLE IF NOT EXISTS departemen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama TEXT UNIQUE NOT NULL,
    urutan INTEGER NOT NULL DEFAULT 0
  );`);
  const existing = db.exec("SELECT COUNT(*) as n FROM departemen")[0].values[0][0];
  if (!existing) {
    const depts = ['Finance','HR','IT','Marketing','Operasional','Sales'];
    depts.forEach(function(d,i){ db.run("INSERT OR IGNORE INTO departemen (nama,urutan) VALUES (?,?)",[d,i+1]); });
  }
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log('OK - tabel departemen siap');
}
patch().catch(console.error);
