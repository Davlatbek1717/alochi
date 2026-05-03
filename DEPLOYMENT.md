# A'lochi — Deployment Guide

This is the operational checklist for shipping A'lochi to a production
environment. Treat each section as a gate: do not move past one until
every box in it is ticked.

---

## 1. Prerequisites

| Component | Min version | Notes |
|---|---|---|
| Node.js | 20 LTS | Both API and web compile against the same major. |
| pnpm | 9.x | Repo uses pnpm workspaces. |
| Postgres | 14+ | Needs the `uuid-ossp` extension (auto-installed by 001 migration). |
| ClickHouse | 24.x | Optional but events/analytics rely on it. |
| Telegram Bot | created via BotFather | Required for parent reports. |
| Reverse proxy | nginx / Caddy | Terminates TLS; forwards to the Nest app. |

Generate the secrets you'll need before starting:

```bash
openssl rand -base64 64   # JWT_SECRET
openssl rand -base64 64   # JWT_REFRESH_SECRET
openssl rand -base64 64   # DEVICE_TOKEN_SECRET
openssl rand -base64 32   # FACE_VECTOR_KEY
```

---

## 2. Environment configuration

1. Copy `.env.example` → `.env` at the repo root **and** at `apps/api/.env`.
2. Fill in every key marked `[PROD-REQUIRED]`. The API will refuse to
   boot in production if any of them are missing or still hold the
   placeholder value (see [main.ts](apps/api/src/main.ts) `assertProdEnv`).
3. `ALLOWED_ORIGIN` is comma-separated and must include every host the
   browser will load from (e.g. `https://app.alochi.uz,https://www.alochi.uz`).
4. `NEXT_PUBLIC_API_URL` is **build-time** for the web app — set it
   before running `pnpm --filter web build`.
5. Verify with: `node -e "require('dotenv').config(); console.log(Object.keys(process.env).filter(k => /^(JWT|DATABASE|ALLOWED|FACE|GEMINI)/.test(k)))"`.

---

## 3. Database

```bash
# 1. Create the database
createdb alochi

# 2. Apply every committed migration
pnpm --filter api exec prisma migrate deploy

# 3. (Optional) seed demo data — DO NOT run in real prod
pnpm --filter api exec ts-node prisma/seed-demo.ts
```

Confirm the migration set is in sync:

```bash
pnpm --filter api exec prisma migrate status
```

If it reports drift, do **not** run `prisma db push` against production
— inspect the diff and ship a follow-up migration instead.

---

## 4. Build

```bash
# API (Nest, compiles to dist/)
pnpm --filter api run build

# Web (Next 15, static + server bundle)
NEXT_PUBLIC_API_URL=https://api.alochi.uz \
NEXT_PUBLIC_TELEGRAM_BOT=alochi_bot \
pnpm --filter web run build
```

---

## 5. Quality gates (must all pass before tagging)

```bash
pnpm --filter api exec tsc --noEmit       # API typecheck
pnpm --filter web exec tsc --noEmit       # Web typecheck
pnpm --filter api run lint                # API lint
pnpm --filter web run lint                # Web lint
pnpm --filter api test                    # API unit + integration tests
pnpm --filter api run build && pnpm --filter web run build
```

A failed gate is a blocker — do not bypass with `--no-verify` or
`--skip-checks`.

---

## 6. Runtime

The API and web app are independent processes; supervise both.

```bash
# API
NODE_ENV=production node apps/api/dist/main.js

# Web (must already be built)
NODE_ENV=production pnpm --filter web start
```

Recommended: run each under a process manager (systemd, pm2, Docker,
fly.io machine, etc.) with auto-restart.

The API exposes a health probe at `GET /health` — point your load
balancer's liveness check there.

---

## 7. Reverse proxy

Minimal nginx fragment:

```nginx
# api.alochi.uz
location / {
  proxy_pass http://127.0.0.1:3001;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Host $host;
  client_max_body_size 5m;
}

# app.alochi.uz
location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  proxy_set_header Host $host;
}
```

`X-Forwarded-Proto` is required so Nest's `trust proxy` setting
honours HTTPS for cookies / redirects.

---

## 8. Security checklist

- [ ] Strong unique `JWT_SECRET` and `JWT_REFRESH_SECRET` (64+ random bytes).
- [ ] `ALLOWED_ORIGIN` lists only your real frontend hosts — no `*`.
- [ ] Postgres user has only the privileges it needs; do **not** run
      with `superuser`.
- [ ] Database backup cron is configured (logical dump + WAL archiving).
- [ ] Telegram webhook URL is HTTPS-only.
- [ ] HTTPS cert renewal is automated (certbot, Caddy, ACM, etc.).
- [ ] Swagger docs are NOT served (the bootstrap already gates this on
      `NODE_ENV !== 'production'`).
- [ ] Helmet + the security headers in
      [next.config.ts](apps/web/next.config.ts) are reaching the browser
      (verify with `curl -I https://app.alochi.uz`).
- [ ] Prisma migrations are run as a low-privilege "migrator" role,
      not the application's runtime user.

---

## 9. Observability

Monitor at minimum:

- **API process** uptime + restart count.
- **Postgres** connections, slow queries, table bloat.
- **HTTP** 5xx rate and p95 latency on `/marketing/*` (public),
  `/lessons/*`, `/exams/*`.
- **Telegram bot** webhook deliveries (Telegram dashboard → Bot Stats).
- **AI quotas** — monitor the Gemini key usage; set up an alert at
  80% of the daily cap.

The API logs are JSON via Pino; ship them to your aggregation tool of
choice (Loki, ELK, Datadog).

---

## 10. Post-deploy smoke test

Run this manually within 15 minutes of a deploy:

1. Open the public landing — hero, prizes, certificate sections render
   without 500s.
2. Submit a contact request from `/` → `/superadmin/contact-requests`
   shows the new row.
3. Log in as superadmin → edit a hero string in `/superadmin/landing`
   → reload the public landing within 60s and confirm the change.
4. Log in as a student → open the lesson path → start any lesson →
   complete one component → confirm progress updates.
5. Trigger an MCQ exam submission → confirm score is recorded and the
   parent Telegram notification fires (if the student has one linked).

If any step fails, page on-call before customer traffic catches it.

---

## 11. Rollback

```bash
# Web — revert to previous tag
git checkout v<previous>-web && pnpm --filter web run build && systemctl restart alochi-web

# API — revert tag + roll back migration only if the new one is non-additive
git checkout v<previous>-api && pnpm --filter api run build && systemctl restart alochi-api
# Database rollback only if the failed migration is destructive (rare):
psql $DATABASE_URL -f prisma/migrations/<previous-migration>/rollback.sql
```

Most A'lochi migrations are additive (new tables/columns with
`IF NOT EXISTS`), so rolling code back without touching the schema is
the default safe path.
