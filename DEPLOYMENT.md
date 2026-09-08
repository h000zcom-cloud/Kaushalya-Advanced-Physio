# Deployment

Target: a Linux VPS running Docker with a reverse proxy terminating HTTPS.

## Containers

- `backend` — FastAPI/uvicorn on port 8001 (see `docker/backend.Dockerfile`)
- `frontend` — static React build served by nginx (see `docker/frontend.Dockerfile`), proxying `/api` to the backend
- `mongo` — MongoDB 7 with a persistent volume
- Reverse proxy (Caddy or nginx + certbot) in front, forwarding `/` to `frontend` and `/api` to `backend`

`docker/docker-compose.yml` wires these together with `restart: unless-stopped` and health checks.

## First deployment

```bash
git clone <repo> && cd <repo>
cp backend/.env.example backend/.env       # fill production values; ENVIRONMENT=production, SEED_DEMO_DATA=false
cp frontend/.env.example frontend/.env     # REACT_APP_BACKEND_URL=https://your-domain
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml logs -f backend   # wait for "Application started"
```

Generate secrets with `python -c "import secrets;print(secrets.token_hex(32))"`. Set `CORS_ORIGINS=https://your-domain`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=lax`, `PUBLIC_APP_URL=https://your-domain`.

## Reverse proxy (Caddy example)

```
your-domain {
  encode zstd gzip
  handle /api/* {
    reverse_proxy backend:8001
  }
  handle {
    reverse_proxy frontend:80
  }
}
```

Caddy provisions and renews TLS automatically. With nginx use certbot and add `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` so rate limiting sees real client IPs.

## Health checks & monitoring

- `GET /api/health` → `{status, database, whatsapp_configured, email_configured, version}`; returns `degraded` if MongoDB is unreachable.
- Application logs go to stdout (structured `logger` lines: request method/path/status/latency, jobs, WhatsApp sends, webhook rejections). Ship them with the Docker logging driver of your choice.
- Restart policy `unless-stopped` covers crashes; the compose health check restarts unhealthy backends.

## Environments

Use separate `.env` files and databases for `development`, `staging` and `production`. Never reuse `JWT_SECRET` or WhatsApp tokens across environments.

## Database migrations

```bash
docker compose -f docker/docker-compose.yml exec backend python -m migrations.run
```

Run before starting the new application version. Migrations are idempotent and recorded in `schema_migrations`.

## Backups

`scripts/backup.sh` performs `mongodump --gzip --archive` into `BACKUP_DIR` with a timestamp and prunes archives older than `RETENTION_DAYS` (default 14). Schedule it with cron:

```
0 2 * * * /opt/app/scripts/backup.sh >> /var/log/physio-backup.log 2>&1
```

Copy archives off-host (e.g. `rclone` to object storage). Verify backups monthly by restoring into a scratch database:

```bash
RESTORE_DB=verify_$(date +%F) scripts/restore.sh /backups/<archive>.gz
docker compose exec mongo mongosh verify_<date> --eval 'db.appointments.countDocuments()'
```

## Recovery

1. Provision a new host, install Docker, clone the repository and restore `.env` files from your secret store.
2. Start `mongo` only: `docker compose up -d mongo`.
3. Restore: `scripts/restore.sh /path/to/archive.gz` (uses `--drop` to replace collections).
4. Start the remaining services and check `/api/health`.
5. Sign in, verify recent appointments and re-point DNS / WhatsApp webhook URL if the domain changed.

## Updating

```bash
git pull
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml exec backend python -m migrations.run
docker compose -f docker/docker-compose.yml up -d
```

## Operator commands

```bash
docker compose exec backend python -m app.cli list-users
docker compose exec backend python -m app.cli reset-password owner@clinic.com 'NewStrongPassword!'
docker compose exec backend python -m app.cli disable-mfa owner@clinic.com
```
