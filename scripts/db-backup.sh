#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# A'lochi — Postgres backup (#2). Nightly pg_dump, gzip, local retention, with
# an optional offsite hook. Credentials never live in this file: DATABASE_URL is
# read from the secrets env so the script is safe to commit.
#
# Prod install: copied to /usr/local/bin/alochi-db-backup.sh and run by cron
# (deploy-independent path, so `git reset --hard` during deploys can't remove
# it). Run manually to test:  bash scripts/db-backup.sh
#
# Tunables (env, all optional):
#   ALOCHI_ENV          app env file holding DATABASE_URL [/var/www/alochi/apps/api/.env]
#   ALOCHI_SECRETS      secrets file (DB_USER/DB_PASS/DB_NAME fallback)
#                                                       [/root/alochi-secrets/secrets.env]
#   BACKUP_DIR          where dumps are written         [/var/backups/alochi/db]
#   BACKUP_RETAIN_DAYS  prune dumps older than N days   [14]
#   BACKUP_LOG          append-only log file            [/var/log/alochi-backup.log]
#   BACKUP_OFFSITE_CMD  command run as `<cmd> <file>` after a good dump (e.g.
#                       'aws s3 cp "$1" s3://bucket/alochi/'). Unset = local-only.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="${ALOCHI_ENV:-/var/www/alochi/apps/api/.env}"
SECRETS="${ALOCHI_SECRETS:-/root/alochi-secrets/secrets.env}"
DEST="${BACKUP_DIR:-/var/backups/alochi/db}"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"
LOG="${BACKUP_LOG:-/var/log/alochi-backup.log}"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG" >&2; }

# Resolve the connection string without sourcing whole env files (their values
# can contain characters that break `source`).
#  1) an already-exported DATABASE_URL wins;
#  2) else read it straight from the app .env;
#  3) else build it from DB_USER/DB_PASS/DB_NAME in the secrets file.
DB_URL="${DATABASE_URL:-}"
if [ -z "$DB_URL" ] && [ -f "$ENV_FILE" ]; then
  DB_URL="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | head -1)"
  DB_URL="${DB_URL%\"}"; DB_URL="${DB_URL#\"}"   # strip optional surrounding quotes
fi
if [ -z "$DB_URL" ] && [ -f "$SECRETS" ]; then
  # shellcheck disable=SC1090
  source "$SECRETS"
  if [ -n "${DB_USER:-}" ] && [ -n "${DB_NAME:-}" ]; then
    DB_URL="postgresql://${DB_USER}:${DB_PASS:-}@${DB_HOST:-localhost}:${DB_PORT:-5432}/${DB_NAME}"
  fi
fi
: "${DB_URL:?could not resolve DATABASE_URL (checked \$DATABASE_URL, $ENV_FILE, $SECRETS)}"

# Strip the Prisma-only "?schema=..." query string — libpq/pg_dump rejects it.
DB_URL="${DB_URL%%\?*}"

mkdir -p "$DEST"
TS="$(date +%F-%H%M%S)"
FILE="$DEST/alochi-$TS.sql.gz"
TMP="$FILE.partial"

log "backup start -> $FILE"
if pg_dump --no-owner --no-privileges "$DB_URL" | gzip -9 >"$TMP"; then
  mv "$TMP" "$FILE"
  log "backup ok   $FILE ($(du -h "$FILE" | cut -f1))"
else
  rm -f "$TMP"
  log "backup FAIL pg_dump returned non-zero"
  exit 1
fi

# Retention only runs after a successful dump so a failing night never deletes
# the last good backup.
find "$DEST" -name 'alochi-*.sql.gz' -mtime +"$RETAIN_DAYS" -delete
log "retained last ${RETAIN_DAYS}d; dumps on disk: $(find "$DEST" -name 'alochi-*.sql.gz' | wc -l)"

if [ -n "${BACKUP_OFFSITE_CMD:-}" ]; then
  if bash -c "$BACKUP_OFFSITE_CMD" _ "$FILE" >>"$LOG" 2>&1; then
    log "offsite ok"
  else
    log "offsite FAILED (local copy retained)"
  fi
fi
