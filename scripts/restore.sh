#!/usr/bin/env bash
# Restores a backup made by scripts/backup.sh. Destructive: overwrites the
# running database and media store. Confirms before touching either.
#
#   ./scripts/restore.sh backups/postgres-20260915T030000Z.dump \
#                         backups/media-20260915T030000Z.tar.gz
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

PG_DUMP="${1:?usage: restore.sh <postgres-dump> [media-tar.gz]}"
MEDIA_TAR="${2:-}"

[ -f .env ] && set -a && source .env && set +a
POSTGRES_USER="${POSTGRES_USER:-drona}"
POSTGRES_DB="${POSTGRES_DB:-dronasphere}"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-dronasphere}"

echo "This will REPLACE the contents of database '$POSTGRES_DB' on drona-postgres"
[ -n "$MEDIA_TAR" ] && echo "and the entire media volume (${COMPOSE_PROJECT}_media)."
read -r -p "Type 'restore' to continue: " confirm
[ "$confirm" = "restore" ] || { echo "aborted"; exit 1; }

echo "[restore] restoring postgres from $PG_DUMP ..."
docker exec -i drona-postgres pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists --no-owner < "$PG_DUMP"

if [ -n "$MEDIA_TAR" ]; then
  echo "[restore] restoring media from $MEDIA_TAR ..."
  docker run --rm \
    -v "${COMPOSE_PROJECT}_media:/data" \
    -v "$(pwd)/$(dirname "$MEDIA_TAR"):/backup" \
    alpine sh -c "rm -rf /data/* && tar xzf /backup/$(basename "$MEDIA_TAR") -C /data"
fi

echo "[restore] done."
