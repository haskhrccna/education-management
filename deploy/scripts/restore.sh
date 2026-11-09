#!/usr/bin/env bash
# Backup restore / drill — runs ON the production VM, against the running
# deploy/docker-compose.prod.yml stack.
#
#   ./deploy/scripts/restore.sh --list              show off-host dumps
#   ./deploy/scripts/restore.sh --scratch           restore newest dump into a
#                                                    scratch DB and count rows
#   ./deploy/scripts/restore.sh --scratch db-20260101-020304.dump
#   ./deploy/scripts/restore.sh --replace           DANGEROUS: restore over the
#                                                    live database (prompts)
#
# ENV_FILE (default deploy/.env) selects the env file; COMPOSE overrides the
# whole compose command (used by the LAN verification run).
#
# Exit codes: 0 ok, 1 usage/env error, 2 restore failed.
set -euo pipefail

cd "$(dirname "$0")/../.."
ENV_FILE="${ENV_FILE:-deploy/.env}"
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE missing"; exit 1; }
COMPOSE="${COMPOSE:-docker compose --env-file $ENV_FILE -f deploy/docker-compose.prod.yml}"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
: "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_PREFIX:=quran-review}"
B="remote/${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/db"

mode="${1:---help}"
[ $# -ge 1 ] && shift || true

# One-off mc in the backup image. The image's entrypoint is the backup loop,
# so it is replaced here, and the off-host alias is configured per call
# (a fresh container has none). -T keeps binary dumps intact through pipes.
# Without a TTY these commands read stdin, so every call that is not fed by
# a pipe is given /dev/null — otherwise it would swallow the caller's input.
mc_exec() {
  # shellcheck disable=SC2016
  $COMPOSE run --rm --no-deps -T --entrypoint sh backup -c '
    scheme=https
    [ "${BACKUP_S3_USE_SSL:-true}" = "true" ] || scheme=http
    mc alias set remote "${scheme}://${BACKUP_S3_ENDPOINT}" \
      "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY" >/dev/null
    exec mc "$@"' sh "$@"
}

newest_dump() {
  mc_exec ls "${B}/daily/" </dev/null | awk '{print $NF}' | grep '^db-.*\.dump$' | sort | tail -1
}

case "$mode" in
  --list)
    echo "Daily dumps (newest last):"
    mc_exec ls "${B}/daily/" </dev/null || true
    echo
    echo "Weekly dumps:"
    mc_exec ls "${B}/weekly/" </dev/null || true
    ;;

  --scratch)
    dump="${1:-}"
    [ -n "$dump" ] || dump="$(newest_dump || true)"
    [ -n "$dump" ] || { echo "no dumps found off-host"; exit 2; }
    scratch="quran_restore_drill"
    echo ">> restoring ${dump} into scratch DB ${scratch}"
    $COMPOSE exec -T postgres dropdb -U "$POSTGRES_USER" --if-exists "$scratch" </dev/null
    $COMPOSE exec -T postgres createdb -U "$POSTGRES_USER" "$scratch" </dev/null
    mc_exec cat "${B}/daily/${dump}" </dev/null | \
      $COMPOSE exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$scratch" --no-owner \
      || { echo "restore failed"; exit 2; }
    echo ">> row counts in the restored scratch DB:"
    for t in users appointments recordings grades audit_logs; do
      count="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$scratch" -tAc \
        "SELECT count(*) FROM \"${t}\"" </dev/null 2>/dev/null || echo '?')"
      echo "   ${t}: ${count}"
    done
    echo ">> drill complete. Inspect with:"
    echo "   $COMPOSE exec postgres psql -U $POSTGRES_USER -d $scratch"
    ;;

  --replace)
    dump="${1:-}"
    [ -n "$dump" ] || dump="$(newest_dump || true)"
    [ -n "$dump" ] || { echo "no dumps found off-host"; exit 2; }
    echo "DANGER: this restores ${dump} OVER the live database ${POSTGRES_DB}."
    printf "Type the database name to proceed: "
    read -r confirm
    [ "$confirm" = "$POSTGRES_DB" ] || { echo "aborted"; exit 1; }

    echo ">> taking a safety dump first…"
    now="$(date -u +%Y%m%d-%H%M%S)"
    if ! $COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc </dev/null | \
         mc_exec pipe "${B}/daily/pre-replace-${now}.dump"; then
      echo "safety dump failed — aborting; the live database was not touched"
      exit 2
    fi

    # The API holds connections to the database, and dropdb refuses while
    # any are open.
    echo ">> stopping the API, then dropping + restoring…"
    $COMPOSE stop api
    $COMPOSE exec -T postgres dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" </dev/null
    $COMPOSE exec -T postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB" </dev/null
    mc_exec cat "${B}/daily/${dump}" </dev/null | \
      $COMPOSE exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner \
      || { echo "restore failed — the safety dump is pre-replace-${now}.dump"; exit 2; }
    echo ">> starting the API (migrations re-apply)…"
    $COMPOSE start api
    echo ">> done. Verify the app before walking away."
    ;;

  *)
    sed -n '2,15p' "$0"
    exit 1
    ;;
esac
