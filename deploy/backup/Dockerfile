# Backup runner: pg_dump + MinIO bucket mirror, pushed to an OFF-HOST
# S3-compatible target. Built from this directory on first
# `docker compose -f deploy/docker-compose.prod.yml up -d` (only the API
# image is pulled prebuilt).
#
# postgres:17-alpine supplies pg_dump with the exact server major version;
# `mc` (MinIO client) talks to both the local MinIO and any S3 endpoint
# (B2, R2, AWS, …) and is a static binary for both amd64 and arm64.
FROM postgres:17-alpine

ARG MC_VERSION=RELEASE.2026-07-30T00-36-42Z

RUN apk add --no-cache curl \
  && arch="$(apk --print-arch)" \
  && curl -fsSL "https://dl.min.io/client/mc/release/linux-${arch}/mc" \
       -o /usr/local/bin/mc \
  && chmod +x /usr/local/bin/mc \
  && mc --version

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

ENTRYPOINT ["/usr/local/bin/backup.sh"]
