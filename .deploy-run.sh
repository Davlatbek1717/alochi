#!/usr/bin/env bash
# Orchestrated prod deploy, run detached ON the server from /var/www/alochi.
# The real DB creds live in /root/alochi-secrets/secrets.env (DB_USER/
# DB_PASS/DB_NAME → alochi_user@alochi_prod); apps/api/.env's DATABASE_URL
# is wrong, so we build a correct one (password URL-encoded) and export it
# for the migrate step. pipefail so a failed step aborts before pm2
# restart — a bad build/migration never replaces the live process.
set -euo pipefail
ROOT="/var/www/alochi"
cd "$ROOT"
step() { echo "=== [$(date '+%H:%M:%S')] $* ==="; }

step "1/8 extract source bundle"
tar -xf "$ROOT/.deploy-redesign.tar" -C "$ROOT"
echo "EXTRACTED $(stat -c%s "$ROOT/.deploy-redesign.tar") bytes"

step "2/8 pnpm install (frozen)"
pnpm install --frozen-lockfile --prefer-offline 2>&1 | tail -n 3

step "3/8 prisma generate (refresh client for new schema)"
pnpm --filter api exec prisma generate 2>&1 | tail -n 3

step "4/8 prisma migrate deploy (only 0062 pending)"
set -a
. /root/alochi-secrets/secrets.env
set +a
export DATABASE_URL="postgresql://${DB_USER}:$(node -e 'console.log(encodeURIComponent(process.env.DB_PASS))')@localhost:5432/${DB_NAME}?schema=public"
pnpm --filter api exec prisma migrate deploy --schema ../../prisma/schema.prisma 2>&1 | tail -n 12

step "5/8 build API"
pnpm -F api build 2>&1 | tail -n 6

step "6/8 build web"
pnpm -F web build 2>&1 | tail -n 8

step "7/8 restart pm2 (api + web)"
pm2 startOrRestart "$ROOT/ecosystem.config.cjs" --update-env 2>&1 | tail -n 4
pm2 save 2>&1 | tail -n 1 || true

step "8/8 health (API on :3010)"
sleep 6
curl -s -m 15 -o /dev/null -w 'api_health_http=%{http_code}\n' \
  http://127.0.0.1:3010/health || echo "api health curl failed"
pm2 ls 2>&1 | grep -iE 'alochi-api|alochi-web' || true

step "DEPLOY_DONE"
