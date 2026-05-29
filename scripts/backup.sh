#!/usr/bin/env bash
# Judo-Arena — PostgreSQL backup script
#
# Usage:
#   ./scripts/backup.sh
#
# Environment variables:
#   DATABASE_URL      — PostgreSQL connection string (required)
#   BACKUP_DIR        — directory to store backups (default: ./backups)
#   BACKUP_RETAIN_DAYS — how many days to keep local backups (default: 30)
#   BACKUP_S3_BUCKET  — optional: upload to S3-compatible storage
#                       requires aws CLI + AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

set -euo pipefail

# Load .env if present (useful for local runs)
if [[ -f "$(dirname "$0")/../.env" ]]; then
  set -o allexport
  # shellcheck source=/dev/null
  source "$(dirname "$0")/../.env"
  set +o allexport
fi

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="backup_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting backup → ${FILEPATH}"
pg_dump "${DATABASE_URL}" | gzip > "${FILEPATH}"
echo "[$(date -Iseconds)] Backup complete ($(du -sh "${FILEPATH}" | cut -f1))"

# --- Optional S3 upload ---
if [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  echo "[$(date -Iseconds)] Uploading to s3://${BACKUP_S3_BUCKET}/${FILENAME}"
  aws s3 cp "${FILEPATH}" "s3://${BACKUP_S3_BUCKET}/${FILENAME}" \
    --storage-class STANDARD_IA
  echo "[$(date -Iseconds)] S3 upload complete"
fi

# --- Rotation: delete local files older than BACKUP_RETAIN_DAYS ---
find "${BACKUP_DIR}" -name "backup_*.sql.gz" -mtime "+${BACKUP_RETAIN_DAYS}" -delete
echo "[$(date -Iseconds)] Rotation done (kept last ${BACKUP_RETAIN_DAYS} days)"
