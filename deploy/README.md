# Production deployment (Docker)

One command on a fresh Linux VM brings up: API + PostgreSQL 17 + Redis 7 +
MinIO + Caddy (automatic HTTPS) + nightly off-host backups.

```bash
# 0) on the VM: Docker (+ compose plugin) and nothing else
curl -fsSL https://get.docker.com | sh

# 1) get the repo (the API image is PULLED from GHCR — the VM never builds it)
git clone https://github.com/haskhrccna/education-management.git && cd education-management

# 2) configure
cp deploy/.env.example deploy/.env
$EDITOR deploy/.env                      # set EVERY value
./deploy/scripts/check-env.sh deploy/.env   # refuses defaults — must print PASS

# 3) DNS + firewall (before first start; see "Prerequisites")
#    A record api.<DOMAIN> -> this VM's public IP; open TCP 80 + 443 only.

# 4) mushaf pages (the 604 page images are not in git — see §Mushaf below)

# 5) go
docker compose -f deploy/docker-compose.prod.yml up -d
curl https://api.<your-domain>/api/health   # {"status":"ok",...}
```

## Prerequisites (all yours, none automatable from this repo)

| What | Detail |
|---|---|
| Domain | `api.<DOMAIN>` A record → VM public IP **before** the first `up` (Caddy issues the certificate at boot). Open **only 80/443** in the cloud firewall. |
| GHCR access | The image is public (`ghcr.io/haskhrccna/education-management-api`). Pull needs no login. |
| Off-host backup bucket | Backblaze B2 / Cloudflare R2 / any S3 endpoint. MinIO on the same VM is **not** a backup — the backup service refuses to be pointed at the local MinIO (check-env.sh). |
| SMTP | Real credentials — password reset and admin-approval emails depend on them; the API refuses to boot in production without `EMAIL_HOST`. |

## What runs where

- **Only Caddy publishes ports** (80/443). Postgres, Redis, MinIO and the API
  are on an internal Docker network — unreachable from the LAN or internet.
- **API**: applies `prisma migrate deploy` on every boot (entrypoint), then
  listens on `:4000` behind Caddy. BullMQ workers run in-process
  (`ENABLE_WORKERS=true`).
- **Caddy**: `api.<DOMAIN>` → api:4000 (WebSockets for Socket.io work
  out of the box), 110 MB body limit (the app caps recordings at 100 MB),
  `/metrics` is answered with 404 — the Prometheus endpoint is unauthenticated
  by design and must never be public. Optional `media.<DOMAIN>` host is
  commented in the Caddyfile for public share previews.
- **Redis**: `requirepass` + AOF. **MinIO**: your credentials from `.env`
  (`minioadmin` is refused at API boot AND by check-env.sh).
- **Backup**: nightly `pg_dump -Fc` + incremental MinIO bucket mirror to
  `BACKUP_S3_*`, retention 7 daily / 4 weekly (configurable).

## Mushaf pages

`src/server.ts` refuses to start in production without the complete set of
604 images (or `ALLOW_MISSING_MUSHAF_PAGES=1`, which the `.env.example`
defaults to so a fresh VM boots — remove it once pages are loaded).

Populate the `mushaf_pages` volume from any host that has the images
(`scripts/extract_mushaf_pages.py` builds them from a source mushaf PDF):

```bash
tar -C mushaf-pages -cf - . | \
  docker compose -f deploy/docker-compose.prod.yml exec -T api \
  sh -c 'tar -C /app/mushaf-pages -xf - && chmod -R a+r /app/mushaf-pages'
```

Then remove `ALLOW_MISSING_MUSHAF_PAGES` from `deploy/.env` and
`docker compose -f deploy/docker-compose.prod.yml up -d` again — a boot that
silently lacks the reader is a bug, not a configuration.

## Day-2 operations

```bash
# upgrade to what CI last published
docker compose -f deploy/docker-compose.prod.yml pull
docker compose -f deploy/docker-compose.prod.yml up -d     # migrate + restart

# rollback to a known-good image
API_IMAGE_TAG=sha-<commit> docker compose -f deploy/docker-compose.prod.yml up -d

# logs / status
docker compose -f deploy/docker-compose.prod.yml logs -f api
docker compose -f deploy/docker-compose.prod.yml ps

# restore drill (quarterly — do it before you need it)
./deploy/scripts/restore.sh --list
./deploy/scripts/restore.sh --scratch          # into a scratch DB, row counts
```

## Sizing

Limits in `deploy/docker-compose.prod.yml` target a 1–4 vCPU / ~6 GB VM
(api 512 MB, postgres 1536 MB, redis/minio 512 MB, caddy/backup 256 MB).
Raise them for bigger academies; do not go lower without measuring.

## Local verification (no public DNS)

```bash
CADDY_FILE=Caddyfile.local DOMAIN=api.localhost \
  docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env up -d
curl --resolve api.localhost:443:127.0.0.1 https://api.localhost/api/health
```

`Caddyfile.local` uses Caddy's internal CA (add `--insecure` or trust the
local root cert). Everything else — auth, uploads, Socket.io — runs the
same as production.
