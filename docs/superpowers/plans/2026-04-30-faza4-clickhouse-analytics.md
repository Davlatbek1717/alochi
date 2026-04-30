# Faza 4 ClickHouse Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Event analytics'ni ClickHouse OLAP warehouse'ga ko'chirish (state aggregations PostgreSQL'da qoladi), 5 ta yangi OLAP query qo'shish (cohort, funnel, lifecycle, top failures, tenant comparison), tabbed analytics dashboard.

**Architecture:** Dual-write reliability — har event PostgreSQL'ga (audit/buffer) va ClickHouse'ga (warehouse) yoziladi. ClickHouse down bo'lsa retry queue (`syncedAt IS NULL`) cron 03:00'da qayta urinadi. Frontend bitta tabbed sahifa.

**Tech Stack:** NestJS 10, Prisma v5 + PostgreSQL, ClickHouse 24.8 (Alpine), `@clickhouse/client` ^1.0.0, Next.js 15 App Router, recharts, TypeScript.

---

## Execution Discipline

**Phase-level batching:** Plan 6 ta phase'ga bo'lingan. Har phase ichida hamma task'lar bajariladi, **keyin** quality gates **bir marta** ishga tushiriladi, **keyin** bitta commit qilinadi. Phase ichida intermediate commit yo'q.

**Sacred quality bar (har phase commit'idan oldin majburiy):**
1. `pnpm tsc --noEmit` (api + web) — 0 errors
2. Lint (changed files) — 0 errors
3. `pnpm build` (affected workspaces) — pass
4. Unit testlar — barchasi pass (faqat yangi failures'ni tekshirish, baseline 4 ta DI/DB infra failure davom etadi)
5. Cross-aggregate integration: dual-write reliability tests, retry tests

**Hard ban:**
- `--no-verify` **ishlatilmaydi**
- `HUSKY=0`, hook disable, hook config edit — **yo'q**

**Worktree:** Plan executor'i `.worktrees/faza4-clickhouse` worktree'ida ishlashi kerak (`feat/faza4-clickhouse` branch).

---

## File Map

**Phase 1 — Infra (Create/Modify):**
- Modify: `docker-compose.yml` — clickhouse service qo'shish
- Modify: `apps/api/.env` (asosiy repo'da) — `CLICKHOUSE_*` env vars
- Modify: `apps/api/.env.example` — placeholder env vars
- Modify: `apps/api/package.json` — `@clickhouse/client` dep
- Create: `apps/api/src/clickhouse/clickhouse.module.ts`
- Create: `apps/api/src/clickhouse/clickhouse.service.ts`
- Modify: `apps/api/src/app.module.ts` — register ClickHouseModule

**Phase 2 — Schema + dual-write (Create/Modify):**
- Create: `apps/api/src/migrations/clickhouse/001_create_events.sql`
- Create: `apps/api/src/migrations/clickhouse/002_create_mvs.sql`
- Modify: `apps/api/src/clickhouse/clickhouse.service.ts` — `runMigrations()`, `insertEvent()`
- Create: `prisma/migrations/0019_analytics_synced_at/migration.sql` — add `synced_at` column
- Modify: `prisma/schema.prisma` — add `syncedAt` to AnalyticsEvent
- Modify: `apps/api/src/analytics/analytics.service.ts` — dual-write
- Modify: `apps/api/src/analytics/analytics.module.ts` — no change (ClickHouseModule global)
- Create: `apps/api/test/clickhouse.spec.ts`
- Modify: `apps/api/test/analytics.spec.ts` — extend with dual-write tests

**Phase 3 — Backfill + retry (Create/Modify):**
- Create: `apps/api/src/migrations/clickhouse/backfill.ts`
- Modify: `apps/api/package.json` — add `migrate:clickhouse-backfill` script
- Modify: `apps/api/src/cron/cron.service.ts` — `runClickHouseRetry()` cron
- Modify: `apps/api/src/cron/cron.module.ts` — no change (ClickHouseModule global)
- Modify: `apps/api/test/analytics.spec.ts` — extend with retry test

**Phase 4 — New OLAP queries (Modify):**
- Modify: `apps/api/src/analytics/analytics.service.ts` — 5 ta yangi method
- Modify: `apps/api/src/analytics/analytics.controller.ts` — 5 ta yangi endpoint
- Modify: `apps/api/test/analytics.spec.ts` — extend with 5 query tests

**Phase 5 — Frontend tabbed dashboard (Create/Modify):**
- Modify: `apps/web/app/(dashboard)/superadmin/analytics/page.tsx` — tabbed shell
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/ActivityTab.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/LessonsTab.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/BranchesTab.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/CohortTab.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/FunnelTab.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/LifecycleTab.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/FailuresTab.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/ComparisonTab.tsx`

**Phase 6 — Integration verification:** kod o'zgarishi yo'q, manual e2e.

---

# Phase 1: ClickHouse Infrastructure

**Maqsad:** Docker'da ClickHouse ishga tushiriladi, ConfigService orqali ulanish konfiguratsiyasi, ClickHouseService skeleton (faqat connection — migrations va insert keyingi phase'da).

**Phase commit:** Phase 1 oxirida.

---

## Task 1.1: docker-compose.yml ga ClickHouse service qo'shish

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Mavjud `docker-compose.yml` ni o'qish**

```bash
cat d:/projects/alochi/.worktrees/faza4-clickhouse/docker-compose.yml
```

Faylda `services` (db, api, web, ai-service, nginx) va `volumes` (db_data) bor.

- [ ] **Step 2: ClickHouse service qo'shish**

`services` ostiga (boshqa service'lar bilan birga) qo'shing:
```yaml
  clickhouse:
    image: clickhouse/clickhouse-server:24.8-alpine
    container_name: alochi_clickhouse
    environment:
      CLICKHOUSE_USER: alochi
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD:-changeme_dev_password}
      CLICKHOUSE_DB: alochi_analytics
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
    ports:
      - '8123:8123'
      - '9000:9000'
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:8123/ping']
      interval: 10s
      timeout: 5s
      retries: 5
```

`api` service'ga `clickhouse` ga depend qo'shing va environment'ga `CLICKHOUSE_*` qo'shing:
```yaml
  api:
    # ...mavjud konfiguratsiya
    depends_on:
      db:
        condition: service_healthy
      clickhouse:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/alochi?schema=public
      PORT: '3001'
      CLICKHOUSE_URL: http://clickhouse:8123
      CLICKHOUSE_USER: alochi
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD:-changeme_dev_password}
      CLICKHOUSE_DB: alochi_analytics
```

`volumes` ga `clickhouse_data:` qo'shing:
```yaml
volumes:
  db_data:
  clickhouse_data:
```

---

## Task 1.2: .env vars qo'shish

**Files:**
- Modify: `apps/api/.env`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: `apps/api/.env` ga local dev uchun env vars qo'shish**

`.env` file mavjud bo'lsa append, yo'q bo'lsa create:
```
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=alochi
CLICKHOUSE_PASSWORD=changeme_dev_password
CLICKHOUSE_DB=alochi_analytics
```

- [ ] **Step 2: `apps/api/.env.example` ga placeholder qo'shish**

Append:
```
# ClickHouse analytics warehouse
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=alochi
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DB=alochi_analytics
```

---

## Task 1.3: `@clickhouse/client` dependency

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: `@clickhouse/client` o'rnatish**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse && pnpm add @clickhouse/client --filter api
```

Kutilgan: `apps/api/package.json` da `dependencies` ostida `"@clickhouse/client": "^1.x.x"` paydo bo'ladi.

---

## Task 1.4: ClickHouseService skeleton

**Files:**
- Create: `apps/api/src/clickhouse/clickhouse.service.ts`
- Create: `apps/api/src/clickhouse/clickhouse.module.ts`

- [ ] **Step 1: Service skeleton yaratish**

Create `apps/api/src/clickhouse/clickhouse.service.ts`:
```ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, NodeClickHouseClient } from '@clickhouse/client';

export interface ClickHouseEvent {
  event_id: string;
  tenant_id: string;
  event_type: string;
  student_id: string | null;
  branch_id: string | null;
  lesson_id: string | null;
  session_count: number;
  is_present: number | null;
  is_late: number | null;
  new_streak: number | null;
  data: string;
  created_at: string;
}

@Injectable()
export class ClickHouseService implements OnModuleInit, OnModuleDestroy {
  private client!: NodeClickHouseClient;
  private readonly logger = new Logger(ClickHouseService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('CLICKHOUSE_URL');
    if (!url) {
      this.logger.warn('CLICKHOUSE_URL not set — ClickHouse client disabled');
      return;
    }
    this.client = createClient({
      url,
      username: this.config.get<string>('CLICKHOUSE_USER') ?? 'alochi',
      password: this.config.get<string>('CLICKHOUSE_PASSWORD') ?? '',
      database: this.config.get<string>('CLICKHOUSE_DB') ?? 'alochi_analytics',
    });

    try {
      await this.client.ping();
      this.logger.log('ClickHouse connected');
    } catch (e) {
      this.logger.warn(`ClickHouse ping failed: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.client?.close();
  }

  isReady(): boolean {
    return !!this.client;
  }

  async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    if (!this.client) throw new Error('ClickHouse client not initialized');
    const rs = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
    });
    return rs.json<T>();
  }
}
```

- [ ] **Step 2: Global module yaratish**

Create `apps/api/src/clickhouse/clickhouse.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { ClickHouseService } from './clickhouse.service';

@Global()
@Module({
  providers: [ClickHouseService],
  exports: [ClickHouseService],
})
export class ClickHouseModule {}
```

---

## Task 1.5: AppModule'ga ClickHouseModule register qilish

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Import qo'shish**

`apps/api/src/app.module.ts` da boshqa module import'lar yonida:
```ts
import { ClickHouseModule } from './clickhouse/clickhouse.module';
```

- [ ] **Step 2: imports array'ga qo'shish**

`@Module({ imports: [...] })` ichida boshqa module'lar yonida `ClickHouseModule` qo'shish (masalan, `AnalyticsModule` dan oldin).

---

## Phase 1 — Quality Gates va Commit

- [ ] **Step 1: TypeScript check (api workspace)**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npx tsc --noEmit
```

