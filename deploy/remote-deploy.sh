#!/usr/bin/env bash
# Deploy artifact onto VPS (called by GitHub Actions over SSH).
# Expects release tarball already uploaded to /tmp/url-shortener-release.tgz
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/url-shortener}"
RELEASE_TGZ="${RELEASE_TGZ:-/tmp/url-shortener-release.tgz}"

mkdir -p "$APP_ROOT"
tar -xzf "$RELEASE_TGZ" -C "$APP_ROOT"

cd "$APP_ROOT/server"
# production deps only (node_modules may be included from runner or installed here)
if [[ ! -d node_modules ]]; then
  npm ci --omit=dev
fi

# Ensure schema exists (idempotent)
npm run migrate

mkdir -p /var/log/url-shortener
pm2 startOrReload "$APP_ROOT/deploy/ecosystem.config.js" --update-env
pm2 save

echo "Deploy finished at $(date -Is)"
