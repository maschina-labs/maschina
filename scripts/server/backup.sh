#!/usr/bin/env bash
# One nightly backup of the record: dumped, compressed, encrypted, and copied off the server.
#
# The record is the only thing here that cannot be rebuilt, so it is the only thing backed up. The dump
# is encrypted on the server with a public key, which means the server itself cannot read its own
# backups, and the key that can is not on it.
set -euo pipefail

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DIR="${BACKUP_DIR:-/opt/maschina/backups}"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT="$DIR/maschina-$STAMP.sql.gz.age"

: "${BACKUP_PUBLIC_KEY:?the age public key to encrypt to is required}"

mkdir -p "$DIR"
docker exec maschina-postgres pg_dump -U maschina_owner -d maschina --no-owner \
  | gzip -9 \
  | age --recipient "$BACKUP_PUBLIC_KEY" --output "$OUT"

# A dump that is suspiciously small means the database was empty or the dump failed halfway.
size=$(wc -c <"$OUT")
if [ "$size" -lt 1000 ]; then
  echo "the backup is only $size bytes, which is not a real database" >&2
  exit 1
fi

if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "$OUT" "$BACKUP_REMOTE" --quiet
fi

find "$DIR" -name 'maschina-*.sql.gz.age' -mtime "+$KEEP_DAYS" -delete
echo "backed up $OUT ($size bytes)"
