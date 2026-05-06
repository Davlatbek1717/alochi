# A'lochi

Multi-tenant English-learning SaaS for Uzbekistan, grades 3–7.
AI tutor, camera-supervised lesson runner, parent-Telegram reports,
and a superadmin-managed public landing CMS.

## Stack

- **API** — NestJS 10, Prisma 5, PostgreSQL 14+, ClickHouse for analytics.
- **Web** — Next.js 15 (App Router), React 18, Tailwind, PWA via
  `@ducanh2912/next-pwa`.
- **AI** — Google Gemini for the in-lesson tutor; Azure Speech for
  pronunciation scoring.
- **Bot** — Telegram via grammY for parent reports.

## Repo layout

```
alochi/
├── apps/
│   ├── api/          # Nest backend
│   └── web/          # Next.js frontend
├── prisma/           # Schema + migrations + seed scripts
├── DEPLOYMENT.md     # Production checklist
└── .env.example      # Single source of truth for required env vars
```

## Getting started

```bash
pnpm install
cp .env.example .env && cp .env.example apps/api/.env

# Bring up Postgres locally, then:
pnpm --filter api exec prisma migrate dev
pnpm --filter api exec ts-node prisma/seed-demo.ts   # demo data, optional

# Two terminals:
pnpm dev:api   # http://localhost:3001
pnpm dev:web   # http://localhost:3000
```

Default superadmin (from seed): `superadmin / superadmin123`.

## Quality gates

Before opening a PR or shipping:

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api run lint
pnpm --filter web run lint
pnpm --filter api test
pnpm --filter api run build && pnpm --filter web run build
```

All six must pass. Tests are not optional — see [DEPLOYMENT.md](DEPLOYMENT.md)
for the production gating.

## Production

Read [DEPLOYMENT.md](DEPLOYMENT.md) end-to-end before your first
deploy. The API will refuse to boot in `NODE_ENV=production` if the
mandatory env vars are missing or still hold placeholder values.

## License

UNLICENSED — internal use only.
