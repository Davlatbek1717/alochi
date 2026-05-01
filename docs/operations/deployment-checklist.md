# Deployment Checklist

## Pre-deploy

### Required env vars
- `DATABASE_URL` (production Postgres)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (32+ chars each)
- `ANTHROPIC_API_KEY`
- `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_URL`
- `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DB`
- `ML_SERVICE_URL`, `ML_SERVICE_TIMEOUT_MS`
- `FACE_VECTOR_KEY` (`openssl rand -base64 32`)
- `DEVICE_TOKEN_SECRET` (`openssl rand -base64 64`)

### Migrations

#### Postgres
- Apply: `pnpm --filter api exec prisma migrate deploy`
- Migration count (as of Phase 24): **32 directories** in `prisma/migrations/`
  (excludes `migration_lock.toml`)
- `prisma migrate deploy` is the production apply command — it never generates,
  never resets, and only applies pending migrations idempotently.

#### ClickHouse
- Applied automatically on API startup via `ClickHouseService.runMigrations()`.
- Source: `apps/api/src/migrations/clickhouse/*.sql` — 3 files.
- All statements use `IF NOT EXISTS` (tables + materialized views) or
  `CREATE OR REPLACE` (functions), so re-running on every boot is safe and
  idempotent.

### ML cold-start
- `pnpm --filter api seed:churn-training` (must have ≥100 labeled samples or
  ML stays in rule_fallback mode forever)

## Deploy

- [ ] CI: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`
- [ ] Tag: `git tag v1.0.0 && git push origin v1.0.0`
- [ ] Docker images built and pushed
- [ ] Deploy to staging first; smoke test (UAT checklist)
- [ ] Promote to production

## Lighthouse (manual, post-deploy)

`@lhci/cli` is intentionally not pinned in repo deps (Phase 16 left it as
opt-in to keep the install surface small). Run on demand:

```bash
pnpm --filter web add -D @lhci/cli
pnpm --filter web lhci autorun
```

Targets: PWA ≥ 0.9 (error), A11y/Best-Practices ≥ 0.9 (warn).

## Post-deploy verification
- [ ] /health returns 200 with `database: up`
- [ ] Login flow works (superadmin)
- [ ] WebSocket connects (DevTools → Network → WS)
- [ ] PWA installable

## 24h soak monitoring
- [ ] Error spikes? (Sentry / CloudWatch)
- [ ] P95 latency ≤ 500ms?
- [ ] Daily crons fired:
  - 22:00 mentor_kpi_calc
  - 23:59 payment_block
  - 00:01 payment_unblock + monitoring
  - 02:00 refresh_mv
  - 03:00 adaptive_difficulty
  - 03:00 clickhouse_retry
  - 04:00 (Sunday) chat_90day_cleanup
  - 05:00 ml_churn_train
  - 06:00 churn_scoring
  - 07:00 spaced_repetition_morning
  - 09:00 task_due_reminder
  - 18:00 absent_2day_parent_reminder
  - 23:00 face_cache_generate
  - 23:00 (last day of month) filadmin_monthly_kpi
  - 01:05 group_challenge_complete
