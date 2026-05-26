# IT Helpdesk — Panduan Instalasi

Aplikasi helpdesk berbasis web dengan Node.js, SQLite, dan Express.

## Fitur
- Login multi-user (admin & staff)
- 4 kategori tiket: akun baru, akses, hardware, sistem error
- Prioritas: rendah / sedang / tinggi / kritis
- Status: Open → In Progress → Selesai
- Komentar & catatan per tiket
- Admin dapat assign tiket ke pengguna
- Data tersimpan permanen di SQLite

---

## Instalasi Cepat (Otomatis)

```bash
# 1. Copy folder helpdesk ke server Anda, lalu masuk ke folder tersebut
cd helpdesk

# 2. Beri izin eksekusi dan jalankan installer
chmod +x install.sh
bash install.sh
```

Script akan otomatis:
- Install Node.js 20
- Install semua dependensi
- Mendaftarkan sebagai service systemd (auto-start saat reboot)
- Membuka port 3000

---

## Instalasi Manual (langkah per langkah)

### 1. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # pastikan v20+
```

### 2. Install dependensi
```bash
cd helpdesk
npm install
```

### 3. Jalankan (development/test)
```bash
node server.js
# Akses di http://localhost:3000
```

### 4. Jalankan sebagai service (production)
```bash
sudo nano /etc/systemd/system/helpdesk.service
```
Isi dengan:
```ini
[Unit]
Description=IT Helpdesk App
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/helpdesk
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=PORT=3000
Environment=SESSION_SECRET=ganti-dengan-string-acak-panjang

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload
sudo systemctl enable helpdesk
sudo systemctl start helpdesk
```

---

## Akun Default

| Username | Password  | Role  |
|----------|-----------|-------|
| admin    | admin123  | Admin |
| staff1   | staff123  | Staff |

> **Segera ganti password setelah login pertama!**

---

## Perintah berguna

```bash
sudo systemctl status helpdesk    # cek status
sudo systemctl restart helpdesk   # restart
sudo journalctl -u helpdesk -f    # lihat log realtime
```

## Ganti port
Edit `/etc/systemd/system/helpdesk.service`, ubah `PORT=3000` ke port lain, lalu restart.

## Backup database
```bash
cp helpdesk.db helpdesk-backup-$(date +%Y%m%d).db
```