Kutilgan: 0 errors.

- [ ] **Step 2: Lint changed files**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && node_modules/.bin/eslint --no-fix src/clickhouse src/app.module.ts
```

Kutilgan: 0 errors. Agar prettier formatting xatolari bor bo'lsa `--fix` bilan tuzating.

- [ ] **Step 3: API build**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm run build 2>&1 | tail -5
```

Kutilgan: build pass.

- [ ] **Step 4: Test full suite — yangi failures yo'qligini tekshirish**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm test -- --no-coverage 2>&1 | tail -10
```

Kutilgan: yangi failures yo'q (4 ta baseline cron/delegations/prisma DI failures davom etadi).

- [ ] **Step 5: ClickHouse Docker smoke test (local — ixtiyoriy)**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse && docker compose up -d clickhouse 2>&1 | tail -5
sleep 10
curl http://localhost:8123/ping
```

Kutilgan: `Ok.` Cleanup: `docker compose stop clickhouse`.

Bu step ixtiyoriy — Docker Desktop ishlamasa, skip qilish mumkin (Phase 6 manual e2e da to'liq tekshiriladi).

- [ ] **Step 6: Phase 1 single commit**

```bash
git -C d:/projects/alochi/.worktrees/faza4-clickhouse add \
  docker-compose.yml \
  apps/api/.env \
  apps/api/.env.example \
  apps/api/package.json \
  apps/api/src/clickhouse \
  apps/api/src/app.module.ts \
  pnpm-lock.yaml

git -C d:/projects/alochi/.worktrees/faza4-clickhouse commit -m "feat(infra): add ClickHouse service with NestJS module skeleton

- docker-compose.yml: alochi_clickhouse service (24.8-alpine), healthcheck, persistent volume
- @clickhouse/client dependency for query/insert
- ClickHouseService: ConfigService-driven connection, OnModuleInit ping, query helper
- @Global() ClickHouseModule registered in AppModule
- Connection-only skeleton — schema migrations and insertEvent come in Phase 2"
```

**Husky pre-commit hook ishga tushadi.** Fail bo'lsa root cause topib tuzatish — `--no-verify` **YO'Q**.

---

# Phase 2: Schema + Dual-Write

**Maqsad:** ClickHouse `events` jadvali va materialized view'lar yaratiladi, ClickHouseService'da `runMigrations()` va `insertEvent()` qo'shiladi, AnalyticsEvent'ga `syncedAt` field qo'shiladi (Prisma migration), AnalyticsService.logEvent dual-write ga o'zgartiriladi.

**Phase commit:** Phase 2 oxirida.

---

## Task 2.1: ClickHouse migration SQL fayllari

**Files:**
- Create: `apps/api/src/migrations/clickhouse/001_create_events.sql`
- Create: `apps/api/src/migrations/clickhouse/002_create_mvs.sql`

- [ ] **Step 1: events jadvali**

Create `apps/api/src/migrations/clickhouse/001_create_events.sql`:
```sql
CREATE TABLE IF NOT EXISTS events (
  event_id      UUID DEFAULT generateUUIDv4(),
  tenant_id     UUID,
  event_type    LowCardinality(String),
  student_id    Nullable(UUID),
  branch_id     Nullable(UUID),
  lesson_id     Nullable(UUID),
  session_count UInt16   DEFAULT 0,
  is_present    Nullable(UInt8),
  is_late       Nullable(UInt8),
  new_streak    Nullable(UInt16),
  data          String,
  created_at    DateTime64(3) DEFAULT now64()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (tenant_id, event_type, created_at, student_id);
```

- [ ] **Step 2: Materialized views**

Create `apps/api/src/migrations/clickhouse/002_create_mvs.sql`:
```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS dau_daily
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (tenant_id, day)
AS
SELECT
  tenant_id,
  toDate(created_at) AS day,
  uniqState(student_id) AS dau_state
FROM events
WHERE student_id IS NOT NULL
GROUP BY tenant_id, day;

CREATE MATERIALIZED VIEW IF NOT EXISTS lesson_failures
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(day)
ORDER BY (tenant_id, lesson_id, day)
AS
SELECT
  tenant_id,
  lesson_id,
  toDate(created_at) AS day,
  countIf(event_type = 'lesson_failed') AS failed_count,
  countIf(event_type = 'lesson_completed') AS completed_count
FROM events
WHERE lesson_id IS NOT NULL
GROUP BY tenant_id, lesson_id, day;
```

Eslatma: Cohort retention uchun MV o'rniga to'g'ridan-to'g'ri events table'dan window function ishlatiladi (oddiyligi uchun).

---

## Task 2.2: ClickHouseService'ga `runMigrations()` va `insertEvent()`

**Files:**
- Modify: `apps/api/src/clickhouse/clickhouse.service.ts`

- [ ] **Step 1: Import'larga `fs`, `path` qo'shish**

`apps/api/src/clickhouse/clickhouse.service.ts` boshiga qo'shing:
```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
```

- [ ] **Step 2: `runMigrations()` method qo'shish**

`onModuleInit` ichida `ping` muvaffaqiyatli bo'lgandan keyin `runMigrations` chaqiriladi. `query` method'dan keyin yangi method qo'shing:
```ts
async runMigrations(): Promise<void> {
  if (!this.client) {
    this.logger.warn('Skipping migrations — client not initialized');
    return;
  }
  const migrationsDir = join(__dirname, '../migrations/clickhouse');
  const files = ['001_create_events.sql', '002_create_mvs.sql'];
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      try {
        await this.client.command({ query: stmt });
      } catch (e) {
        this.logger.error(`Migration ${file} stmt failed: ${(e as Error).message}`);
        throw e;
      }
    }
    this.logger.log(`Applied migration ${file}`);
  }
}
```

- [ ] **Step 3: `insertEvent` method qo'shish**

```ts
async insertEvent(event: ClickHouseEvent): Promise<void> {
  if (!this.client) throw new Error('ClickHouse client not initialized');
  await this.client.insert({
    table: 'events',
    values: [event],
    format: 'JSONEachRow',
  });
}
```

- [ ] **Step 4: `onModuleInit` ichida migrations chaqiruvi**

`onModuleInit` ichida `ping` muvaffaqiyatli bo'lgan blokda:
```ts
try {
  await this.client.ping();
  this.logger.log('ClickHouse connected');
  await this.runMigrations();
} catch (e) {
  this.logger.warn(`ClickHouse init failed: ${(e as Error).message}`);
}
```

`nest build` paytida `.sql` fayllar `dist/`'ga ko'chirilmasligi mumkin — `nest-cli.json` ga `"assets": ["**/*.sql"]` va `"watchAssets": true` qo'shish kerak. Mavjud bo'lsa skip; yo'q bo'lsa Step 5.

- [ ] **Step 5: nest-cli.json'da `compilerOptions.assets` qo'shish (zarur bo'lsa)**

`apps/api/nest-cli.json` ni o'qib, `compilerOptions` ostida `assets` field bo'lmasa qo'shing:
```json
{
  "compilerOptions": {
    "assets": [
      { "include": "migrations/**/*.sql", "outDir": "dist/migrations" }
    ],
    "watchAssets": true
  }
}
```

Yoki `compilerOptions.assets` mavjud bo'lsa array'ga qo'shing.

`__dirname` runtime'da `dist/clickhouse` ga ishora qiladi. Path `dist/clickhouse/../migrations/clickhouse` = `dist/migrations/clickhouse` bo'ladi. Bu Step 4'dagi path bilan mos.

---

## Task 2.3: Prisma migration: AnalyticsEvent.syncedAt

**Files:**
- Create: `prisma/migrations/0019_analytics_synced_at/migration.sql`
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Migration SQL yaratish**

Create `prisma/migrations/0019_analytics_synced_at/migration.sql`:
```sql
ALTER TABLE "analytics_events" ADD COLUMN "synced_at" TIMESTAMP(3);
CREATE INDEX "analytics_events_synced_at_idx" ON "analytics_events" ("synced_at") WHERE "synced_at" IS NULL;
```

Eslatma: Partial index — faqat unsynced event'lar uchun. Retry queue scan tezlik beradi.

- [ ] **Step 2: schema.prisma yangilash**

Find AnalyticsEvent model in `prisma/schema.prisma`:
```prisma
model AnalyticsEvent {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  eventType String   @map("event_type")
  studentId String?  @map("student_id") @db.Uuid
  branchId  String?  @map("branch_id") @db.Uuid
  data      Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([tenantId, eventType, createdAt])
  @@index([tenantId, branchId, createdAt])
  @@map("analytics_events")
}
```

`createdAt` qatoridan keyin qo'shing:
```prisma
  syncedAt  DateTime? @map("synced_at")
```

- [ ] **Step 3: Prisma client regenerate**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse && npx prisma generate
```

Kutilgan: `Generated Prisma Client (vX.X.X)`.

- [ ] **Step 4: Migration apply (dev DB)**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse && npx prisma migrate deploy
```

Kutilgan: migration `0019_analytics_synced_at` applied.

---

## Task 2.4: AnalyticsService dual-write

**Files:**
- Modify: `apps/api/src/analytics/analytics.service.ts`

- [ ] **Step 1: Import'lar va constructor**

Mavjud `apps/api/src/analytics/analytics.service.ts` ni to'liq quyidagicha qayta yozing:
```ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClickHouseService } from '../clickhouse/clickhouse.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private clickhouse: ClickHouseService,
  ) {}

  async getLessonStats(tenantId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      lesson_id: string;
      pass_rate: number;
      total_students: number;
      passed: number;
      avg_sessions: number;
      feedback_avg: number | null;
    }>>(
      `SELECT lesson_id, pass_rate, total_students, passed, avg_sessions, feedback_avg
       FROM lesson_stats_mv WHERE tenant_id = $1`,
      tenantId,
    );
    return rows.map((r) => ({
      lessonId: r.lesson_id,
      passRate: Number(r.pass_rate),
      totalStudents: Number(r.total_students),
      passed: Number(r.passed),
      avgSessions: Number(r.avg_sessions),
      feedbackAvg: r.feedback_avg != null ? Number(r.feedback_avg) : null,
    }));
  }

  async getBranchStats(tenantId: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      branch_id: string;
      active_students: number;
      avg_streak: number;
      avg_xp: number;
    }>>(
      `SELECT branch_id, active_students, avg_streak, avg_xp
       FROM branch_stats_mv WHERE tenant_id = $1`,
      tenantId,
    );
    return rows.map((r) => ({
      branchId: r.branch_id,
      activeStudents: Number(r.active_students),
      avgStreak: Number(r.avg_streak),
      avgXp: Number(r.avg_xp),
    }));
  }

  async getStudentActivity(tenantId: string, period: 'weekly' | 'monthly') {
    const days = period === 'weekly' ? 7 : 30;
    const rows = await this.clickhouse.query<{ day: string; count: string }>(
      `SELECT toDate(created_at)::String AS day, count(DISTINCT student_id)::String AS count
       FROM events
       WHERE tenant_id = {tenantId:UUID}
         AND event_type = 'lesson_completed'
         AND created_at >= now() - INTERVAL ${days} DAY
       GROUP BY day ORDER BY day`,
      { tenantId },
    );
    return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
  }

  async logEvent(params: {
    tenantId: string;
    eventType: string;
    studentId?: string;
    branchId?: string;
    data?: Record<string, unknown>;
  }): Promise<void> {
    // 1. PostgreSQL — must succeed (audit + reliability buffer)
    const event = await this.prisma.analyticsEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: params.eventType,
        studentId: params.studentId,
        branchId: params.branchId,
        data: (params.data ?? {}) as Prisma.InputJsonValue,
      },
    });

    // 2. ClickHouse — fire-and-forget; on success mark syncedAt, on failure leave null for retry
    if (!this.clickhouse.isReady()) {
      this.logger.debug(`ClickHouse not ready — event ${event.id} queued for retry`);
      return;
    }

    const data = params.data ?? {};
    const lessonId = (data as { lessonId?: string }).lessonId ?? null;
    const sessionCount = (data as { sessionCount?: number }).sessionCount ?? 0;
    const isPresent = (data as { isPresent?: boolean }).isPresent;
    const isLate = (data as { isLate?: boolean }).isLate;
    const newStreak = (data as { newStreak?: number }).newStreak;

    this.clickhouse.insertEvent({
      event_id: event.id,
      tenant_id: event.tenantId,
      event_type: event.eventType,
      student_id: event.studentId,
      branch_id: event.branchId,
      lesson_id: lessonId,
      session_count: sessionCount,
      is_present: isPresent === undefined ? null : isPresent ? 1 : 0,
      is_late: isLate === undefined ? null : isLate ? 1 : 0,
      new_streak: newStreak ?? null,
      data: JSON.stringify(data),
      created_at: event.createdAt.toISOString(),
    })
      .then(() =>
        this.prisma.analyticsEvent
          .update({ where: { id: event.id }, data: { syncedAt: new Date() } })
          .catch((e) => this.logger.warn(`syncedAt update failed: ${(e as Error).message}`)),
      )
      .catch((e) => {
        this.logger.warn(`ClickHouse insert failed for event ${event.id}: ${(e as Error).message}`);
      });
  }
}
```

Eslatma: `getStudentActivity` endi ClickHouse'dan o'qiydi (mavjud PostgreSQL'dan emas) — chunki bu event-based query.

---

## Task 2.5: Unit tests (ClickHouseService)

**Files:**
- Create: `apps/api/test/clickhouse.spec.ts`

- [ ] **Step 1: ClickHouseService unit tests**

Create `apps/api/test/clickhouse.spec.ts`:
```ts
import { ClickHouseService } from '../src/clickhouse/clickhouse.service';

describe('ClickHouseService', () => {
  function makeMockClient() {
    return {
      ping: jest.fn().mockResolvedValue({ success: true }),
      command: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
  }

  function makeMockConfig(values: Record<string, string> = {}) {
    return {
      get: jest.fn((key: string) => values[key]),
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('isReady returns false before init', () => {
    const service = new ClickHouseService(makeMockConfig() as never);
    expect(service.isReady()).toBe(false);
  });

  it('insertEvent throws when client not initialized', async () => {
    const service = new ClickHouseService(makeMockConfig() as never);
    await expect(
      service.insertEvent({
        event_id: 'e1',
        tenant_id: 't1',
        event_type: 'test',
        student_id: null,
        branch_id: null,
        lesson_id: null,
        session_count: 0,
        is_present: null,
        is_late: null,
        new_streak: null,
        data: '{}',
        created_at: new Date().toISOString(),
      }),
    ).rejects.toThrow('not initialized');
  });

  it('insertEvent calls client.insert with correct table and format', async () => {
    const service = new ClickHouseService(makeMockConfig() as never);
    const mockClient = makeMockClient();
    (service as unknown as { client: typeof mockClient }).client = mockClient;

    await service.insertEvent({
      event_id: 'e1',
      tenant_id: 't1',
      event_type: 'lesson_completed',
      student_id: 's1',
      branch_id: 'b1',
      lesson_id: 'l1',
      session_count: 3,
      is_present: null,
      is_late: null,
      new_streak: null,
      data: '{"lessonId":"l1"}',
      created_at: '2026-04-30T10:00:00.000Z',
    });

    expect(mockClient.insert).toHaveBeenCalledWith({
      table: 'events',
      values: [expect.objectContaining({ event_id: 'e1', event_type: 'lesson_completed' })],
      format: 'JSONEachRow',
    });
  });

  it('query passes tenant_id through query_params (parameterized)', async () => {
    const service = new ClickHouseService(makeMockConfig() as never);
    const mockClient = makeMockClient();
    mockClient.query.mockResolvedValue({ json: jest.fn().mockResolvedValue([{ count: '5' }]) });
    (service as unknown as { client: typeof mockClient }).client = mockClient;

    const rows = await service.query<{ count: string }>(
      `SELECT count() AS count FROM events WHERE tenant_id = {tenantId:UUID}`,
      { tenantId: 't1' },
    );

    expect(rows).toEqual([{ count: '5' }]);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query_params: { tenantId: 't1' },
        format: 'JSONEachRow',
      }),
    );
  });
});
```

---

## Task 2.6: Unit tests (AnalyticsService dual-write)

**Files:**
- Modify: `apps/api/test/analytics.spec.ts`

- [ ] **Step 1: Mavjud test fayli o'qish**

```bash
cat d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api/test/analytics.spec.ts
```

Tushunish — mavjud mocks va structure.

- [ ] **Step 2: ClickHouse mock va dual-write tests qo'shish**

`apps/api/test/analytics.spec.ts` da mavjud `mockPrisma` ga `analyticsEvent.update` qo'shing va `mockClickHouse` yarating. Mavjud `describe` blokining oxirida (oxirgi `it`'dan keyin) yangi test'lar qo'shing:

```ts
  // ============================================================
  // Phase 2: Dual-write tests
  // ============================================================
  describe('logEvent (dual-write)', () => {
    it('writes to PostgreSQL and ClickHouse, marks syncedAt on success', async () => {
      const createdEvent = {
        id: 'evt-1',
        tenantId: 't1',
        eventType: 'lesson_completed',
        studentId: 's1',
        branchId: null,
        data: { lessonId: 'l1', sessionCount: 3 },
        createdAt: new Date('2026-04-30T10:00:00Z'),
      };
      mockPrisma.analyticsEvent.create.mockResolvedValue(createdEvent);
      mockPrisma.analyticsEvent.update.mockResolvedValue({});
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn().mockResolvedValue(undefined),
        query: jest.fn(),
      };

      const service = new AnalyticsService(mockPrisma as never, mockClickHouse as never);
      await service.logEvent({
        tenantId: 't1',
        eventType: 'lesson_completed',
        studentId: 's1',
        data: { lessonId: 'l1', sessionCount: 3 },
      });

      // Allow microtasks to resolve (CH insert + syncedAt update)
      await new Promise((r) => setImmediate(r));

      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalled();
      expect(mockClickHouse.insertEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'evt-1',
          event_type: 'lesson_completed',
          tenant_id: 't1',
          lesson_id: 'l1',
          session_count: 3,
        }),
      );
      expect(mockPrisma.analyticsEvent.update).toHaveBeenCalledWith({
        where: { id: 'evt-1' },
        data: { syncedAt: expect.any(Date) },
      });
    });

    it('skips ClickHouse when not ready (still writes to PG)', async () => {
      mockPrisma.analyticsEvent.create.mockResolvedValue({ id: 'evt-2' });
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(false),
        insertEvent: jest.fn(),
        query: jest.fn(),
      };

      const service = new AnalyticsService(mockPrisma as never, mockClickHouse as never);
      await service.logEvent({ tenantId: 't1', eventType: 'lesson_completed' });

      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalled();
      expect(mockClickHouse.insertEvent).not.toHaveBeenCalled();
      expect(mockPrisma.analyticsEvent.update).not.toHaveBeenCalled();
    });

    it('does NOT throw when ClickHouse insert fails (PG write succeeds, syncedAt stays null)', async () => {
      mockPrisma.analyticsEvent.create.mockResolvedValue({
        id: 'evt-3',
        tenantId: 't1',
        eventType: 'lesson_completed',
        studentId: null,
        branchId: null,
        createdAt: new Date(),
      });
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn().mockRejectedValue(new Error('CH down')),
        query: jest.fn(),
      };

      const service = new AnalyticsService(mockPrisma as never, mockClickHouse as never);
      await expect(
        service.logEvent({ tenantId: 't1', eventType: 'lesson_completed' }),
      ).resolves.not.toThrow();

      await new Promise((r) => setImmediate(r));

      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalled();
      expect(mockClickHouse.insertEvent).toHaveBeenCalled();
      expect(mockPrisma.analyticsEvent.update).not.toHaveBeenCalled();
    });

    it('throws when PostgreSQL write fails (no silent loss)', async () => {
      mockPrisma.analyticsEvent.create.mockRejectedValue(new Error('PG down'));
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn(),
        query: jest.fn(),
      };

      const service = new AnalyticsService(mockPrisma as never, mockClickHouse as never);
      await expect(
        service.logEvent({ tenantId: 't1', eventType: 'lesson_completed' }),
      ).rejects.toThrow('PG down');

      expect(mockClickHouse.insertEvent).not.toHaveBeenCalled();
    });

    it('getStudentActivity queries ClickHouse with tenant filter', async () => {
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn(),
        query: jest.fn().mockResolvedValue([
          { day: '2026-04-29', count: '12' },
          { day: '2026-04-30', count: '15' },
        ]),
      };

      const service = new AnalyticsService(mockPrisma as never, mockClickHouse as never);
      const result = await service.getStudentActivity('t1', 'weekly');

      expect(mockClickHouse.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = {tenantId:UUID}'),
        { tenantId: 't1' },
      );
      expect(result).toEqual([
        { day: '2026-04-29', count: 12 },
        { day: '2026-04-30', count: 15 },
      ]);
    });
  });
```

`mockPrisma` ga `analyticsEvent.update` mock ham qo'shish kerak (mavjud mock'lar yonida):
```ts
analyticsEvent: {
  create: jest.fn(),
  update: jest.fn(),  // YANGI
  findMany: jest.fn(),
},
```

---

## Phase 2 — Quality Gates va Commit

- [ ] **Step 1: Prisma migration apply va client regenerate**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse && npx prisma generate && npx prisma migrate deploy 2>&1 | tail -5
```

Kutilgan: client generated, migration applied.

- [ ] **Step 2: TypeScript check**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npx tsc --noEmit
```

Kutilgan: 0 errors.

- [ ] **Step 3: Lint changed files**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && node_modules/.bin/eslint --no-fix src/clickhouse src/analytics test/clickhouse.spec.ts test/analytics.spec.ts
```

Kutilgan: 0 errors. Prettier xatolar bo'lsa `--fix` bilan.

- [ ] **Step 4: Unit tests run**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm test -- --testPathPattern="(clickhouse|analytics)" --no-coverage 2>&1 | tail -15
```

Kutilgan: barcha yangi test'lar pass (4 ClickHouse + 5 dual-write + mavjudlar).

- [ ] **Step 5: Full test suite — regression check**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm test -- --no-coverage 2>&1 | tail -10
```

Kutilgan: yangi failures yo'q (4 ta baseline failures davom etadi).

- [ ] **Step 6: API build**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm run build 2>&1 | tail -5
```

Kutilgan: build pass. `dist/migrations/clickhouse/` da `.sql` fayllar bo'lishi kerak.

- [ ] **Step 7: Phase 2 single commit**

```bash
git -C d:/projects/alochi/.worktrees/faza4-clickhouse add \
  apps/api/src/migrations \
  apps/api/src/clickhouse/clickhouse.service.ts \
  apps/api/src/analytics/analytics.service.ts \
  apps/api/test/clickhouse.spec.ts \
  apps/api/test/analytics.spec.ts \
  apps/api/nest-cli.json \
  prisma/migrations/0019_analytics_synced_at \
  prisma/schema.prisma

git -C d:/projects/alochi/.worktrees/faza4-clickhouse commit -m "feat(analytics): dual-write events to PostgreSQL and ClickHouse

- ClickHouse schema: events MergeTree partitioned by month, ordered by tenant
- Materialized views: dau_daily (AggregatingMergeTree), lesson_failures (SummingMergeTree)
- Prisma migration 0019: AnalyticsEvent.syncedAt with partial index for retry queue
- AnalyticsService.logEvent: PG write awaited (audit), CH insert fire-and-forget
- On CH success: syncedAt set; on failure: stays null for cron retry
- getStudentActivity migrated to ClickHouse (event-based query)
- 9 new unit tests: 4 ClickHouseService + 5 dual-write reliability"
```

**Husky pre-commit hook** ishga tushadi.

---

# Phase 3: Backfill + Retry

**Maqsad:** Mavjud PostgreSQL `analytics_events` jadvalidagi event'larni ClickHouse'ga ko'chirish (one-shot script), va cron retry job (kunlik 03:00) `syncedAt IS NULL` event'larni qayta urinib sync qiladi.

**Phase commit:** Phase 3 oxirida.

---

## Task 3.1: Backfill script

**Files:**
- Create: `apps/api/src/migrations/clickhouse/backfill.ts`

- [ ] **Step 1: Script yaratish**

Create `apps/api/src/migrations/clickhouse/backfill.ts`:
```ts
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { ClickHouseService } from '../../clickhouse/clickhouse.service';

async function main() {
  const logger = new Logger('Backfill');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'error', 'warn'] });
  const prisma = app.get(PrismaService);
  const clickhouse = app.get(ClickHouseService);

  if (!clickhouse.isReady()) {
    logger.error('ClickHouse not ready — abort');
    await app.close();
    process.exit(1);
  }

  const BATCH = 1000;
  let cursor: Date | null = null;
  let total = 0;

  while (true) {
    const events = await prisma.analyticsEvent.findMany({
      where: cursor ? { createdAt: { gt: cursor } } : {},
      orderBy: { createdAt: 'asc' },
      take: BATCH,
    });
    if (events.length === 0) break;

    for (const event of events) {
      const data = (event.data ?? {}) as Record<string, unknown>;
      const lessonId = (data as { lessonId?: string }).lessonId ?? null;
      const sessionCount = (data as { sessionCount?: number }).sessionCount ?? 0;
      const isPresent = (data as { isPresent?: boolean }).isPresent;
      const isLate = (data as { isLate?: boolean }).isLate;
      const newStreak = (data as { newStreak?: number }).newStreak;

      try {
        await clickhouse.insertEvent({
          event_id: event.id,
          tenant_id: event.tenantId,
          event_type: event.eventType,
          student_id: event.studentId,
          branch_id: event.branchId,
          lesson_id: lessonId,
          session_count: sessionCount,
          is_present: isPresent === undefined ? null : isPresent ? 1 : 0,
          is_late: isLate === undefined ? null : isLate ? 1 : 0,
          new_streak: newStreak ?? null,
          data: JSON.stringify(data),
          created_at: event.createdAt.toISOString(),
        });
        await prisma.analyticsEvent.update({
          where: { id: event.id },
          data: { syncedAt: new Date() },
        });
        total++;
      } catch (e) {
        logger.warn(`Failed to backfill event ${event.id}: ${(e as Error).message}`);
      }
    }
    cursor = events[events.length - 1].createdAt;
    logger.log(`Processed ${total} events (cursor: ${cursor.toISOString()})`);
  }

  logger.log(`Backfill complete. Total events synced: ${total}`);
  await app.close();
  process.exit(0);
}

main().catch((e) => {
  console.error('Backfill error:', e);
  process.exit(1);
});
```

**Idempotency:** ClickHouse `events` jadvali UUID primary keyless (deduplication ENGINE = ReplacingMergeTree ishlatmaydi), shuning uchun re-running script duplicate'lar yaratadi. Backfill **bir martalik** ishlatiladi — qayta ishlatishdan oldin avval `TRUNCATE TABLE events` qilish kerak (bu manual operation qoladi).

Alternative: filter `where: { syncedAt: null }` qo'shish — **only unsynced**'ni sync qiladi, idempotent.

Yangilanish: `findMany` query'sini quyidagicha qiling:
```ts
const events = await prisma.analyticsEvent.findMany({
  where: cursor
    ? { createdAt: { gt: cursor }, syncedAt: null }
    : { syncedAt: null },
  orderBy: { createdAt: 'asc' },
  take: BATCH,
});
```

Bu yondashuv idempotent — har gal faqat `syncedAt = null` event'larni sync qiladi.

---

## Task 3.2: package.json'da script qo'shish

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: scripts ostiga qo'shish**

`apps/api/package.json`'da `scripts` ostiga qo'shing (boshqa scripts yonida):
```json
"migrate:clickhouse-backfill": "ts-node src/migrations/clickhouse/backfill.ts"
```

`ts-node` mavjud devDependency bo'lishi kerak. Tekshiring; bo'lmasa:
```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse && pnpm add -D ts-node --filter api
```

---

## Task 3.3: Cron retry job

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts`

- [ ] **Step 1: Mavjud cron.service.ts o'qish**

```bash
cat d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api/src/cron/cron.service.ts
```

Bilish: imports, constructor, mavjud cron methods.

- [ ] **Step 2: Import qo'shish**

`cron.service.ts` boshiga (boshqa import'lar yonida):
```ts
import { ClickHouseService } from '../clickhouse/clickhouse.service';
```

- [ ] **Step 3: Constructor'ga inject qo'shish**

`CronService` constructor'iga (mavjud `private adaptive`, `private churn` yonida):
```ts
private clickhouse: ClickHouseService,
```

- [ ] **Step 4: Yangi cron method qo'shish**

`runChurnScoring` method'idan keyin (yoki sinf oxirida) qo'shing:
```ts
@Cron('0 3 * * *', { name: 'clickhouse_retry' })
async runClickHouseRetry() {
  this.logger.log('Cron: ClickHouse retry boshlanmoqda...');
  if (!this.clickhouse.isReady()) {
    this.logger.warn('ClickHouse not ready, skip retry');
    return;
  }
  const BATCH = 1000;
  const unsynced = await this.prisma.analyticsEvent.findMany({
    where: { syncedAt: null },
    take: BATCH,
    orderBy: { createdAt: 'asc' },
  });
  let synced = 0;
  for (const event of unsynced) {
    const data = (event.data ?? {}) as Record<string, unknown>;
    const lessonId = (data as { lessonId?: string }).lessonId ?? null;
    const sessionCount = (data as { sessionCount?: number }).sessionCount ?? 0;
    const isPresent = (data as { isPresent?: boolean }).isPresent;
    const isLate = (data as { isLate?: boolean }).isLate;
    const newStreak = (data as { newStreak?: number }).newStreak;

    try {
      await this.clickhouse.insertEvent({
        event_id: event.id,
        tenant_id: event.tenantId,
        event_type: event.eventType,
        student_id: event.studentId,
        branch_id: event.branchId,
        lesson_id: lessonId,
        session_count: sessionCount,
        is_present: isPresent === undefined ? null : isPresent ? 1 : 0,
        is_late: isLate === undefined ? null : isLate ? 1 : 0,
        new_streak: newStreak ?? null,
        data: JSON.stringify(data),
        created_at: event.createdAt.toISOString(),
      });
      await this.prisma.analyticsEvent.update({
        where: { id: event.id },
        data: { syncedAt: new Date() },
      });
      synced++;
    } catch (e) {
      this.logger.warn(`ClickHouse retry failed for event ${event.id}: ${(e as Error).message}`);
    }
  }
  this.logger.log(`ClickHouse retry: ${synced}/${unsynced.length} events synced`);
}
```

- [ ] **Step 5: Mavjud cron test'lar buzilmasligini tekshirish**

`test/cron.spec.ts` mavjud test'lari TestingModule ishlatadi va pre-existing failed (DI). Yangi `clickhouse` injection mavjud baseline failures'ni o'zgartirmaydi.

`src/cron/cron.spec.ts` ham TestingModule, bir xil holat. Yangi failure'ga olib kelmasligi kerak — chunki mavjud failure'lar `TelegramService` missing tufayli bo'lgan, ClickHouse'ni qo'shish vaziyatni o'zgartirmaydi.

---

## Phase 3 — Quality Gates va Commit

- [ ] **Step 1: TypeScript check**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npx tsc --noEmit
```

Kutilgan: 0 errors.

- [ ] **Step 2: Lint**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && node_modules/.bin/eslint --no-fix src/migrations src/cron/cron.service.ts
```

Kutilgan: 0 errors.

- [ ] **Step 3: Tests run**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm test -- --no-coverage 2>&1 | tail -10
```

Kutilgan: yangi failures yo'q (4 ta baseline'lar davom etadi, src/cron va test/cron yangi field bilan baribir TestingModule fail qiladi — bu pre-existing).

