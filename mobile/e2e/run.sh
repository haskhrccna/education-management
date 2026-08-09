#!/usr/bin/env bash
# E2E runner: reset E2E DB → seed → verify server is on the E2E DB → maestro test.
set -euo pipefail

E2E_DB_URL="postgresql://postgres:postgres@localhost:5433/quran_review_test"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/../../packages/server"
# the optional argument is relative to mobile/e2e/ (e.g. "flows/auth"); default: all flows
FLOWS="$SCRIPT_DIR/${1:-flows}"

echo "==> [1/4] E2E database up + reset"
(cd "$SERVER_DIR" && docker compose -f docker-compose.test.yml up -d --wait)
# terminate lingering connections so migrate reset cannot fail on an open pool
(cd "$SERVER_DIR" && docker compose -f docker-compose.test.yml exec -T db-test \
  psql -U postgres -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='quran_review_test' AND pid <> pg_backend_pid();" >/dev/null)
(cd "$SERVER_DIR" && DATABASE_URL="$E2E_DB_URL" npx prisma migrate reset --force --skip-seed)

echo "==> [2/4] E2E seed"
(cd "$SERVER_DIR" && DATABASE_URL="$E2E_DB_URL" npx ts-node src/prisma/seed-e2e.ts)

echo "==> [3/4] Server checks"
if ! curl -fsS http://localhost:4000/api/health >/dev/null 2>&1; then
  echo "ERROR: server not running on :4000."
  echo "Start it with:  cd packages/server && DATABASE_URL=\"$E2E_DB_URL\" npm run dev"
  exit 1
fi
# parent@ exists ONLY in the E2E seed → proves the server is on the E2E DB, not dev.
LOGIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"parent@quran-review.com","password":"'"${SEED_PARENT_PASSWORD:-Parent1234!}"'"}')
if [ "$LOGIN_STATUS" != "200" ]; then
  echo "ERROR: server on :4000 is NOT connected to the E2E database (parent login returned $LOGIN_STATUS)."
  echo "Restart it with:  cd packages/server && DATABASE_URL=\"$E2E_DB_URL\" npm run dev"
  exit 1
fi

node "$SCRIPT_DIR/../scripts/check-testids.js"

if [ -z "${1:-}" ]; then
  # Default (whole-suite) run: read-only smoke flows first, then data-mutating
  # journeys, per the spec's ordering requirement — journeys create real
  # appointments/grades/users that could otherwise land before a smoke flow's
  # own assertions run against the same seeded rows.
  echo "==> [4/4] check-testids + maestro test (auth, then student, then journeys)"
  maestro test "$SCRIPT_DIR/flows/auth"
  maestro test "$SCRIPT_DIR/flows/student"
  maestro test "$SCRIPT_DIR/flows/journeys"
else
  echo "==> [4/4] check-testids + maestro test $FLOWS"
  maestro test "$FLOWS"
fi
