#!/bin/sh
# Container startup: apply migrations, then hand the process over to the API.
#
# This lives in a script rather than in a platform's "start command" field,
# because a multi-command shell line (`a && b`) is not portable across those
# fields — Render passed the whole string to `sh` as one command name and the
# container died with `not found` / status 127 on every deploy.
set -e

echo "==> Applying database migrations (prisma migrate deploy)"
# Applies committed migrations only. It never generates, resets or drops
# anything, so it is safe to run on every boot, including multi-instance
# rollouts (the advisory lock in the migration engine serializes them).
#
# With a pooled DATABASE_URL (Neon's "-pooler" host, PgBouncer), migrations
# must go over a direct connection instead: the pooler hands out a different
# backend per transaction, which breaks the engine's advisory lock. Set
# DIRECT_URL to the non-pooled string for that; unset, DATABASE_URL is used.
DATABASE_URL="${DIRECT_URL:-$DATABASE_URL}" npx prisma migrate deploy

echo "==> Starting the API"
# exec: the server becomes PID 1 so the platform's SIGTERM reaches it and the
# graceful shutdown in src/server.ts actually runs.
exec node dist/server.js
