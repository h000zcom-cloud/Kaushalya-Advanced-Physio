#!/usr/bin/env bash
# Nightly MongoDB backup with retention. Usage: MONGO_URL=... DB_NAME=... BACKUP_DIR=/backups RETENTION_DAYS=14 ./backup.sh
set -euo pipefail
: "${MONGO_URL:?MONGO_URL is required}"
: "${DB_NAME:?DB_NAME is required}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE="$BACKUP_DIR/${DB_NAME}_${STAMP}.archive.gz"
mongodump --uri="$MONGO_URL" --db="$DB_NAME" --gzip --archive="$ARCHIVE"
gzip -t "$ARCHIVE"
find "$BACKUP_DIR" -name "${DB_NAME}_*.archive.gz" -mtime +"$RETENTION_DAYS" -delete
echo "backup ok: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
