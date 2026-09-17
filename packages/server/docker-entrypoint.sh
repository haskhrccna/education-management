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
npx prisma migrate deploy

echo "==> Starting the API"
# exec: the server becomes PID 1 so the platform's SIGTERM reaches it and the
# graceful shutdown in src/server.ts actually runs.
exec node dist/server.js
