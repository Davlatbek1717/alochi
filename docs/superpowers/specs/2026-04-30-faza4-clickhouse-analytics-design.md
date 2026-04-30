# Faza 4 — ClickHouse Analytics Design

**Goal:** Event-based analytics'ni ClickHouse'ga ko'chirish, 5 ta yangi OLAP query qo'shish (cohort retention, funnel, lifecycle, top failures, tenant comparison), state-based aggregations PostgreSQL'da qoldirish. Dual-write reliability bilan.

**Scope:** Yangi ClickHouse infra (docker), schema + materialized views, dual-write sync, 5 ta yangi backend endpoint, tabbed frontend dashboard. Email/notification yo'q. Real-time CDC yo'q (dual-write).

---

## 1. Maqsad va biznes mantiqi

**Holat:** Hozirgi PostgreSQL `analytics_events` jadvali kichik scale uchun yetarli (10-100 markaz). Lekin event-based OLAP queries (cohort, funnel) PostgreSQL'da:
- Index pressure (millionlab event'lar)
- `GROUP BY` + window functions sekin
- Materialized view refresh resurs talab qiladi (PostgreSQL'da)

ClickHouse OLAP'i:
- Columnar storage → 10-100x tezroq aggregat
- LowCardinality optimization (event_type)
- Native window functions cohort uchun
- Real-time MERGE engine

**Maqsad:** Event analytics ClickHouse'ga ko'chirish (state aggregations PostgreSQL'da qoladi), 5 ta yangi OLAP query qo'shish, tabbed dashboard.

**Cheklovlar (YAGNI):**
- Real-time CDC (Debezium, Kafka) — **yo'q**, dual-write yetarli
- ClickHouse'da auth granularity — **yo'q**, bitta user
- Read-only replicas — **yo'q**, single instance
- Sharding — **yo'q**, bitta shard
- Custom dashboards (foydalanuvchi yaratadi) — **yo'q**, fixed tabs

---

## 2. Arxitektura

```
┌──────────────────────────────────────────┐
│  PostgreSQL (source of truth)            │
│  - User, StudentProgress, StudentXp ...  │  ← business state
│  - lesson_stats_mv, branch_stats_mv      │  ← state aggregation MVs
│  - analytics_events (audit + buffer)     │  ← every event written here first
└──────────────────────────────────────────┘
              │
              │  dual-write on AnalyticsService.logEvent
              │  (fire-and-forget INSERT to ClickHouse)
              ▼
┌──────────────────────────────────────────┐
│  ClickHouse (analytics warehouse)        │
│  - events (denormalized, MergeTree)      │
│  - cohort_weekly (MV)                    │
│  - dau_daily (MV)                        │
│  - lesson_failures (MV)                  │
└──────────────────────────────────────────┘
```

**Reliability invariant:**
- Har event PostgreSQL'ga yoziladi (transactional, never lost)
- ClickHouse'ga ham yoziladi (best effort + retry)
- ClickHouse down → event'lar PG'da kutadi → cron 03:00'da retry qiladi
- Backfill script har vaqt yangidan PG → CH ko'chirishi mumkin (idempotent)

**Query routing:**

| Query turi | Source | Misol |
|-----------|--------|-------|
| State aggregations | PostgreSQL MV | `getLessonStats`, `getBranchStats` |
| Event aggregations | ClickHouse | `getStudentActivity`, `getCohortRetention`, `getFunnel`, `getLifecycle`, `getTopFailures`, `getTenantComparison` |

---

## 3. ClickHouse infra

**`docker-compose.yml` ga qo'shiladi:**
```yaml
  clickhouse:
    image: clickhouse/clickhouse-server:24.8-alpine
    container_name: alochi_clickhouse
    environment:
      CLICKHOUSE_USER: alochi
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
      CLICKHOUSE_DB: alochi_analytics
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
    ports:
      - '8123:8123'    # HTTP
      - '9000:9000'    # native (faqat docker network ichida ishlatiladi)
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    healthcheck:
      test: ['CMD', 'wget', '--no-verbose', '--tries=1', '--spider', 'http://localhost:8123/ping']
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    # ...mavjud konfiguratsiya
    depends_on:
      db:
        condition: service_healthy
      clickhouse:
        condition: service_healthy
    environment:
      # ...mavjud env'lar
      CLICKHOUSE_URL: http://clickhouse:8123
      CLICKHOUSE_USER: alochi
      CLICKHOUSE_PASSWORD: ${CLICKHOUSE_PASSWORD}
      CLICKHOUSE_DB: alochi_analytics

volumes:
  db_data:
  clickhouse_data:
```

**`.env` qo'shiladi:**
```
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=alochi
CLICKHOUSE_PASSWORD=changeme_secure_password
CLICKHOUSE_DB=alochi_analytics
```

**`.env.example` ham yangilanadi.**

---

## 4. ClickHouse schema

### 4.1 Asosiy `events` jadvali

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
  data          String,                  -- forward-compat raw JSON
  created_at    DateTime64(3) DEFAULT now64()
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (tenant_id, event_type, created_at, student_id);
```

**Dizayn tanlovlari:**
- `LowCardinality(String)` — event_type uchun (~5 unique qiymat)
- `PARTITION BY toYYYYMM(created_at)` — oy bo'yicha partition, eski oylarni TRUNCATE qilish oson (90 kun retention'da)
- `ORDER BY (tenant_id, ...)` — tenant filter har query'da, prefix bo'lishi tezlik beradi
- Denormalized columns (`lesson_id`, `session_count`, `is_present`, `is_late`, `new_streak`) — JSON parse qilmaslik
- `data` raw JSON — yangi event turlari uchun forward-compat

### 4.2 Materialized views (query optimization)

**Cohort weekly** — boshlash haftasi va keyingi haftalar bo'yicha aktivlik:
```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS cohort_weekly
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(cohort_week)
ORDER BY (tenant_id, cohort_week, week_offset)
AS
SELECT
  tenant_id,
  toStartOfWeek(min(created_at)) OVER (PARTITION BY tenant_id, student_id) AS cohort_week,
  toStartOfWeek(created_at) AS active_week,
  dateDiff('week', cohort_week, active_week) AS week_offset,
  uniqState(student_id) AS active_students_state
FROM events
WHERE student_id IS NOT NULL
GROUP BY tenant_id, cohort_week, active_week;
```

**DAU daily**:
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
```

**Lesson failures**:
```sql
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

(Funnel va tenant comparison MV'siz query'lar — kichik to'plamlar)

---

## 5. Backend implementation

### 5.1 ClickHouse module

**`apps/api/src/clickhouse/clickhouse.module.ts`:**
```ts
@Global()
@Module({
  providers: [ClickHouseService],
  exports: [ClickHouseService],
})
export class ClickHouseModule {}
```

**`apps/api/src/clickhouse/clickhouse.service.ts`:**
```ts
@Injectable()
export class ClickHouseService implements OnModuleInit {
  private client: NodeClickHouseClient;
  private readonly logger = new Logger(ClickHouseService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    this.client = createClient({
      url: this.config.get('CLICKHOUSE_URL'),
      username: this.config.get('CLICKHOUSE_USER'),
      password: this.config.get('CLICKHOUSE_PASSWORD'),
      database: this.config.get('CLICKHOUSE_DB'),
    });
    await this.runMigrations();
  }

  async runMigrations() {
    const sqls = [
      readFileSync(join(__dirname, '../migrations/clickhouse/001_create_events.sql'), 'utf8'),
      readFileSync(join(__dirname, '../migrations/clickhouse/002_create_mvs.sql'), 'utf8'),
    ];
    for (const sql of sqls) {
      const statements = sql.split(';').filter((s) => s.trim());
      for (const stmt of statements) {
        await this.client.command({ query: stmt }).catch((e) => {
          this.logger.error(`Migration failed: ${e.message}`);
          throw e;
        });
      }
    }
    this.logger.log('ClickHouse migrations applied');
  }

  async insertEvent(event: ClickHouseEvent): Promise<void> {
    await this.client.insert({
      table: 'events',
      values: [event],
      format: 'JSONEachRow',
    });
  }

  async query<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    const rs = await this.client.query({
      query: sql,
      query_params: params,
      format: 'JSONEachRow',
    });
    return rs.json<T>();
  }
}
```

**Kutubxona:** `@clickhouse/client` (rasmiy, `^1.0.0`).

### 5.2 AnalyticsService dual-write

`apps/api/src/analytics/analytics.service.ts` `logEvent` o'zgartiriladi:

```ts
constructor(
  private prisma: PrismaService,
  private clickhouse: ClickHouseService,
) {}

async logEvent(params: {
  tenantId: string;
  eventType: string;
  studentId?: string;
  branchId?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  // 1. PostgreSQL (audit + reliability buffer) — must succeed
  const event = await this.prisma.analyticsEvent.create({
    data: {
      tenantId: params.tenantId,
      eventType: params.eventType,
      studentId: params.studentId,
      branchId: params.branchId,
      data: (params.data ?? {}) as Prisma.InputJsonValue,
    },
  });

  // 2. ClickHouse (analytics warehouse) — best effort, retry queue on failure
  this.clickhouse.insertEvent({
    event_id: event.id,
    tenant_id: event.tenantId,
    event_type: event.eventType,
    student_id: event.studentId,
    branch_id: event.branchId,
    lesson_id: (params.data as { lessonId?: string })?.lessonId,
    session_count: (params.data as { sessionCount?: number })?.sessionCount ?? 0,
    is_present: (params.data as { isPresent?: boolean })?.isPresent ? 1 : 0,
    is_late: (params.data as { isLate?: boolean })?.isLate ? 1 : 0,
    new_streak: (params.data as { newStreak?: number })?.newStreak,
    data: JSON.stringify(params.data ?? {}),
    created_at: event.createdAt.toISOString(),
  }).catch((e) => {
    // Mark for retry — cron 03:00 will pick up unsynced events
    void this.prisma.analyticsEvent.update({
      where: { id: event.id },
      data: { syncedAt: null },
    }).catch(() => {});
    this.logger.warn(`ClickHouse insert failed for event ${event.id}: ${e.message}`);
  });
}
```

**Schema o'zgarishi (Prisma):** `AnalyticsEvent` modeliga `syncedAt: DateTime?` qo'shiladi.
- NULL → ClickHouse'da hali yo'q yoki retry kutyapti
- DateTime → muvaffaqiyatli sync qilingan

`logEvent` ichida muvaffaqiyatli insert keyin `syncedAt = now()` ham yoziladi (oddiyligi uchun darhol oldindan yoziladi, fail bo'lsa null qaytariladi).

### 5.3 Yangi query method'lar (tafsilotlar plan'da)

5 ta yangi method `AnalyticsService`'ga qo'shiladi:
- `getCohortRetention(tenantId, weeks=8)` — cohort_weekly MV'dan
- `getFunnel(tenantId, lessonId)` — events jadvalidan window function
- `getLifecycle(tenantId)` — dau_daily MV'dan + DAU/WAU/MAU
- `getTopFailures(tenantId, limit=10)` — lesson_failures MV'dan + Lesson join
- `getTenantComparison()` — cross-tenant aggregat (faqat superadmin)

**Tenant filter har CH query'da majburiy** — superadmin'lik holatdan tashqari (comparison uchun).

### 5.4 Cron retry job

`apps/api/src/cron/cron.service.ts` ga yangi method qo'shiladi:

```ts
@Cron('0 3 * * *', { name: 'clickhouse_retry' })
async runClickHouseRetry() {
  this.logger.log('Cron: ClickHouse retry boshlanmoqda...');
  const unsynced = await this.prisma.analyticsEvent.findMany({
    where: { syncedAt: null },
    take: 1000,  // batch size
  });
  for (const event of unsynced) {
    try {
      await this.clickhouse.insertEvent({...});  // same mapping as logEvent
      await this.prisma.analyticsEvent.update({
        where: { id: event.id },
        data: { syncedAt: new Date() },
      });
    } catch (e) {
      this.logger.warn(`Retry failed for event ${event.id}: ${e.message}`);
    }
  }
  this.logger.log(`ClickHouse retry: ${unsynced.length} events processed`);
}
```

### 5.5 Backfill script

**`apps/api/src/migrations/clickhouse/backfill.ts`:**

One-shot Node.js script — barcha mavjud `analytics_events` (PostgreSQL) → ClickHouse `events` (idempotent, ON DUPLICATE skip via UUID).

Ishga tushirish: `npm run migrate:clickhouse-backfill`

---

## 6. API endpoints

`apps/api/src/analytics/analytics.controller.ts` 5 ta yangi route:

```ts
@Get('cohort')
@Roles(UserRole.superadmin, UserRole.filadmin)
getCohort(@Req() req, @Query('weeks') weeks?: string) {
  return this.analytics.getCohortRetention(req.user.tenantId, weeks ? +weeks : 8);
}

@Get('funnel/:lessonId')
@Roles(UserRole.superadmin, UserRole.filadmin)
getFunnel(@Req() req, @Param('lessonId') lessonId: string) {
  return this.analytics.getFunnel(req.user.tenantId, lessonId);
}

@Get('lifecycle')
@Roles(UserRole.superadmin, UserRole.filadmin)
getLifecycle(@Req() req) {
  return this.analytics.getLifecycle(req.user.tenantId);
}

@Get('failures')
@Roles(UserRole.superadmin, UserRole.filadmin)
getFailures(@Req() req, @Query('limit') limit?: string) {
  return this.analytics.getTopFailures(req.user.tenantId, limit ? +limit : 10);
}

@Get('comparison')
@Roles(UserRole.superadmin)  // FAQAT superadmin
getComparison() {
  return this.analytics.getTenantComparison();
}
```

---

## 7. Frontend

### 7.1 `/superadmin/analytics` qayta dizayn

Mavjud sahifa **tabbed dashboard**'ga o'tkaziladi. Tab state URL hash'da: `/superadmin/analytics#cohort`.

```
apps/web/app/(dashboard)/superadmin/analytics/
├── page.tsx                  # MODIFY — refactor as tabbed
└── _components/
    ├── ActivityTab.tsx       # MOVE — mavjud line chart (ClickHouse'dan)
    ├── LessonsTab.tsx        # MOVE — mavjud jadval (PostgreSQL)
    ├── BranchesTab.tsx       # MOVE — mavjud jadval (PostgreSQL)
    ├── CohortTab.tsx         # CREATE — heatmap (kalta jadval, percent fill)
    ├── FunnelTab.tsx         # CREATE — lesson selector + bar chart
    ├── LifecycleTab.tsx      # CREATE — 4 stat cards (DAU/WAU/MAU/Sticky)
    ├── FailuresTab.tsx       # CREATE — top 10 jadval + retry counts
    └── ComparisonTab.tsx     # CREATE — tenant compare jadval (faqat superadmin)
```

### 7.2 Tab UI

```
┌───────────────────────────────────────────────────────────────┐
│  📊 Analytics Dashboard                                        │
├───────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ Faollik │ │ Darslar │ │Filiall.│ │ Cohort │ │ Funnel │ ...│
│  └─────────┘ └─────────┘ └────────┘ └────────┘ └────────┘    │
│                                                                │
│  ─── Selected tab content ───                                  │
└───────────────────────────────────────────────────────────────┘
```

Active tab — slate-700 fon + emerald-400 underline. Inactive — slate-400 text, hover'da slate-300.

### 7.3 Cohort heatmap (custom)

`recharts`'da heatmap yo'q. Custom div grid:

```tsx
{cohorts.map(cohort => (
  <div key={cohort.cohortWeek} className="flex items-center gap-1">
    <span className="w-24 text-xs text-slate-400">{cohort.cohortWeek}</span>
    <span className="w-12 text-xs text-slate-300 text-right">{cohort.size}</span>
    {[1,2,3,4,5,6,7,8].map(weekOffset => {
      const value = cohort.retention[`week${weekOffset}`] ?? 0;
      const opacity = Math.min(value / 100, 1);
      return (
        <div
          key={weekOffset}
          className="w-12 h-8 rounded text-xs flex items-center justify-center"
          style={{ backgroundColor: `rgba(16, 185, 129, ${opacity})` }}
        >
          {value > 0 ? `${value}%` : '—'}
        </div>
      );
    })}
  </div>
))}
```

### 7.4 Funnel bar chart

`recharts` `BarChart` ishlatiladi:

```tsx
<BarChart data={steps} layout="vertical">
  <XAxis type="number" />
  <YAxis dataKey="step" type="category" width={120} />
  <Bar dataKey="count" fill="#10b981" />
</BarChart>
```

Drop-off foiz qator yonida ko'rsatiladi.

---

## 8. Testing

### 8.1 Unit tests

**`apps/api/src/clickhouse/clickhouse.spec.ts` (yangi)** — 4 test:
1. `executes parameterized query (no SQL injection)`
2. `inserts event with correct mapping`
3. `runMigrations applies all SQL statements`
4. `query throws on connection failure`

**`apps/api/test/analytics.spec.ts` (kengaytirildi)** — 5 yangi test:
1. `dual-write: logEvent calls both PG.create and CH.insertEvent`
2. `dual-write: PG succeeds, CH fails → syncedAt nulled, no throw`
3. `getCohortRetention queries cohort_weekly with tenant filter`
4. `getFunnel returns ordered steps with drop-off counts`
5. `getLifecycle returns DAU/WAU/MAU/stickiness`

### 8.2 Manual integration test

1. `docker compose up -d clickhouse` — service healthy
2. API startup → migrations run, `events` jadvali yaratiladi
3. POST progress completion → check both PG and CH have event
4. `docker compose stop clickhouse` → POST event → PG'da bor, retry queue (syncedAt=null)
5. `docker compose start clickhouse` → wait → retry cron → syncedAt = now
6. Backfill script run → barcha PG event'lar CH'da

### 8.3 E2E (Playwright)

- Login → `/superadmin/analytics` ochilishi
- Tab'lar bosish — har tab data yuklayapti
- Cohort tab heatmap raqamlar bilan
- Funnel tab — lesson selector → bar chart
- Comparison tab — faqat superadmin (filadmin uchun 403)

---

## 9. Xavfsizlik

1. **Tenant isolation:** Har CH query'da `tenant_id = {tenantId:UUID}` parameterized. Hech qachon string concat.
2. **Tenant comparison:** Faqat `@Roles(UserRole.superadmin)`.
3. **CH credentials:** `.env`'da, repo'ga commit emas. `.env.example`'da placeholder.
4. **CH ports 8123/9000:** docker network ichida, public expose **emas**.
5. **API user:** Bitta `alochi` user, hozircha bitta privilege. Read-only replica keyingi optimizatsiya.
6. **SQL injection:** ClickHouse client `query_params` ishlatiladi, hech qaysi query'da string concat yo'q.

---

## 10. Migration & rollout

**5 phase, har biri mustaqil deploy qilinadi:**

| Phase | Tarkib | Risk |
|-------|--------|------|
| 1 | ClickHouse infra (docker, env) | None — yangi service |
| 2 | Schema + dual-write yoqiladi | Low — fail bo'lsa logEvent davom etadi |
| 3 | Backfill mavjud event'lar | None — idempotent script |
| 4 | Yangi query'lar (5 ta) yoqiladi | None — yangi endpoint'lar |
| 5 | Frontend tabbed dashboard | None — UI rewrite |

**Rollback:** Har phase reversible:
- Phase 1 — `docker compose stop clickhouse`
- Phase 2 — `clickhouse.insertEvent` chaqirish'ni try/catch ichida — fail silent
- Phase 3 — backfill faqat insert, original data tegmaydi
- Phase 4 — yangi endpoint'lar, frontend yo'q chaqirmaydi
- Phase 5 — eski `/analytics` page rollback qilinadi (git revert)

---

## 11. Faza 4 ClickHouse'dan tashqari (kelajak)

| Xususiyat | Sabab |
|-----------|-------|
| Real-time CDC (Debezium + Kafka) | Murakkab, dual-write yetarli scale uchun |
| ClickHouse replicas + sharding | Bitta instance 100M event/oy ushlay oladi |
| Custom dashboards (foydalanuvchi yaratadi) | Fixed tabs yetarli MVP uchun |
| Anomaly detection | Alohida ML loyihasi |
| Data export (CSV) | Frontend'da `<button>` keyingi PR |
| Per-event TTL retention | Hozircha 90 kun PG, forever CH |
| ClickHouse'dan PG'ga reverse sync | Hech qaysi use case yo'q |

---

## 12. Acceptance Criteria

Implementation tayyor deb hisoblanadi qachon:

- [ ] `docker compose up` — ClickHouse healthy, migrations applied
- [ ] AnalyticsService.logEvent ikki joyga yozadi (PG + CH)
- [ ] CH down → event PG'da, retry queue to'ladi
- [ ] CH up → cron 03:00'da retry sync ishlaydi
- [ ] Backfill script: PG → CH, idempotent
- [ ] 5 ta yangi endpoint: cohort, funnel, lifecycle, failures, comparison
- [ ] `/superadmin/analytics` tabbed dashboard, 8 ta tab
- [ ] Cohort heatmap matrix shaklida
- [ ] Funnel bar chart drop-off bilan
- [ ] Lifecycle 4 ta stat card
- [ ] Tenant comparison — faqat superadmin (403 boshqa rollar uchun)
- [ ] Sacred quality bar: typecheck 0, lint 0, build OK, test'lar pass
- [ ] Manual e2e: yangi tab'lar yuklayapti, raqamlar to'g'ri
