const express = require('express');
const session = require('express-session');
const path = require('path');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'helpdesk-secret-ganti-ini',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

app.use('/', require('./routes/auth'));
app.use('/api/tickets', require('./routes/tickets'));

const { requireLogin } = require('./middleware/auth');
app.get('/', requireLogin, (req, res) => res.sendFile('index.html', { root: './public' }));
app.get('/me', requireLogin, (req, res) => res.json(req.session.user));

getDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Helpdesk berjalan di http://localhost:${PORT}`);
    console.log('Login: admin / admin123  |  staff1 / staff123');
  });
});
