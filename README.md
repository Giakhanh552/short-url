# Shortly — URL Shortener (DevOps Final Lab)

Full-stack URL shortener operated like production: HTTPS on VPS, GitHub Actions CI/CD, Discord notifications, Prometheus/Grafana/Alertmanager.

> **Notify channel:** This project uses **Discord webhooks** instead of Telegram (same role: deploy ✅/❌ + alert FIRING/RESOLVED). If your instructor requires Telegram, only the workflow notify step and Alertmanager Discord bridge need swapping — secrets stay out of the repo.

## Architecture

```text
Internet
   │
   ▼
 Nginx :443 (HTTPS / Let's Encrypt)
   ├─ /          → React static (client/dist)
   ├─ /api/*     → Express 127.0.0.1:3000
   ├─ /r/*       → Express redirect
   └─ /grafana/  → Grafana 127.0.0.1:3001
         │
         ▼
   Express (PM2) + /metrics (localhost only)
         │
         ▼
   PostgreSQL 127.0.0.1:5432 (auth)

Prometheus scrapes: node-exporter :9100 + app :3000/metrics
Alertmanager → discord-bridge :9094 → Discord webhook
GitHub Actions → SSH/rsync artifact → PM2 reload → /api/health
```

## Stack

| Layer | Tech |
|-------|------|
| Client | React + Vite |
| Server | Node.js + Express |
| DB | PostgreSQL |
| Process | PM2 |
| Proxy/TLS | Nginx + Certbot |
| CI/CD | GitHub Actions |
| Notify | Discord webhook |
| Monitoring | Prometheus, Grafana, Alertmanager, node-exporter |

## Repository layout

```text
client/                 React UI (CRUD)
server/                 Express API + unit tests + prom-client
deploy/                 Nginx, PM2, DB bootstrap, remote deploy
monitoring/             docker-compose + rules + Grafana dashboard
.github/workflows/      ci.yml + deploy.yml
.env.example            App env template (copy on VPS only)
```

## API (entity: Link)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health (CI + monitoring) |
| GET | `/api/links` | List |
| GET | `/api/links/:id` | Detail |
| POST | `/api/links` | Create `{ "longUrl": "https://..." }` |
| PUT | `/api/links/:id` | Update long URL |
| DELETE | `/api/links/:id` | Delete |
| GET | `/r/:code` | Redirect + click++ |
| GET | `/metrics` | Prometheus (localhost / scrape only — **not** public) |

## Local development

Prerequisites: Node 20+, PostgreSQL.

```bash
cp .env.example .env
# edit DB_* passwords

# create DB/user (local)
createdb urlshortener   # or use deploy/setup-db.sh on Ubuntu

cd server && npm ci && npm run migrate && npm test && npm run dev
# other terminal
cd client && npm ci && npm run dev
```

Open http://127.0.0.1:5173 (Vite proxies `/api` and `/r`).

## VPS setup (first time)

1. Point DNS **A** record of your domain to the VPS.
2. SSH in and install base packages:

```bash
export DOMAIN=your.domain.com
export DB_PASSWORD='strong-password'
sudo -E bash deploy/bootstrap.sh
sudo -E bash deploy/setup-db.sh
```

3. Place the app (or let the first Actions deploy create it), then create secrets on the server:

```bash
sudo mkdir -p /var/www/url-shortener
sudo cp .env.example /var/www/url-shortener/.env
sudo nano /var/www/url-shortener/.env   # set DB_PASSWORD etc.
```

4. Nginx: edit `deploy/nginx.conf` — replace `YOUR_DOMAIN`, enable site, obtain cert:

```bash
sudo sed "s/YOUR_DOMAIN/${DOMAIN}/g" deploy/nginx.conf \
  | sudo tee /etc/nginx/sites-available/url-shortener
sudo ln -sf /etc/nginx/sites-available/url-shortener /etc/nginx/sites-enabled/
# First boot without SSL: temporarily comment ssl_* lines OR use certbot nginx plugin after HTTP-only server
sudo certbot --nginx -d "$DOMAIN"
sudo nginx -t && sudo systemctl reload nginx
```

