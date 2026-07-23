#!/usr/bin/env bash
# Setup PostgreSQL for URL shortener on Ubuntu.
# Usage (as root or with sudo):
#   export DB_PASSWORD='your-strong-password'
#   sudo -E bash deploy/setup-db.sh
set -euo pipefail

DB_NAME="${DB_NAME:-urlshortener}"
DB_USER="${DB_USER:-urlapp}"
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD before running}"

export DEBIAN_FRONTEND=noninteractive

if ! command -v psql >/dev/null 2>&1; then
  apt-get update
  apt-get install -y postgresql postgresql-contrib
fi

systemctl enable --now postgresql

# Bind Postgres to localhost only
PG_CONF="$(ls /etc/postgresql/*/main/postgresql.conf | head -1)"
PG_HBA="$(ls /etc/postgresql/*/main/pg_hba.conf | head -1)"

sed -i "s/^#\\?listen_addresses.*/listen_addresses = '127.0.0.1'/" "$PG_CONF"

# Ensure md5/scram auth for local connections of app user
if ! grep -q "urlapp" "$PG_HBA"; then
  cat >> "$PG_HBA" <<EOF

# URL shortener app
host    ${DB_NAME}    ${DB_USER}    127.0.0.1/32    scram-sha-256
EOF
fi

systemctl restart postgresql

sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\\gexec

GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\\c ${DB_NAME}
GRANT ALL ON SCHEMA public TO ${DB_USER};
SQL

echo "PostgreSQL ready: db=${DB_NAME} user=${DB_USER} host=127.0.0.1"
echo "Next: put credentials in /var/www/url-shortener/.env and run: cd server && npm run migrate"
