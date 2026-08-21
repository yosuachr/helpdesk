const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const path = require('path');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  store: new FileStore({ path: './sessions', ttl: 28800 }),
  secret: process.env.SESSION_SECRET || 'helpdesk-secret-ganti-ini',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

const { requireLogin } = require('./middleware/auth');

// File statis publik (login.html, css, js) — tanpa proteksi
app.use('/login.html', express.static(path.join(__dirname, 'public', 'login.html')));
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use('/', require('./routes/auth'));
app.use('/api/departemen', require('./routes/departemen'));
app.use('/uploads', require('express').static(require('path').join(__dirname, 'public/uploads')));
app.use('/api/uploads', require('./routes/upload'));
app.use('/dbadmin/api', require('./routes/dbadmin'));
app.use('/api/assets', require('./routes/asset'));
app.use('/api/kategori', require('./routes/kategori'));
app.use('/api/users', require('./routes/users'));
app.use('/api/tickets', require('./routes/tickets'));

// index.html harus login dulu
app.get('/', requireLogin, (req, res) => res.sendFile('index.html', { root: './public' }));
app.get('/dbadmin', (req, res) => res.sendFile('dbadmin.html', { root: './public' }));
app.get('/me', requireLogin, (req, res) => res.json(req.session.user));

getDb().then(() => {
  app.listen(PORT, () => {
    console.log('Helpdesk berjalan di http://localhost:' + PORT);
    console.log('Login: admin / admin123  |  staff1 / staff123');
  });
});
