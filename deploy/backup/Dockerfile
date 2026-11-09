# Backup runner: pg_dump + MinIO bucket mirror, pushed to an OFF-HOST
# S3-compatible target. Built from this directory on first
# `docker compose -f deploy/docker-compose.prod.yml up -d` (only the API
# image is pulled prebuilt).
#
# postgres:17-alpine supplies pg_dump with the exact server major version;
# `mc` (MinIO client) talks to both the local MinIO and any S3 endpoint
# (B2, R2, AWS, …) and is a static binary for both amd64 and arm64.
FROM postgres:17-alpine

# dl.min.io stopped serving binaries (HTTP 410), so the pinned release comes
# from GitHub and is checked against the checksums published beside it.
ARG MC_VERSION=RELEASE.2025-08-13T08-35-41Z
ARG MC_SHA256_ARM64=14c8c9616cfce4636add161304353244e8de383b2e2752c0e9dad01d4c27c12c
ARG MC_SHA256_AMD64=01f866e9c5f9b87c2b09116fa5d7c06695b106242d829a8bb32990c00312e891

RUN apk add --no-cache curl \
  && case "$(apk --print-arch)" in \
       aarch64) arch=arm64; sum="$MC_SHA256_ARM64" ;; \
       x86_64)  arch=amd64; sum="$MC_SHA256_AMD64" ;; \
       *) echo "unsupported architecture: $(apk --print-arch)" >&2; exit 1 ;; \
     esac \
  && curl -fsSL "https://github.com/minio/mc/releases/download/${MC_VERSION}/mc.linux-${arch}.${MC_VERSION}" \
       -o /usr/local/bin/mc \
  && echo "${sum}  /usr/local/bin/mc" | sha256sum -c - \
  && chmod +x /usr/local/bin/mc \
  && mc --version

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

ENTRYPOINT ["/usr/local/bin/backup.sh"]
