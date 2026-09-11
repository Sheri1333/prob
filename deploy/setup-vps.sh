#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/talapker"
REPO="https://github.com/Sheri1333/prob.git"
PUBLIC_ORIGIN="http://195.49.212.31"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash deploy/setup-vps.sh"
  exit 1
fi

APP_USER="${SUDO_USER:-ubuntu}"

export DEBIAN_FRONTEND=noninteractive

echo "==> packages"
apt-get update -y
apt-get install -y ca-certificates curl gnupg git nginx ufw python3

if [ ! -f /swapfile ]; then
  echo "==> 2G swap"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

if ! command -v node >/dev/null 2>&1; then
  echo "==> Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! command -v mongod >/dev/null 2>&1; then
  echo "==> MongoDB 8"
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
    | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update -y
  apt-get install -y mongodb-org
fi

if ! grep -q 'cacheSizeGB' /etc/mongod.conf; then
  python3 - <<'PY'
from pathlib import Path
p = Path("/etc/mongod.conf")
lines = p.read_text().splitlines()
out = []
inserted = False
for line in lines:
    out.append(line)
    if not inserted and line.strip().startswith("dbPath:"):
        out.append("  wiredTiger:")
        out.append("    engineConfig:")
        out.append("      cacheSizeGB: 0.25")
        inserted = True
p.write_text("\n".join(out) + "\n")
PY
fi
systemctl enable --now mongod

if [ ! -d "$APP_DIR/.git" ]; then
  echo "==> clone repo"
  mkdir -p /var/www
  git clone "$REPO" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

ENV_FILE="$APP_DIR/server/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "==> writing $ENV_FILE"
  JWT="$(openssl rand -hex 32)"
  cat > "$ENV_FILE" <<EOF
HOST=127.0.0.1
PORT=3001
JWT_SECRET=$JWT
MONGODB_URI=mongodb://127.0.0.1:27017/prob
CORS_ORIGIN=$PUBLIC_ORIGIN
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi

cat > /etc/sudoers.d/talapker <<EOF
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart talapker-api, /usr/bin/systemctl reload nginx, /usr/sbin/nginx
EOF
chmod 440 /etc/sudoers.d/talapker

cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/talapker
ln -sfn /etc/nginx/sites-available/talapker /etc/nginx/sites-enabled/talapker
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

cp "$APP_DIR/deploy/talapker-api.service" /etc/systemd/system/talapker-api.service
systemctl daemon-reload
systemctl enable talapker-api
systemctl disable --now talapker-watch.timer 2>/dev/null || true

echo "==> first build"
sudo -u "$APP_USER" -H bash "$APP_DIR/deploy/deploy.sh"
systemctl enable --now talapker-api

if command -v mongosh >/dev/null 2>&1; then
  COUNT="$(mongosh --quiet --eval 'db.getSiblingDB("prob").tests.countDocuments()' || echo 0)"
  if [ "$COUNT" = "0" ]; then
    echo "==> seed ENT"
    sudo -u "$APP_USER" -H bash -lc "cd $APP_DIR/server && npm run seed"
  fi
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> ready: $PUBLIC_ORIGIN"
