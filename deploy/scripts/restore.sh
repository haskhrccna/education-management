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
# Exit codes: 0 ok, 1 usage/env error, 2 restore failed.
set -euo pipefail

cd "$(dirname "$0")/../.."
COMPOSE="docker compose -f deploy/docker-compose.prod.yml"
[ -f deploy/.env ] || { echo "deploy/.env missing"; exit 1; }

# shellcheck disable=SC1091
set -a; source deploy/.env; set +a
: "${BACKUP_S3_BUCKET:?}" "${BACKUP_S3_PREFIX:=quran-review}"
B="remote/${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/db"

mode="${1:---help}"
[ $# -ge 1 ] && shift || true

mc_exec() { $COMPOSE run --rm --no-deps backup mc "$@"; }

case "$mode" in
  --list)
    echo "Daily dumps (newest last):"
    mc_exec ls "${B}/daily/" || true
    echo
    echo "Weekly dumps:"
    mc_exec ls "${B}/weekly/" || true
    ;;

  --scratch)
    dump="${1:-}"
    if [ -z "$dump" ]; then
      dump="$(mc_exec ls "${B}/daily/" | awk '{print $NF}' | sort | tail -1)"
      [ -n "$dump" ] || { echo "no dumps found off-host"; exit 2; }
    fi
    scratch="quran_restore_drill"
    echo ">> restoring ${dump} into scratch DB ${scratch}"
    $COMPOSE exec -T postgres dropdb -U "$POSTGRES_USER" --if-exists "$scratch" || true
    $COMPOSE exec -T postgres createdb -U "$POSTGRES_USER" "$scratch"
    mc_exec cat "${B}/daily/${dump}" | \
      $COMPOSE exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$scratch" --no-owner
    echo ">> row counts in the restored scratch DB:"
    for t in User Academy Student Appointment Recording; do
      count="$($COMPOSE exec -T postgres psql -U "$POSTGRES_USER" -d "$scratch" -tAc \
        "SELECT count(*) FROM \"${t}\"" 2>/dev/null || echo '?')"
      echo "   ${t}: ${count}"
    done
    echo ">> drill complete. Inspect with:"
    echo "   $COMPOSE exec postgres psql -U $POSTGRES_USER -d $scratch"
    ;;

  --replace)
    dump="${1:-}"
    [ -n "$dump" ] || dump="$(mc_exec ls "${B}/daily/" | awk '{print $NF}' | sort | tail -1)"
    echo "DANGER: this restores ${dump} OVER the live database ${POSTGRES_DB}."
    printf "Type the database name to proceed: "
    read -r confirm
    [ "$confirm" = "$POSTGRES_DB" ] || { echo "aborted"; exit 1; }
    echo ">> taking a safety dump first…"
    now="$(date -u +%Y%m%d-%H%M%S)"
    $COMPOSE exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc | \
      $COMPOSE run --rm --no-deps -T backup sh -c \
        "mc cp - \"remote/${BACKUP_S3_BUCKET}/${BACKUP_S3_PREFIX}/db/daily/pre-replace-${now}.dump\"" \
        2>/dev/null || echo "   (warning: safety dump failed — continuing was NOT confirmed; abort)" && [ -t 0 ] || true
    echo ">> dropping + restoring…"
    $COMPOSE exec -T postgres dropdb -U "$POSTGRES_USER" "$POSTGRES_DB"
    $COMPOSE exec -T postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
    mc_exec cat "${B}/daily/${dump}" | \
      $COMPOSE exec -T postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner
    echo ">> restarting API (migrations re-apply)…"
    $COMPOSE restart api
    echo ">> done. Verify the app before walking away."
    ;;

  *)
    sed -n '2,12p' "$0"
    exit 1
    ;;
esac
