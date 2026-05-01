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

# FCM (optional, for push notifications)
FCM_SERVICE_ACCOUNT_KEY=base64-encoded-service-account-json

# Workers
ENABLE_WORKERS=true
```

### 2. Database Migration

```bash
cd packages/server
npx prisma migrate deploy
npx prisma db seed
```

### 3. Docker Deployment

```bash
cd packages/server
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

Update `mobile/src/api/client.ts` with production API URL.
