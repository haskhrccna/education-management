#!/usr/bin/env bash
# Preflight check for deploy/.env — refuses the well-known defaults, weak
# secrets and missing required variables BEFORE `docker compose up` turns a
# misconfiguration into a production outage (or a public database).
#
#   ./deploy/scripts/check-env.sh deploy/.env
set -euo pipefail

ENV_FILE="${1:-deploy/.env}"
[ -f "$ENV_FILE" ] || { echo "no such file: $ENV_FILE"; exit 1; }

fail=0
err() { echo "  ✗ $1"; fail=1; }
ok()  { echo "  ✓ $1"; }

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

echo "== deploy/.env preflight =="

# Required and non-empty
for var in DOMAIN PUBLIC_API_URL CLIENT_URL JWT_SECRET POSTGRES_PASSWORD \
           REDIS_PASSWORD STORAGE_ACCESS_KEY STORAGE_SECRET_KEY EMAIL_HOST \
           EMAIL_USER EMAIL_PASS EMAIL_FROM \
           BACKUP_S3_ENDPOINT BACKUP_S3_ACCESS_KEY BACKUP_S3_SECRET_KEY BACKUP_S3_BUCKET; do
  val="${!var:-}"
  [ -n "$val" ] || err "$var is empty"
done
[ "$fail" = 0 ] && ok "required variables present"

# Default/demo values that must never reach production
for var in JWT_SECRET POSTGRES_PASSWORD REDIS_PASSWORD STORAGE_ACCESS_KEY \
           STORAGE_SECRET_KEY EMAIL_PASS BACKUP_S3_ACCESS_KEY BACKUP_S3_SECRET_KEY; do
  val="${!var:-}"
  case "$val" in
    ""|"CHANGE_ME"*|*minioadmin*|changeme*|password|postgres|secret)
      err "$var still uses a default/demo value" ;;
  esac
done
[ "$fail" = 0 ] && ok "no default/demo credentials"

# JWT strength
[ "${JWT_SECRET:-}" -lt 32 ] 2>/dev/null && err "JWT_SECRET under 32 chars" || true
[ "${#JWT_SECRET}" -ge 32 ] 2>/dev/null && ok "JWT_SECRET length ≥ 32" || err "JWT_SECRET under 32 chars"

# Public URL consistency
case "$PUBLIC_API_URL" in
  https://api.*) ok "PUBLIC_API_URL https://api.*" ;;
  *) err "PUBLIC_API_URL should be https://api.<DOMAIN>" ;;
esac
case "$PUBLIC_API_URL" in
  *"$DOMAIN"*) ok "PUBLIC_API_URL matches DOMAIN" ;;
  *) err "PUBLIC_API_URL does not contain DOMAIN ($DOMAIN)" ;;
esac

# Off-host backup sanity
case "$BACKUP_S3_ENDPOINT" in
  ""|minio*) err "BACKUP_S3_ENDPOINT must be OFF this VM (not the local minio)" ;;
  *) ok "off-host backup target set" ;;
esac

echo
if [ "$fail" = 0 ]; then
  echo "PASS — ready for: docker compose -f deploy/docker-compose.prod.yml up -d"
else
  echo "FAIL — fix the above, then re-run."
fi
exit "$fail"
