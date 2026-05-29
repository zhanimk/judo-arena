#!/usr/bin/env bash
# Judo-Arena — PostgreSQL restore script
#
# Usage:
#   ./scripts/restore.sh ./backups/backup_20260525_020000.sql.gz
#
# ⚠️  This will DROP and recreate the public schema.
#    Make sure to run against the correct database.

set -euo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi
if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Error: file not found — ${BACKUP_FILE}"
  exit 1
fi

# Load .env if present
if [[ -f "$(dirname "$0")/../.env" ]]; then
  set -o allexport
  # shellcheck source=/dev/null
  source "$(dirname "$0")/../.env"
  set +o allexport
fi

: "${DATABASE_URL:?DATABASE_URL is required}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DATABASE : ${DATABASE_URL%%\?*}"
echo "  FILE     : ${BACKUP_FILE}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -r -p "Continue? This will overwrite the database. [y/N] " confirm
if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

echo "[$(date -Iseconds)] Dropping public schema…"
psql "${DATABASE_URL}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "[$(date -Iseconds)] Restoring from ${BACKUP_FILE}…"
gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}"

echo "[$(date -Iseconds)] Running Prisma migrations to sync schema state…"
(cd "$(dirname "$0")/../api" && npx prisma migrate deploy)

echo "[$(date -Iseconds)] ✅ Restore complete."
