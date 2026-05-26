#!/bin/bash
# ============================================================
# install.sh — Setup otomatis IT Helpdesk
# Jalankan: bash install.sh
# ============================================================

set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

echo -e "${GREEN}=== IT Helpdesk — Setup Otomatis ===${NC}"

# 1. Install Node.js (via NodeSource)
if ! command -v node &>/dev/null; then
  echo -e "${YELLOW}[1/4] Menginstall Node.js 20...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo -e "${GREEN}[1/4] Node.js sudah terinstall ($(node -v))${NC}"
fi

# 2. Install dependencies npm
echo -e "${YELLOW}[2/4] Menginstall dependencies...${NC}"
cd "$(dirname "$0")"
npm install

# 3. Setup systemd service
echo -e "${YELLOW}[3/4] Membuat systemd service...${NC}"
WORKDIR=$(pwd)
SERVICE_FILE="/etc/systemd/system/helpdesk.service"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=IT Helpdesk App
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORKDIR
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=SESSION_SECRET=$(openssl rand -hex 32)

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable helpdesk
sudo systemctl start helpdesk

# 4. Firewall (jika ufw aktif)
if command -v ufw &>/dev/null && sudo ufw status | grep -q "active"; then
  echo -e "${YELLOW}[4/4] Membuka port 3000 di firewall...${NC}"
  sudo ufw allow 3000/tcp
else
  echo -e "${GREEN}[4/4] Firewall tidak aktif, skip.${NC}"
fi

IP=$(hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}✓ Helpdesk berhasil diinstall!${NC}"
echo ""
echo "  Akses : http://${IP}:3000"
echo "  Login : admin / admin123"
echo "         staff1 / staff123"
echo ""
echo "  Cek status : sudo systemctl status helpdesk"
echo "  Lihat log  : sudo journalctl -u helpdesk -f"
echo "  Restart    : sudo systemctl restart helpdesk"
echo ""
echo -e "${YELLOW}⚠ Segera ganti password admin setelah login pertama!${NC}"
