#!/bin/sh
# Nightly: pg_dump the production database and mirror the MinIO media bucket
# to an OFF-HOST S3-compatible target. Same-VM copies do not count as
# backups — the whole point is surviving the loss of this VM.
#
# Layout in the backup bucket (under BACKUP_S3_PREFIX):
#   db/daily/db-<UTC timestamp>.dump      retained RETAIN_DAILY days
#   db/weekly/weekly-<ISO year>-W<ww>.dump retained RETAIN_WEEKLY newest
#   minio-mirror/…                        incremental mirror of the media bucket
#
# Env (set by deploy/docker-compose.prod.yml):
#   POSTGRES_HOST/PORT/USER/PASSWORD/DB   where to dump from
#   STORAGE_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET   local MinIO
#   BACKUP_S3_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/PREFIX/USE_SSL   off-host
#   BACKUP_INTERVAL_SECONDS, BACKUP_RUN_ON_START, RETAIN_DAILY, RETAIN_WEEKLY
set -eu

: "${POSTGRES_HOST:?}" "${POSTGRES_PORT:?}" "${POSTGRES_USER:?}" \
   "${POSTGRES_PASSWORD:?}" "${POSTGRES_DB:?}" \
   "${STORAGE_ENDPOINT:?}" "${STORAGE_ACCESS_KEY:?}" "${STORAGE_SECRET_KEY:?}" \
   "${STORAGE_BUCKET:?}" \
   "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_ACCESS_KEY:?}" \
   "${BACKUP_S3_SECRET_KEY:?}" "${BACKUP_S3_BUCKET:?}"

PREFIX="${BACKUP_S3_PREFIX:-quran-review}"
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
RETAIN_DAILY="${RETAIN_DAILY:-7}"
RETAIN_WEEKLY="${RETAIN_WEEKLY:-4}"
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "[backup] configuring S3 aliases"
mc alias set local "http://${STORAGE_ENDPOINT}" "$STORAGE_ACCESS_KEY" "$STORAGE_SECRET_KEY"
if [ "${BACKUP_S3_USE_SSL:-true}" = "true" ]; then
  mc alias set remote "https://${BACKUP_S3_ENDPOINT}" "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY"
else
  mc alias set remote "http://${BACKUP_S3_ENDPOINT}" "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY"
fi
mc mb --ignore-existing "remote/${BACKUP_S3_BUCKET}"
mkdir -p /scratch

run_backup() {
  ts="$(date -u +%Y%m%d-%H%M%S)"
  dump="db-${ts}.dump"
  echo "[backup] $(date -u +%FT%TZ) pg_dump -> ${dump}"
  pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" -Fc -f "/scratch/${dump}"

  mc cp "/scratch/${dump}" "remote/${BACKUP_S3_BUCKET}/${PREFIX}/db/daily/${dump}"
  rm -f "/scratch/${dump}"

  # Weekly snapshot on Sundays (ISO), named by ISO week — the retention pass
  # keeps the newest RETAIN_WEEKLY of them.
  if [ "$(date -u +%u)" = "7" ]; then
    iso_year="$(date -u +%G)"
    iso_week="$(date -u +%V)"
    mc cp "remote/${BACKUP_S3_BUCKET}/${PREFIX}/db/daily/${dump}" \
      "remote/${BACKUP_S3_BUCKET}/${PREFIX}/db/weekly/weekly-${iso_year}-W${iso_week}.dump"
  fi

  echo "[backup] mirroring media bucket ${STORAGE_BUCKET}"
  mc mirror --overwrite "local/${STORAGE_BUCKET}" \
    "remote/${BACKUP_S3_BUCKET}/${PREFIX}/minio-mirror" || \
    echo "[backup] WARNING: media mirror incomplete (bucket may not exist yet)"

  echo "[backup] applying retention (daily > ${RETAIN_DAILY}d, weekly newest ${RETAIN_WEEKLY})"
  mc rm --recursive --force --older-than "${RETAIN_DAILY}d" \
    "remote/${BACKUP_S3_BUCKET}/${PREFIX}/db/daily/" || true
  # Weekly: keep the newest RETAIN_WEEKLY by name (names sort chronologically).
  mc ls "remote/${BACKUP_S3_BUCKET}/${PREFIX}/db/weekly/" | awk '{print $NF}' | sort -r | \
    tail -n +$((RETAIN_WEEKLY + 1)) | while IFS= read -r old; do
      [ -n "$old" ] && mc rm -f "remote/${BACKUP_S3_BUCKET}/${PREFIX}/db/weekly/${old}" || true
    done
  echo "[backup] done $(date -u +%FT%TZ)"
}

# First run (or wait for the interval) so a fresh deploy is protected immediately.
if [ "${BACKUP_RUN_ON_START:-true}" = "true" ]; then
  sleep 30   # let the API finish its first boot + first writes settle
  run_backup || echo "[backup] ERROR: first run failed — will retry next interval"
else
  echo "[backup] BACKUP_RUN_ON_START=false; first backup in ${INTERVAL}s"
fi

while true; do
  sleep "$INTERVAL"
  run_backup || echo "[backup] ERROR: run failed — will retry next interval"
done
