#!/usr/bin/env bash
# Restore a backup archive. Usage: MONGO_URL=... DB_NAME=... [RESTORE_DB=other_db] ./restore.sh /backups/file.archive.gz
set -euo pipefail
: "${MONGO_URL:?MONGO_URL is required}"
: "${DB_NAME:?DB_NAME is required}"
ARCHIVE="${1:?path to archive required}"
TARGET="${RESTORE_DB:-$DB_NAME}"
gzip -t "$ARCHIVE"
mongorestore --uri="$MONGO_URL" --gzip --archive="$ARCHIVE" --nsFrom="${DB_NAME}.*" --nsTo="${TARGET}.*" --drop
echo "restore ok: $ARCHIVE -> $TARGET"