- [ ] **Step 4: API build**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm run build 2>&1 | tail -5
```

Kutilgan: build pass.

- [ ] **Step 5: Phase 3 commit**

```bash
git -C d:/projects/alochi/.worktrees/faza4-clickhouse add \
  apps/api/src/migrations/clickhouse/backfill.ts \
  apps/api/src/cron/cron.service.ts \
  apps/api/package.json \
  pnpm-lock.yaml

git -C d:/projects/alochi/.worktrees/faza4-clickhouse commit -m "feat(analytics): backfill script + nightly retry cron for ClickHouse sync

- backfill.ts: idempotent one-shot PG -> CH sync (filters syncedAt IS NULL)
- npm script: migrate:clickhouse-backfill
- CronService.runClickHouseRetry: nightly 03:00 catch-up for unsynced events
- Batch size 1000, fail-safe per-event try/catch (one bad event won't stop batch)"
```

---

# Phase 4: New OLAP Queries

**Maqsad:** AnalyticsService'ga 5 ta yangi method qo'shish (cohort, funnel, lifecycle, top failures, tenant comparison) va analytics.controller.ts'ga 5 ta yangi endpoint.

**Phase commit:** Phase 4 oxirida.

---

## Task 4.1: 5 ta yangi method AnalyticsService'da

**Files:**
- Modify: `apps/api/src/analytics/analytics.service.ts`

- [ ] **Step 1: Method'larni qo'shish**

`AnalyticsService` ichida (mavjud `getStudentActivity` keyin, `logEvent`'dan oldin) qo'shing:

```ts
async getCohortRetention(
  tenantId: string,
  weeks = 8,
): Promise<Array<{ cohortWeek: string; size: number; retention: Record<string, number> }>> {
  type Row = { cohort_week: string; week_offset: string; cohort_size: string; active: string };
  const rows = await this.clickhouse.query<Row>(
    `WITH cohort AS (
       SELECT
         tenant_id,
         student_id,
         toStartOfWeek(min(created_at)) AS cohort_week
       FROM events
       WHERE tenant_id = {tenantId:UUID} AND student_id IS NOT NULL
       GROUP BY tenant_id, student_id
     ),
     activity AS (
       SELECT
         e.tenant_id,
         c.cohort_week,
         dateDiff('week', c.cohort_week, toStartOfWeek(e.created_at)) AS week_offset,
         e.student_id
       FROM events e
       INNER JOIN cohort c ON e.student_id = c.student_id AND e.tenant_id = c.tenant_id
       WHERE e.tenant_id = {tenantId:UUID}
         AND c.cohort_week >= today() - INTERVAL {weeks:UInt16} WEEK
     )
     SELECT
       toString(cohort_week) AS cohort_week,
       toString(week_offset) AS week_offset,
       toString(uniqExact(student_id) OVER (PARTITION BY cohort_week)) AS cohort_size,
       toString(uniqExact(student_id)) AS active
     FROM activity
     WHERE week_offset >= 0 AND week_offset <= {weeks:UInt16}
     GROUP BY cohort_week, week_offset
     ORDER BY cohort_week DESC, week_offset ASC`,
    { tenantId, weeks },
  );

  const grouped = new Map<string, { size: number; retention: Record<string, number> }>();
  for (const r of rows) {
    const cohortWeek = r.cohort_week;
    const offset = Number(r.week_offset);
    const size = Number(r.cohort_size);
    const active = Number(r.active);
    const pct = size === 0 ? 0 : Math.round((active * 100) / size);
    if (!grouped.has(cohortWeek)) {
      grouped.set(cohortWeek, { size, retention: {} });
    }
    const entry = grouped.get(cohortWeek)!;
    entry.size = size;
    if (offset >= 0) entry.retention[`week${offset}`] = pct;
  }
  return Array.from(grouped.entries()).map(([cohortWeek, v]) => ({
    cohortWeek,
    size: v.size,
    retention: v.retention,
  }));
}

async getFunnel(
  tenantId: string,
  lessonId: string,
): Promise<Array<{ step: string; count: number }>> {
  // Steps for a lesson: started (lesson_session) -> failed_count -> completed
  const rows = await this.clickhouse.query<{ event_type: string; cnt: string }>(
    `SELECT event_type, toString(uniqExact(student_id)) AS cnt
     FROM events
     WHERE tenant_id = {tenantId:UUID}
       AND lesson_id = {lessonId:UUID}
       AND event_type IN ('lesson_session', 'lesson_failed', 'lesson_completed')
     GROUP BY event_type`,
    { tenantId, lessonId },
  );
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.event_type] = Number(r.cnt);

  return [
    { step: 'Sessiya boshlangan', count: counts['lesson_session'] ?? 0 },
    { step: 'Test topshirgan', count: (counts['lesson_session'] ?? 0) - (counts['lesson_failed'] ?? 0) },
    { step: 'Muvaffaqiyatli yakunlangan', count: counts['lesson_completed'] ?? 0 },
  ];
}

