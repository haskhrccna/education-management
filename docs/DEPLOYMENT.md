# Deployment Guide

## Production Deployment Checklist

### 1. Environment Setup

Create a `.env` file in `packages/server/` with production values:

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:pass@db-host:5432/education?schema=public
JWT_SECRET=your-256-bit-secret-here-min-32-chars
JWT_EXPIRES_IN=7d

# Redis (required for queues and caching)
REDIS_URL=redis://redis-host:6379

# Email (required for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@your-domain.com

# Firebase Cloud Messaging (optional, for push notifications)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Public API URL (required in production for public verify/share images)
PUBLIC_API_URL=https://api.your-domain.com

# Shared media layer (S3-compatible — MinIO locally, any S3 provider in prod).
# One bucket serves BOTH the web app and the mobile app.
STORAGE_ENABLED=1
STORAGE_ENDPOINT=https://minio.your-domain.com
STORAGE_ACCESS_KEY=your-access-key
STORAGE_SECRET_KEY=your-secret-key
STORAGE_BUCKET=quran-review-media
STORAGE_PUBLIC_BASE_URL=https://media.your-domain.com

# Workers
ENABLE_WORKERS=true
```

### 2. Database Migration

```bash
cd packages/server
npx prisma migrate deploy
```

Only run `npx prisma db seed` intentionally for a new/demo environment. Do not
seed production after real users exist.

### 3. Docker Deployment

```bash
cd packages/server
npx prisma migrate deploy
docker-compose -f docker-compose.yml up -d
```

Services:

- API: port 4000
- PostgreSQL: port 5432
- Redis: port 6379

### 4. Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name api.your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 5. Health Monitoring

- Health endpoint: `GET /api/health`
- Prometheus metrics: `GET /metrics`
- Swagger docs: `GET /api/docs`

### 6. SSL/TLS

Enable HSTS is already configured in Helmet. Ensure:

- SSL certificate is valid
- HTTPS redirects are in place
- `CLIENT_URL` env var matches your frontend domain

### 7. Backup Strategy

```bash
# Database backup
docker exec education_db pg_dump -U postgres education > backup_$(date +%Y%m%d).sql

# Uploads backup
tar -czf uploads_$(date +%Y%m%d).tar.gz uploads/
```

**Managed/automated variant (recommended for production).** The daily
`pg_dump` above is a starting point, not a strategy. A production deployment
should additionally:

1. Run `pg_dump` on a schedule (cron / systemd timer / CI nightly job) and
   push the artifact to off-host storage (S3-compatible bucket, the same
   MinIO/S3 setup as the media layer — never keep backups only on the DB VM).
2. If the database is a managed service (RDS, Neon, Supabase, DigitalOcean
   PG), rely on its point-in-time recovery AND keep one logical `pg_dump`
   per day for portability.
3. Test a restore at least once a quarter: restore the latest dump into a
   throwaway Postgres, run `npx prisma migrate deploy` + the schema-parity
   check (`packages/server/scripts/verify-migrations.sh`) and a smoke login.
4. Media files: enable bucket versioning on `STORAGE_BUCKET` so a bad
   overwrite/delete is recoverable independently of the database. Recordings
   are the primary student data — they deserve the same backup discipline as
   the DB.
5. Keep `JWT_SECRET` and `STORAGE_SECRET_KEY` in a secrets manager or
   encrypted backup; restoring the database without them is a half-restore.

### 7b. Prometheus metrics scraping

`GET /metrics` exposes Prometheus-format metrics. Add a scrape job for the API
host (port 4000, path `/metrics`) to your Prometheus instance:

```yaml
scrape_configs:
  - job_name: quran-review-api
    metrics_path: /metrics
    static_configs:
      - targets: ["api.your-domain.com:4000"]
```

Recommended alert rules (see section 9): error rate > 1%, queue backlog
> 100, p95 latency > 1s. The metrics endpoint requires no auth by design —
do NOT expose port 4000 publicly beyond the reverse proxy; scrape over the
private network.

### 8. Scaling

- **Horizontal**: Run multiple API containers behind a load balancer
- **Redis**: Use Redis Sentinel or Cluster for HA
- **Database**: Use PostgreSQL read replicas for read-heavy workloads
- **Workers**: Run separate worker processes with `ENABLE_WORKERS=true`

### 9. Monitoring

Set up alerts for:

- High error rates (> 1%)
- Slow queries (> 500ms)
- High memory usage (> 80%)
- Queue backlog (> 100 jobs)
- Database connection pool exhaustion

### 10. Mobile App Build

```bash
cd mobile
eas build --platform ios     # or android
```

Set `EXPO_PUBLIC_API_URL=https://api.your-domain.com/api/v1` for production
builds. Do not hardcode the production API URL in `mobile/src/api/client.ts`.

### 11. Database migrations

Fresh environments are built **from the migration ledger only** — never `db push`:

```bash
cd packages/server
npx prisma migrate deploy
```

Prove the ledger builds the full schema from an empty database (throwaway
Docker Postgres + schema-parity diff):

```bash
packages/server/scripts/verify-migrations.sh
```

The integration suite's globalSetup also runs `migrate deploy`, so every test
run regression-checks the ledger.

### 12. Mushaf page images

The Quran reader serves the 604 scanned Madani pages (KFGQPC) as static WebPs.
They are **not in git** (~51 MB). Populate them on every host:

```bash
pip install pymupdf pillow
python3 packages/server/scripts/extract_mushaf_pages.py /path/to/standard2-quran.pdf
```

(or restore an archived copy of `packages/server/mushaf-pages/` from object storage).

Env vars:

- `MUSHAF_PAGES_DIR` — override the directory (default `packages/server/mushaf-pages`)
- `ALLOW_MISSING_MUSHAF_PAGES=1` — let a production server start with an
  incomplete set (otherwise it refuses to boot, by design — the app must never
  404 the Quran)
