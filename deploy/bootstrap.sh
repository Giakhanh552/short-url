#!/usr/bin/env bash
# First-time VPS bootstrap helpers (run on Ubuntu as root).
# Does NOT replace reading the README — adjust DOMAIN and paths first.
set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN=your.domain.com}"
APP_ROOT="${APP_ROOT:-/var/www/url-shortener}"

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx ufw curl rsync

# Node 20 via NodeSource if missing
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

mkdir -p "$APP_ROOT" /var/log/url-shortener /var/www/certbot

# Firewall: SSH + HTTP + HTTPS only
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status

echo "Install app files to $APP_ROOT, configure .env, setup-db.sh, then:"
echo "  cd $APP_ROOT/server && npm ci --omit=dev && npm run migrate"
echo "  pm2 start $APP_ROOT/deploy/ecosystem.config.js"
echo "  pm2 save && pm2 startup"
echo "  # edit deploy/nginx.conf (YOUR_DOMAIN -> $DOMAIN), enable site, then:"
echo "  certbot --nginx -d $DOMAIN"