async getLifecycle(
  tenantId: string,
): Promise<{ dau: number; wau: number; mau: number; stickiness: number }> {
  const rows = await this.clickhouse.query<{ dau: string; wau: string; mau: string }>(
    `SELECT
       toString(uniqExactIf(student_id, created_at >= now() - INTERVAL 1 DAY)) AS dau,
       toString(uniqExactIf(student_id, created_at >= now() - INTERVAL 7 DAY)) AS wau,
       toString(uniqExactIf(student_id, created_at >= now() - INTERVAL 30 DAY)) AS mau
     FROM events
     WHERE tenant_id = {tenantId:UUID} AND student_id IS NOT NULL`,
    { tenantId },
  );
  if (rows.length === 0) return { dau: 0, wau: 0, mau: 0, stickiness: 0 };
  const dau = Number(rows[0].dau);
  const wau = Number(rows[0].wau);
  const mau = Number(rows[0].mau);
  const stickiness = mau === 0 ? 0 : Math.round((dau * 100) / mau) / 100;
  return { dau, wau, mau, stickiness };
}

async getTopFailures(
  tenantId: string,
  limit = 10,
): Promise<Array<{ lessonId: string; failedCount: number; completedCount: number; failureRate: number }>> {
  const rows = await this.clickhouse.query<{
    lesson_id: string;
    failed: string;
    completed: string;
  }>(
    `SELECT
       toString(lesson_id) AS lesson_id,
       toString(sum(failed_count)) AS failed,
       toString(sum(completed_count)) AS completed
     FROM lesson_failures
     WHERE tenant_id = {tenantId:UUID}
     GROUP BY lesson_id
     HAVING failed > 0
     ORDER BY failed DESC
     LIMIT {limit:UInt16}`,
    { tenantId, limit },
  );
  return rows.map((r) => {
    const failed = Number(r.failed);
    const completed = Number(r.completed);
    const total = failed + completed;
    return {
      lessonId: r.lesson_id,
      failedCount: failed,
      completedCount: completed,
      failureRate: total === 0 ? 0 : Math.round((failed * 100) / total),
    };
  });
}

