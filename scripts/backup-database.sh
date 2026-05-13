#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR=${BACKUP_DIR:-/data/backups/daily-notes-app}
RETENTION_DAYS=${RETENTION_DAYS:-14}
mkdir -p "$BACKUP_DIR"
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/daily-notes-$STAMP.sql.gz"
pg_dump "$DATABASE_URL" | gzip -9 > "$OUT"
find "$BACKUP_DIR" -type f -name 'daily-notes-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
printf 'backup written: %s\n' "$OUT"