5. PM2 (after files exist):

```bash
cd /var/www/url-shortener/server
npm ci --omit=dev
npm run migrate
pm2 start /var/www/url-shortener/deploy/ecosystem.config.js
pm2 save
pm2 startup   # enable on reboot
```

6. Firewall check: `sudo ufw status` → only OpenSSH, 80, 443.

7. Monitoring:

```bash
cd /var/www/url-shortener/monitoring
cp .env.example .env
nano .env   # DISCORD_WEBHOOK_URL + GRAFANA_ADMIN_PASSWORD
docker compose up -d
```

Grafana: `https://YOUR_DOMAIN/grafana/` — create a **Viewer** user for the instructor.

## GitHub Secrets

Settings → Secrets and variables → Actions:

| Secret | Purpose |
|--------|---------|
| `SSH_PRIVATE_KEY` | Deploy key (private) |
| `VPS_HOST` | VPS IP or hostname |
| `VPS_USER` | SSH user |
| `DEPLOY_PATH` | e.g. `/var/www/url-shortener` |
| `DOMAIN` | e.g. `shortly.example.com` |
| `HEALTH_URL` | optional override `https://DOMAIN/api/health` |
| `DISCORD_WEBHOOK_URL` | Discord channel webhook |

Never commit `.env`, keys, or webhook URLs.

## CI/CD behaviour

- **ci.yml** — every push/PR: real unit tests (`validateUrl`, `generateShortCode`, …) + client build.
- **deploy.yml** — push to `main`: test → build on runner → upload tarball → extract on VPS → `pm2 startOrReload` → health check → **one** Discord message.
  - Tests fail → deploy job skipped → site unchanged → Discord ❌ with Actions link.
  - Health fail → workflow red → Discord ❌.

## Alerts (Telegram-equivalent on Discord)

| Alert | Condition | `for` | Runbook hint |
|-------|-----------|-------|--------------|
| AppDown | `up{job="app"} == 0` | 1m | `pm2 status` / `pm2 restart url-shortener` |
| HighCPU | CPU > 85% | 5m | `top`, `pm2`, `docker stats` |
| HighMemory | RAM > 90% | 5m | `free -h` |
| DiskAlmostFull | `/` > 85% | 5m | `df -h`, prune logs/docker |

`send_resolved: true` → Discord gets **RESOLVED** embeds when cleared.

### Incident drill (required for video)

```bash
pm2 stop url-shortener          # wait ~1–2m → FIRING AppDown on Discord
pm2 start url-shortener         # wait → RESOLVED
```

## Demo video checklist (4 scenes)

1. HTTPS site — CRUD create/edit/delete + open short link.
2. Tiny code change → `git push` → Actions green → UI updates → Discord ✅.
3. Break a unit test on purpose → push → Actions red → site **unchanged** → Discord ❌.
4. Stop app → alert FIRING → start app → RESOLVED.

## Runbook (short)

| Symptom | Check | Fix |
|---------|-------|-----|
| AppDown | `curl -s 127.0.0.1:3000/api/health` | `pm2 logs url-shortener`; fix `.env`/DB; `pm2 restart` |
| Site 502 | `pm2 status`; `sudo nginx -t` | restart PM2 / reload Nginx |
| HighCPU/RAM | `top`, `docker stats` | restart runaway container/process |
| Disk | `df -h` | `journalctl --vacuum-size=200M`; `docker system prune` |
| Cert renew | `sudo certbot renew --dry-run` | fix Nginx/HTTP-01 if dry-run fails |

## Why Nginx in front?

Terminates TLS, serves static assets efficiently, reverse-proxies API, keeps Node bound to `127.0.0.1`, and blocks public `/metrics`. App ports are never opened in `ufw`.

## License

Student lab project — use freely for coursework.