async getTenantComparison(): Promise<
  Array<{ tenantId: string; tenantName: string; dau: number; eventsLast30d: number }>
> {
  // Cross-tenant comparison — superadmin only. Tenant names from PostgreSQL.
  const tenants = await this.prisma.tenant.findMany({
    select: { id: true, name: true },
    where: { status: 'active' },
  });

  if (tenants.length === 0) return [];

  // Build IN-list for ClickHouse via parameterized array
  const tenantIds = tenants.map((t) => t.id);
  const rows = await this.clickhouse.query<{
    tenant_id: string;
    dau: string;
    events_30d: string;
  }>(
    `SELECT
       toString(tenant_id) AS tenant_id,
       toString(uniqExactIf(student_id, created_at >= now() - INTERVAL 1 DAY)) AS dau,
       toString(countIf(created_at >= now() - INTERVAL 30 DAY)) AS events_30d
     FROM events
     WHERE tenant_id IN {tenantIds:Array(UUID)}
     GROUP BY tenant_id`,
    { tenantIds },
  );

  const statsMap = new Map<string, { dau: number; eventsLast30d: number }>();
  for (const r of rows) {
    statsMap.set(r.tenant_id, { dau: Number(r.dau), eventsLast30d: Number(r.events_30d) });
  }

  return tenants.map((t) => ({
    tenantId: t.id,
    tenantName: t.name,
    dau: statsMap.get(t.id)?.dau ?? 0,
    eventsLast30d: statsMap.get(t.id)?.eventsLast30d ?? 0,
  }));
}
```

---

## Task 4.2: 5 ta yangi endpoint controller'da

**Files:**
- Modify: `apps/api/src/analytics/analytics.controller.ts`

- [ ] **Step 1: Mavjud controller o'qish**

```bash
cat d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api/src/analytics/analytics.controller.ts
```

- [ ] **Step 2: Yangi endpoint'lar qo'shish**

Mavjud `@Get('lessons')`, `@Get('branches')`, `@Get('activity')` endpoint'lari yonida (controller class ichida):
```ts
@Get('cohort')
@Roles(UserRole.superadmin, UserRole.filadmin)
getCohort(@Req() req: any, @Query('weeks') weeks?: string) {
  const w = weeks ? Math.min(Math.max(parseInt(weeks, 10) || 8, 1), 26) : 8;
  return this.analytics.getCohortRetention(req.user.tenantId, w);
}

