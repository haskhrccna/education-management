#!/usr/bin/env bash
# Proves the migration ledger builds the FULL schema from an empty database
# and matches schema.prisma exactly. Uses a throwaway postgres container.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${VERIFY_PG_PORT:-5440}"
NAME=migrate-verify-$$
docker run --rm -d --name "$NAME" -e POSTGRES_PASSWORD=verify -p "$PORT":5432 \
  --health-cmd 'pg_isready -U postgres' --health-interval 1s postgres:17-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$NAME")" = healthy ] && break
  if [ "$i" = 60 ]; then echo "postgres never became healthy"; exit 1; fi
  sleep 1
done
export DATABASE_URL="postgresql://postgres:verify@localhost:$PORT/verify?schema=public"
npx prisma migrate deploy
# Ledger <-> schema.prisma parity: exits 2 on drift.
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --exit-code
echo "✅ migrations build the full schema from empty and match schema.prisma"
