#!/usr/bin/env bash
# Backs up the two things Docker volumes hold that nothing can regenerate:
# Postgres (pgdata) and uploaded media. Run from the repo root on the host
# running docker compose (e.g. via cron: 0 3 * * * cd /path/to/dronasphere &&
# ./scripts/backup.sh >> /var/log/dronasphere-backup.log 2>&1).
#
# Restores with scripts/restore.sh.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

[ -f .env ] && set -a && source .env && set +a

POSTGRES_USER="${POSTGRES_USER:-drona}"
POSTGRES_DB="${POSTGRES_DB:-dronasphere}"
COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-dronasphere}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"

OUT_DIR="backups"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUT_DIR"

echo "[backup] $STAMP: dumping postgres ($POSTGRES_DB)..."
docker exec drona-postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c \
  > "$OUT_DIR/postgres-$STAMP.dump"

echo "[backup] $STAMP: archiving media volume..."
docker run --rm \
  -v "${COMPOSE_PROJECT}_media:/data:ro" \
  -v "$(pwd)/$OUT_DIR:/backup" \
  alpine sh -c "tar czf /backup/media-$STAMP.tar.gz -C /data ."

echo "[backup] $STAMP: done -> $OUT_DIR/postgres-$STAMP.dump, $OUT_DIR/media-$STAMP.tar.gz"

if [ "$RETAIN_DAYS" -gt 0 ]; then
  find "$OUT_DIR" -maxdepth 1 -type f \( -name 'postgres-*.dump' -o -name 'media-*.tar.gz' \) \
    -mtime "+$RETAIN_DAYS" -print -delete
fi