@Get('funnel/:lessonId')
@Roles(UserRole.superadmin, UserRole.filadmin)
getFunnel(@Req() req: any, @Param('lessonId') lessonId: string) {
  return this.analytics.getFunnel(req.user.tenantId, lessonId);
}

@Get('lifecycle')
@Roles(UserRole.superadmin, UserRole.filadmin)
getLifecycle(@Req() req: any) {
  return this.analytics.getLifecycle(req.user.tenantId);
}

@Get('failures')
@Roles(UserRole.superadmin, UserRole.filadmin)
getFailures(@Req() req: any, @Query('limit') limit?: string) {
  const lim = limit ? Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100) : 10;
  return this.analytics.getTopFailures(req.user.tenantId, lim);
}

@Get('comparison')
@Roles(UserRole.superadmin)
getComparison() {
  return this.analytics.getTenantComparison();
}
```

Imports'ga qo'shish (zarur bo'lsa):
```ts
import { Param, Query } from '@nestjs/common';
```

(Mavjud bo'lsa skip — `@Get('activity')` da `@Query` ishlatilgan ehtimol allaqachon import qilingan.)

---

## Task 4.3: Yangi query'lar uchun unit tests

**Files:**
- Modify: `apps/api/test/analytics.spec.ts`

- [ ] **Step 1: 5 ta yangi test qo'shish**

`apps/api/test/analytics.spec.ts` oxiriga (`describe('logEvent (dual-write)')` blokining oxirida yoki yangi describe blok bilan):

```ts
  // ============================================================
  // Phase 4: New OLAP query tests
  // ============================================================
  describe('OLAP queries', () => {
    function makeService(chRows: unknown[] = []) {
      const mockClickHouse = {
        isReady: jest.fn().mockReturnValue(true),
        insertEvent: jest.fn(),
        query: jest.fn().mockResolvedValue(chRows),
      };
      const service = new AnalyticsService(mockPrisma as never, mockClickHouse as never);
      return { service, mockClickHouse };
    }

    it('getCohortRetention queries ClickHouse with tenantId and weeks param', async () => {
      const { service, mockClickHouse } = makeService([
        { cohort_week: '2026-04-20', week_offset: '0', cohort_size: '10', active: '10' },
        { cohort_week: '2026-04-20', week_offset: '1', cohort_size: '10', active: '8' },
      ]);
      const result = await service.getCohortRetention('t1', 8);

      expect(mockClickHouse.query).toHaveBeenCalledWith(
        expect.stringContaining('cohort'),
        expect.objectContaining({ tenantId: 't1', weeks: 8 }),
      );
      expect(result).toEqual([
        { cohortWeek: '2026-04-20', size: 10, retention: { week0: 100, week1: 80 } },
      ]);
    });

    it('getFunnel returns ordered steps with drop-off', async () => {
      const { service } = makeService([
        { event_type: 'lesson_session', cnt: '100' },
        { event_type: 'lesson_failed', cnt: '20' },
        { event_type: 'lesson_completed', cnt: '70' },
      ]);
      const result = await service.getFunnel('t1', 'l1');
      expect(result).toEqual([
        { step: 'Sessiya boshlangan', count: 100 },
        { step: 'Test topshirgan', count: 80 },
        { step: 'Muvaffaqiyatli yakunlangan', count: 70 },
      ]);
    });

    it('getLifecycle returns DAU/WAU/MAU/stickiness', async () => {
      const { service } = makeService([{ dau: '20', wau: '60', mau: '120' }]);
      const result = await service.getLifecycle('t1');
      expect(result).toEqual({ dau: 20, wau: 60, mau: 120, stickiness: 0.17 });
    });

    it('getTopFailures returns sorted lessons with failure rate', async () => {
      const { service } = makeService([
        { lesson_id: 'l1', failed: '50', completed: '50' },
        { lesson_id: 'l2', failed: '30', completed: '70' },
      ]);
      const result = await service.getTopFailures('t1', 10);
      expect(result).toEqual([
        { lessonId: 'l1', failedCount: 50, completedCount: 50, failureRate: 50 },
        { lessonId: 'l2', failedCount: 30, completedCount: 70, failureRate: 30 },
      ]);
    });

    it('getTenantComparison joins PG tenants with CH stats', async () => {
      mockPrisma.tenant.findMany.mockResolvedValue([
        { id: 't1', name: 'Markaz Bir' },
        { id: 't2', name: 'Markaz Ikki' },
      ]);
      const { service } = makeService([
        { tenant_id: 't1', dau: '15', events_30d: '500' },
        // t2 no events
      ]);
      const result = await service.getTenantComparison();
      expect(result).toEqual([
        { tenantId: 't1', tenantName: 'Markaz Bir', dau: 15, eventsLast30d: 500 },
        { tenantId: 't2', tenantName: 'Markaz Ikki', dau: 0, eventsLast30d: 0 },
      ]);
    });
  });
```

`mockPrisma` ga `tenant.findMany` qo'shish (mavjud mock'lar yonida):
```ts
tenant: {
  findMany: jest.fn(),
},
```

---

## Phase 4 — Quality Gates va Commit

- [ ] **Step 1: TypeScript check**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npx tsc --noEmit
```

Kutilgan: 0 errors.

- [ ] **Step 2: Lint**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && node_modules/.bin/eslint --no-fix src/analytics test/analytics.spec.ts
```

Kutilgan: 0 errors.

- [ ] **Step 3: Tests**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm test -- --testPathPattern="test/analytics" --no-coverage 2>&1 | tail -10
```

Kutilgan: hammasi pass (mavjud + 5 dual-write + 5 OLAP).

- [ ] **Step 4: Build**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Phase 4 commit**

```bash
git -C d:/projects/alochi/.worktrees/faza4-clickhouse add \
  apps/api/src/analytics \
  apps/api/test/analytics.spec.ts

git -C d:/projects/alochi/.worktrees/faza4-clickhouse commit -m "feat(analytics): 5 ClickHouse OLAP query methods + endpoints

- getCohortRetention: weekly cohort × week_offset retention matrix
- getFunnel: per-lesson step counts (started -> passed -> completed)
- getLifecycle: DAU/WAU/MAU + stickiness ratio
- getTopFailures: lessons with most failures + failure rate
- getTenantComparison: cross-tenant DAU + 30d event counts (superadmin only)
- 5 controller endpoints with role guards
- 5 unit tests covering query parameterization, mapping, and PG+CH join"
```

---

# Phase 5: Frontend Tabbed Dashboard

**Maqsad:** `/superadmin/analytics` sahifasini tab navigation'li dashboard'ga qayta dizayn qilish, mavjud 3 ta tab'ni komponentga ko'chirish, 5 ta yangi tab qo'shish.

**Phase commit:** Phase 5 oxirida.

---

## Task 5.1: Tabbed shell + URL hash sync

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/analytics/page.tsx`

- [ ] **Step 1: To'liq fayl rewrite**

`apps/web/app/(dashboard)/superadmin/analytics/page.tsx` ni quyidagicha qayta yozing:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { ActivityTab } from './_components/ActivityTab';
import { LessonsTab } from './_components/LessonsTab';
import { BranchesTab } from './_components/BranchesTab';
import { CohortTab } from './_components/CohortTab';
import { FunnelTab } from './_components/FunnelTab';
import { LifecycleTab } from './_components/LifecycleTab';
import { FailuresTab } from './_components/FailuresTab';
import { ComparisonTab } from './_components/ComparisonTab';

type TabId =
  | 'activity'
  | 'lessons'
  | 'branches'
  | 'cohort'
  | 'funnel'
  | 'lifecycle'
  | 'failures'
  | 'comparison';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'activity', label: 'Faollik' },
  { id: 'lessons', label: 'Darslar' },
  { id: 'branches', label: 'Filiallar' },
  { id: 'cohort', label: 'Cohort' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'failures', label: 'Failures' },
  { id: 'comparison', label: 'Markazlar' },
];

function isValidTab(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}

export default function AnalyticsPage() {
  const [active, setActive] = useState<TabId>('activity');

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && isValidTab(hash)) setActive(hash);
  }, []);

  function changeTab(id: TabId) {
    setActive(id);
    window.location.hash = id;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-green-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
      </div>

      <div className="border-b border-slate-700 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => changeTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              active === tab.id
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-800/40 rounded-xl p-6">
        {active === 'activity' && <ActivityTab />}
        {active === 'lessons' && <LessonsTab />}
        {active === 'branches' && <BranchesTab />}
        {active === 'cohort' && <CohortTab />}
        {active === 'funnel' && <FunnelTab />}
        {active === 'lifecycle' && <LifecycleTab />}
        {active === 'failures' && <FailuresTab />}
        {active === 'comparison' && <ComparisonTab />}
      </div>
    </div>
  );
}
```

---

## Task 5.2: ActivityTab (mavjud line chart'ni ko'chirish)

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/ActivityTab.tsx`

- [ ] **Step 1: Mavjud sahifadagi activity chart'ni yangi komponentga ko'chirish**

Create `apps/web/app/(dashboard)/superadmin/analytics/_components/ActivityTab.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiRequest } from '@/lib/api';

interface ActivityPoint {
  day: string;
  count: number;
}

export function ActivityTab() {
  const [data, setData] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ActivityPoint[]>('/analytics/activity?period=monthly', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">So&apos;nggi 30 kun — Faol o&apos;quvchilar</h2>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
          <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

---

## Task 5.3: LessonsTab + BranchesTab (mavjud table'larni ko'chirish)

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/LessonsTab.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/BranchesTab.tsx`

- [ ] **Step 1: LessonsTab**

Create `apps/web/app/(dashboard)/superadmin/analytics/_components/LessonsTab.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface LessonStat {
  lessonId: string;
  passRate: number;
  totalStudents: number;
  passed: number;
  avgSessions: number;
  feedbackAvg: number | null;
}

export function LessonsTab() {
  const [lessons, setLessons] = useState<LessonStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<LessonStat[]>('/analytics/lessons', {}, token)
      .then((r) => setLessons(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Darslar Samaradorligi</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400">Dars ID</th>
              <th className="text-center px-3 py-2 text-slate-400">Pass rate</th>
              <th className="text-center px-3 py-2 text-slate-400">O&apos;quvchilar</th>
              <th className="text-center px-3 py-2 text-slate-400">O&apos;rt. sessiya</th>
              <th className="text-center px-3 py-2 text-slate-400">Fikr</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.lessonId} className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-300 font-mono text-xs">{l.lessonId.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-center">
                  <span className={l.passRate >= 70 ? 'text-green-400' : l.passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                    {l.passRate}%
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-slate-300">{l.totalStudents}</td>
                <td className="px-3 py-2 text-center text-slate-300">{l.avgSessions}</td>
                <td className="px-3 py-2 text-center text-slate-300">{l.feedbackAvg ?? '—'}</td>
              </tr>
            ))}
            {lessons.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Ma&apos;lumot yo&apos;q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: BranchesTab**

Create `apps/web/app/(dashboard)/superadmin/analytics/_components/BranchesTab.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface BranchStat {
  branchId: string;
  activeStudents: number;
  avgStreak: number;
  avgXp: number;
}

export function BranchesTab() {
  const [branches, setBranches] = useState<BranchStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<BranchStat[]>('/analytics/branches', {}, token)
      .then((r) => setBranches(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Filiallar Taqqoslash</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400">Filial</th>
              <th className="text-center px-3 py-2 text-slate-400">Faol o&apos;quvchilar</th>
              <th className="text-center px-3 py-2 text-slate-400">O&apos;rt. streak</th>
              <th className="text-center px-3 py-2 text-slate-400">O&apos;rt. XP</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.branchId} className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-300 font-mono text-xs">{b.branchId.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-center text-white font-semibold">{b.activeStudents}</td>
                <td className="px-3 py-2 text-center text-blue-400">{b.avgStreak}</td>
                <td className="px-3 py-2 text-center text-purple-400">{b.avgXp}</td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">Ma&apos;lumot yo&apos;q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Task 5.4: CohortTab (heatmap)

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/CohortTab.tsx`

- [ ] **Step 1: Yaratish**

Create `apps/web/app/(dashboard)/superadmin/analytics/_components/CohortTab.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface CohortRow {
  cohortWeek: string;
  size: number;
  retention: Record<string, number>;
}

const WEEK_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function CohortTab() {
  const [data, setData] = useState<CohortRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<CohortRow[]>('/analytics/cohort?weeks=8', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Cohort Retention (8 hafta)</h2>
      {data.length === 0 ? (
        <p className="text-slate-500 text-sm">Ma&apos;lumot yo&apos;q</p>
      ) : (
        <div className="space-y-2 overflow-x-auto">
          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
            <span className="w-28">Cohort</span>
            <span className="w-12 text-right">Hajm</span>
            {WEEK_OFFSETS.map((w) => (
              <span key={w} className="w-12 text-center">W{w}</span>
            ))}
          </div>
          {data.map((row) => (
            <div key={row.cohortWeek} className="flex items-center gap-1">
              <span className="w-28 text-xs text-slate-300 font-mono">{row.cohortWeek}</span>
              <span className="w-12 text-xs text-slate-300 text-right">{row.size}</span>
              {WEEK_OFFSETS.map((w) => {
                const value = row.retention[`week${w}`] ?? 0;
                const opacity = Math.min(value / 100, 1);
                return (
                  <div
                    key={w}
                    className="w-12 h-9 rounded text-xs flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: `rgba(16, 185, 129, ${opacity})`, border: '1px solid #1e293b' }}
                  >
                    {value > 0 ? `${value}%` : '—'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Task 5.5: FunnelTab (lesson selector + bar chart)

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/FunnelTab.tsx`

- [ ] **Step 1: Yaratish**

Create `apps/web/app/(dashboard)/superadmin/analytics/_components/FunnelTab.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { apiRequest } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
}

interface FunnelStep {
  step: string;
  count: number;
}

export function FunnelTab() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lesson[]>('/lessons', {}, token)
      .then((r) => {
        setLessons(r.data);
        if (r.data.length > 0) setSelectedLessonId(r.data[0].id);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedLessonId) return;
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<FunnelStep[]>(`/analytics/funnel/${selectedLessonId}`, {}, token)
      .then((r) => setFunnel(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'));
  }, [selectedLessonId]);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Funnel Analysis</h2>
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1.5">Dars tanlang</label>
        <select
          value={selectedLessonId}
          onChange={(e) => setSelectedLessonId(e.target.value)}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
        >
          {lessons.map((l) => (
            <option key={l.id} value={l.id}>{l.title}</option>
          ))}
        </select>
      </div>
      {funnel.length > 0 && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={funnel} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis dataKey="step" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={140} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
            <Bar dataKey="count" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

---

## Task 5.6: LifecycleTab (4 stat cards)

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/LifecycleTab.tsx`

- [ ] **Step 1: Yaratish**

Create `apps/web/app/(dashboard)/superadmin/analytics/_components/LifecycleTab.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { Activity, Users, UserCheck, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface Lifecycle {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
}

export function LifecycleTab() {
  const [data, setData] = useState<Lifecycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lifecycle>('/analytics/lifecycle', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;
  if (!data) return null;

  const cards = [
    { label: 'DAU', value: data.dau, sub: 'Daily Active Users', Icon: Activity, color: 'text-emerald-400' },
    { label: 'WAU', value: data.wau, sub: 'Weekly Active Users', Icon: Users, color: 'text-blue-400' },
    { label: 'MAU', value: data.mau, sub: 'Monthly Active Users', Icon: UserCheck, color: 'text-purple-400' },
    { label: 'Stickiness', value: `${(data.stickiness * 100).toFixed(0)}%`, sub: 'DAU/MAU ratio', Icon: Zap, color: 'text-amber-400' },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Lifecycle Metrics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-slate-900/60 border border-slate-700 rounded-xl p-5">
            <c.Icon size={20} className={c.color} />
            <p className="text-3xl font-bold text-white mt-3">{c.value}</p>
            <p className="text-xs text-slate-400 mt-1">{c.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Task 5.7: FailuresTab + ComparisonTab

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/FailuresTab.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/_components/ComparisonTab.tsx`

- [ ] **Step 1: FailuresTab**

Create `apps/web/app/(dashboard)/superadmin/analytics/_components/FailuresTab.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface Failure {
  lessonId: string;
  failedCount: number;
  completedCount: number;
  failureRate: number;
}

export function FailuresTab() {
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Failure[]>('/analytics/failures?limit=20', {}, token)
      .then((r) => setFailures(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Top Failure Lessons</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400">Dars ID</th>
              <th className="text-center px-3 py-2 text-slate-400">Failed</th>
              <th className="text-center px-3 py-2 text-slate-400">Completed</th>
              <th className="text-center px-3 py-2 text-slate-400">Failure rate</th>
            </tr>
          </thead>
          <tbody>
            {failures.map((f) => (
              <tr key={f.lessonId} className="border-b border-slate-700/50">
                <td className="px-3 py-2 text-slate-300 font-mono text-xs">{f.lessonId.slice(0, 8)}...</td>
                <td className="px-3 py-2 text-center text-red-400 font-semibold">{f.failedCount}</td>
                <td className="px-3 py-2 text-center text-green-400">{f.completedCount}</td>
                <td className="px-3 py-2 text-center">
                  <span className={f.failureRate >= 50 ? 'text-red-400' : f.failureRate >= 30 ? 'text-yellow-400' : 'text-slate-300'}>
                    {f.failureRate}%
                  </span>
                </td>
              </tr>
            ))}
            {failures.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">Failures yo&apos;q — ajoyib!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ComparisonTab (faqat superadmin)**

Create `apps/web/app/(dashboard)/superadmin/analytics/_components/ComparisonTab.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

interface TenantRow {
  tenantId: string;
  tenantName: string;
  dau: number;
  eventsLast30d: number;
}

export function ComparisonTab() {
  const [data, setData] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<TenantRow[]>('/analytics/comparison', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-slate-400 text-sm">Yuklanmoqda...</p>;
  if (error) return <p className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</p>;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Markazlar Taqqoslash (faqat superadmin)</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-3 py-2 text-slate-400">Markaz</th>
              <th className="text-center px-3 py-2 text-slate-400">DAU</th>
              <th className="text-center px-3 py-2 text-slate-400">Event'lar (30 kun)</th>
            </tr>
          </thead>
          <tbody>
            {data
              .slice()
              .sort((a, b) => b.eventsLast30d - a.eventsLast30d)
              .map((t) => (
                <tr key={t.tenantId} className="border-b border-slate-700/50">
                  <td className="px-3 py-2 text-white font-medium">{t.tenantName}</td>
                  <td className="px-3 py-2 text-center text-emerald-400 font-semibold">{t.dau}</td>
                  <td className="px-3 py-2 text-center text-slate-300">{t.eventsLast30d}</td>
                </tr>
              ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={3} className="p-8 text-center text-slate-500">Markazlar yo&apos;q</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Phase 5 — Quality Gates va Commit

- [ ] **Step 1: TypeScript check (web)**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/web && node_modules/.bin/tsc --noEmit
```

Kutilgan: 0 errors.

- [ ] **Step 2: Lint changed files**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/web && node_modules/.bin/eslint --no-fix "app/(dashboard)/superadmin/analytics"
```

Kutilgan: 0 errors.

- [ ] **Step 3: Web production build**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/web && pnpm build 2>&1 | tail -10
```

Kutilgan: build pass, `/superadmin/analytics` route output'da ko'rinishi kerak.

- [ ] **Step 4: Phase 5 commit**

```bash
git -C d:/projects/alochi/.worktrees/faza4-clickhouse add "apps/web/app/(dashboard)/superadmin/analytics"

git -C d:/projects/alochi/.worktrees/faza4-clickhouse commit -m "feat(web): tabbed analytics dashboard with 8 tabs

- Page shell: TabId enum, URL hash sync (/superadmin/analytics#cohort)
- ActivityTab/LessonsTab/BranchesTab: extracted from prior single-page layout
- CohortTab: 8-week retention heatmap with opacity-based color fill
- FunnelTab: lesson selector + horizontal bar chart (recharts)
- LifecycleTab: 4 stat cards (DAU/WAU/MAU/Stickiness)
- FailuresTab: top 20 lessons with failure rate threshold colors
- ComparisonTab: cross-tenant DAU and 30d event volume (superadmin)"
```

---

# Phase 6: Integration Verification

**Maqsad:** End-to-end manual test — Docker compose up, dual-write ishlash, retry queue, backfill, frontend tab'lar.

**Phase commit:** Bu phase'da kod o'zgarishi yo'q. Agar e2e xato chiqsa — tegishli phase'ga qaytib `fix:` commit qo'shiladi.

---

## Task 6.1: Docker compose start

**Files:** None (verification only)

- [ ] **Step 1: Docker stack up**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse && docker compose up -d clickhouse db 2>&1 | tail -5
```

Kutilgan: 2 ta service started.

- [ ] **Step 2: Health check**

```bash
sleep 15 && docker compose ps clickhouse
```

Kutilgan: `clickhouse` health=healthy.

```bash
curl -s http://localhost:8123/ping
```

Kutilgan: `Ok.`

---

## Task 6.2: API + migrations + dual-write

**Files:** None

- [ ] **Step 1: Prisma migrations**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse && npx prisma migrate deploy 2>&1 | tail -5
```

Kutilgan: migration `0019_analytics_synced_at` mavjud yoki applied.

- [ ] **Step 2: API ishga tushirish (yangi terminal)**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm run start:dev 2>&1 | head -50
```

Kutilgan log'lar:
- `ClickHouse connected`
- `Applied migration 001_create_events.sql`
- `Applied migration 002_create_mvs.sql`
- `Nest application successfully started`

- [ ] **Step 3: ClickHouse'da jadval mavjudligini tekshirish**

```bash
curl -s 'http://localhost:8123/?user=alochi&password=changeme_dev_password&database=alochi_analytics' --data-binary 'SHOW TABLES'
```

Kutilgan output'da: `events`, `dau_daily`, `lesson_failures`.

- [ ] **Step 4: Dual-write test — submit qilingan event ikkita joyda**

API'ga login qilib lesson sessiyasi yakunlash (boshqa terminal yoki Postman):
```bash
# Login first to get token (existing superadmin)
TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"superadmin","password":"Test1234!"}' | jq -r '.data.accessToken')

# Submit a lesson session as student (need student token in real test)
# For smoke test, just check existing events were synced via cron retry
```

Real to'liq dual-write test student/manager tokens orqali sessiya yakunlash bilan amalga oshiriladi. Hozircha smoke check yetarli:
```bash
PGPASSWORD='Test1234!' "C:/Program Files/PostgreSQL/18/bin/psql.exe" -U app_user -h localhost -d alochi_db \
  -c "SELECT COUNT(*) FROM analytics_events WHERE created_at >= NOW() - INTERVAL '5 minutes';"
```

```bash
curl -s 'http://localhost:8123/?user=alochi&password=changeme_dev_password&database=alochi_analytics' \
  --data-binary 'SELECT COUNT(*) FROM events WHERE created_at >= now() - INTERVAL 5 MINUTE'
```

Yangi yaratilgan event ikkala'da ham hisoblanishi kerak.

---

## Task 6.3: ClickHouse downtime + retry

**Files:** None

- [ ] **Step 1: ClickHouse to'xtatish (API ishlamoqda)**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse && docker compose stop clickhouse
```

- [ ] **Step 2: Submit event (PG'ga yoziladi, CH'ga emas)**

Lesson sessiyasini yakunlash (oldindagi qadamdek). PG'da event paydo bo'ladi, lekin `synced_at IS NULL`.

```bash
PGPASSWORD='Test1234!' "C:/Program Files/PostgreSQL/18/bin/psql.exe" -U app_user -h localhost -d alochi_db \
  -c "SELECT id, event_type, synced_at FROM analytics_events WHERE synced_at IS NULL ORDER BY created_at DESC LIMIT 5;"
```

Kutilgan: yangi yaratilgan event'lar `synced_at = NULL`.

- [ ] **Step 3: ClickHouse qaytarish**

```bash
docker compose start clickhouse && sleep 15
```

- [ ] **Step 4: Manual retry trigger**

Cron 03:00 da avtomatik ishlaydi. Manual sinash uchun **backfill script ishlatish** (bir xil mantiq):

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/api && npm run migrate:clickhouse-backfill 2>&1 | tail -10
```

Kutilgan: `Backfill complete. Total events synced: N`.

```bash
PGPASSWORD='Test1234!' "C:/Program Files/PostgreSQL/18/bin/psql.exe" -U app_user -h localhost -d alochi_db \
  -c "SELECT COUNT(*) FROM analytics_events WHERE synced_at IS NULL;"
```

Kutilgan: `0` (hammasi sync qilindi).

---

## Task 6.4: Frontend tab'lar

**Files:** None

- [ ] **Step 1: Web ishga tushirish**

```bash
cd d:/projects/alochi/.worktrees/faza4-clickhouse/apps/web && npm run start 2>&1 | head -10
```

(Avval `pnpm build` qilingan bo'lishi kerak.)

- [ ] **Step 2: Brauzer'da `/superadmin/analytics`**

Login: superadmin / Test1234!. Sahifa: `http://localhost:3000/superadmin/analytics`

8 ta tab'ni navbat bilan bosish:
1. **Faollik** — line chart, raqamlar yoki bo'sh state
2. **Darslar** — jadval, raqamlar yoki bo'sh state
3. **Filiallar** — jadval
4. **Cohort** — heatmap matrix (8 hafta × 9 ustun)
5. **Funnel** — lesson selector + bar chart (lesson tanlash kerak)
6. **Lifecycle** — 4 ta stat card
7. **Failures** — jadval (top 20 darslar)
8. **Markazlar** — jadval (faqat superadmin'da ko'rinadi)

Har tab — yuklash holati yoki data ko'rsatadi. Console error'lar yo'q.

- [ ] **Step 3: URL hash sync**

`#cohort` → tab Cohort active. URL'ni qo'lda `#funnel` ga o'zgartirib reload — Funnel tab active.

---

## Task 6.5: Cleanup va Phase 6 yakuni

- [ ] **Step 1: Test natijalarini hujjatlash**

```
Phase 6 Manual E2E Results:
- Docker compose up: PASS / FAIL
- API startup + migrations: PASS / FAIL
- Dual-write: PG + CH event counts match: PASS / FAIL
- CH downtime → PG event with synced_at=NULL: PASS / FAIL
- CH up → backfill catches up: PASS / FAIL
- Frontend 8 tabs: PASS / FAIL (per-tab list if any FAIL)
- URL hash sync: PASS / FAIL
```

Agar biror qadam FAIL — tegishli Phase'ga qaytib `fix:` commit qo'shiladi.

- [ ] **Step 2: Docker cleanup**

```bash
docker compose stop clickhouse db
```

(Tutib qolish ixtiyoriy.)

- [ ] **Step 3: Kod commit yo'q** — Phase 6 verification only.

---

## Self-Review

**Spec coverage** (har spec bandi qaysi task'da yopiladi):

| Spec section | Phase / Task |
|---|---|
| §3 Infra (docker, env) | Phase 1, Tasks 1.1–1.2 |
| §4.1 events table | Phase 2, Task 2.1 |
| §4.2 Materialized views | Phase 2, Task 2.1 |
| §5.1 ClickHouseService | Phase 1, Task 1.4 + Phase 2, Task 2.2 |
| §5.2 Dual-write | Phase 2, Task 2.4 |
| §5.3 5 query method'lar | Phase 4, Task 4.1 |
| §5.4 Cron retry | Phase 3, Task 3.3 |
| §5.5 Backfill script | Phase 3, Task 3.1 |
| §6 5 endpoints | Phase 4, Task 4.2 |
| §7 Frontend tabbed | Phase 5, Tasks 5.1–5.7 |
| §8 Testing | Phase 2 (clickhouse.spec, dual-write tests), Phase 4 (5 OLAP tests) |
| §9 Xavfsizlik | Implicit — Roles guards in Phase 4, parameterized queries throughout |
| §10 Migration phases | Plan 6 phase'ga to'g'ri keldi |
| §12 Acceptance criteria | Phase 6 manual e2e |

**Type consistency:**
- `ClickHouseEvent` interface Phase 1 da defined, Phase 2/3 da ishlatiladi.
- `getCohortRetention` return type frontend `CohortRow` bilan mos.
- `getFunnel` returns `Array<{ step: string; count: number }>` — frontend `FunnelStep` bilan mos.
- `getLifecycle` return mos `Lifecycle` interface.
- `getTopFailures` return `Failure` bilan mos.
- `getTenantComparison` return `TenantRow` bilan mos.

**Placeholder scan:** Hech qaysi step'da "TBD", "implement later" yo'q. Har bir code block to'liq.

**Scope check:** Single subsystem (ClickHouse analytics). 6 phase mantiqiy bo'lingan: infra → schema/dual-write → backfill/retry → queries → frontend → verification. Plan to'g'ri sklillangan.
