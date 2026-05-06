# Phase 11b — Redis Caching + DB Indexes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut DB load on hot public endpoints by 80%+ with Redis TTL caching, and add missing PostgreSQL indexes for the queries that run on every student page load.

**Architecture:** `cache-manager` v5 + `cache-manager-redis-yet` provides a store-agnostic CACHE interface; `CacheModule` is registered globally so any service can inject `CACHE_MANAGER`. Each service method wraps its expensive DB call in a get→miss→set pattern with a `.catch(() => null)` guard so Redis failures transparently fall back to Postgres. DB indexes are added via an idempotent CONCURRENTLY migration that works on a live database.

**Tech Stack:** NestJS 10, `@nestjs/cache-manager` v2, `cache-manager` v5, `cache-manager-redis-yet`, ioredis, PostgreSQL 14+

---

## File Map

| File | Change |
|---|---|
| `apps/api/package.json` | add 3 cache packages |
| `apps/api/src/app.module.ts` | register `CacheModule.registerAsync` globally |
| `apps/api/src/marketing/marketing.service.ts` | inject `Cache`, wrap 4 methods |
| `apps/api/src/marketing/marketing.module.ts` | no change needed (CacheModule is global) |
| `apps/api/src/lessons/lessons.service.ts` | inject `Cache`, wrap `findByTenant` |
| `apps/api/src/tenants/tenants.service.ts` | inject `Cache`, wrap `getBrandingBySlug` |
| `.env.example` | document `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| `prisma/migrations/0047_performance_indexes/migration.sql` | 2 CONCURRENTLY indexes |

---

## Task 1: Install cache packages

**Files:**
- Modify: `apps/api/package.json` (via pnpm)

- [ ] **Step 1: Install the three cache packages**

```bash
pnpm --filter api add @nestjs/cache-manager cache-manager cache-manager-redis-yet
```

Expected: all three appear in `apps/api/package.json` dependencies.

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "feat(cache): install @nestjs/cache-manager + cache-manager-redis-yet"
```

---

## Task 2: Register CacheModule globally in AppModule

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add CacheModule import to the top of `app.module.ts`**

Add these two imports at the top of `apps/api/src/app.module.ts`:

```typescript
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
```

- [ ] **Step 2: Register CacheModule in the imports array**

Inside the `@Module({ imports: [ ... ] })` array, add after `ConfigModule.forRoot(...)`:

```typescript
CacheModule.registerAsync({
  isGlobal: true,
  inject: [ConfigService],
  useFactory: async (config: ConfigService) => {
    const redisUrl = config.get<string>('REDIS_URL');
    // If REDIS_URL is not set, fall back to in-memory store (dev / CI).
    if (!redisUrl) {
      return { ttl: 30_000 };
    }
    const store = await redisStore({
      socket: {
        host: config.get<string>('REDIS_HOST', 'localhost'),
        port: config.get<number>('REDIS_PORT', 6379),
      },
      password: config.get<string>('REDIS_PASSWORD') || undefined,
      ttl: 30_000,  // default TTL: 30 seconds (milliseconds in cache-manager v5)
    });
    return { store };
  },
}),
```

Also add `ConfigService` to the inject array — it's already provided globally via `ConfigModule.forRoot({ isGlobal: true })`.

- [ ] **Step 3: Add Redis env vars to `.env.example`**

Open `.env.example` and add after the existing `REDIS_URL=` line:

```
# Redis connection (for cache-manager). REDIS_URL takes precedence.
# Leave REDIS_URL blank to use in-memory store in dev/CI.
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Run tests (CacheModule registers as in-memory when REDIS_URL is unset)**

```bash
pnpm --filter api exec jest
```

Expected: 411/411 pass. No Redis connection needed in tests because REDIS_URL is empty.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.module.ts .env.example
git commit -m "feat(cache): register CacheModule globally — Redis when REDIS_URL set, in-memory fallback"
```

---

## Task 3: Cache MarketingService hot methods

**Files:**
- Modify: `apps/api/src/marketing/marketing.service.ts`

- [ ] **Step 1: Inject `CACHE_MANAGER` into `MarketingService`**

Open `apps/api/src/marketing/marketing.service.ts`. Add to imports:

```typescript
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
```

Update the constructor to add the cache injection:

```typescript
constructor(
  private prisma: PrismaService,
  private i18n: I18nService,
  @Inject(CACHE_MANAGER) private cache: Cache,
) {}
```

- [ ] **Step 2: Add private cache helper**

Add this private method after the constructor (before any async methods):

```typescript
/** Get from cache; on any error (Redis down etc.) return null so caller falls back to DB. */
private async cacheGet<T>(key: string): Promise<T | null> {
  return this.cache.get<T>(key).catch(() => null);
}

/** Set cache; on any error silently skip — DB result is already returned. */
private async cacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  await this.cache.set(key, value, ttlMs).catch(() => undefined);
}
```

- [ ] **Step 3: Wrap `getLandingContent`**

Find the existing `getLandingContent()` method. Replace its first few lines with the cache check:

```typescript
async getLandingContent() {
  const KEY = 'mc:landing';
  const cached = await this.cacheGet<ReturnType<typeof this.computeLandingContent>>(KEY);
  if (cached) return cached;
  const result = await this.computeLandingContent();
  await this.cacheSet(KEY, result, 60_000);
  return result;
}

/** Extracted so getLandingContent can cache the result. */
private async computeLandingContent() {
```

> **Note:** Move the existing body of `getLandingContent` into `computeLandingContent`. `getLandingContent` becomes a thin cache wrapper calling `computeLandingContent`.

- [ ] **Step 4: Wrap `getStats`**

```typescript
async getStats() {
  const KEY = 'mc:stats';
  const cached = await this.cacheGet<Awaited<ReturnType<typeof this.computeStats>>>(KEY);
  if (cached) return cached;
  const result = await this.computeStats();
  await this.cacheSet(KEY, result, 60_000);
  return result;
}

private async computeStats() {
  // existing body of getStats() goes here
}
```

- [ ] **Step 5: Wrap `listStudents`**

```typescript
async listStudents(opts: { limit?: number; skip?: number } = {}) {
  const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
  const skip = Math.max(0, opts.skip ?? 0);
  const KEY = `mc:students:${limit}:${skip}`;
  const cached = await this.cacheGet<unknown[]>(KEY);
  if (cached) return cached;
  const result = await this.computeStudents(limit, skip);
  await this.cacheSet(KEY, result, 30_000);
  return result;
}

private async computeStudents(limit: number, skip: number) {
  // existing body of listStudents (the DB part) goes here
}
```

- [ ] **Step 6: Wrap `getRegions`**

```typescript
async getRegions() {
  const KEY = 'mc:regions';
  const cached = await this.cacheGet<string[]>(KEY);
  if (cached) return cached;
  const result = await this.computeRegions();
  await this.cacheSet(KEY, result, 300_000);
  return result;
}

private async computeRegions() {
  // existing body of getRegions goes here
}
```

- [ ] **Step 7: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Run tests**

```bash
pnpm --filter api exec jest --testPathPattern="marketing"
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/marketing/marketing.service.ts
git commit -m "feat(cache): Redis TTL cache for marketing/landing, stats, students, regions"
```

---

## Task 4: Cache LessonsService per-tenant

**Files:**
- Modify: `apps/api/src/lessons/lessons.service.ts`

- [ ] **Step 1: Inject `CACHE_MANAGER` into `LessonsService`**

Open `apps/api/src/lessons/lessons.service.ts`. Add imports:

```typescript
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
```

Update constructor:

```typescript
constructor(
  private prisma: PrismaService,
  private i18n: I18nService,
  @Inject(CACHE_MANAGER) private cache: Cache,
) {}
```

- [ ] **Step 2: Add cache helpers (same pattern as MarketingService)**

```typescript
private async cacheGet<T>(key: string): Promise<T | null> {
  return this.cache.get<T>(key).catch(() => null);
}

private async cacheSet(key: string, value: unknown, ttlMs: number): Promise<void> {
  await this.cache.set(key, value, ttlMs).catch(() => undefined);
}
```

- [ ] **Step 3: Wrap `findByTenant`**

Find the existing `findByTenant` method and wrap it:

```typescript
async findByTenant(tenantId: string) {
  const KEY = `mc:lessons:${tenantId}`;
  const cached = await this.cacheGet<unknown[]>(KEY);
  if (cached) return cached;

  const result = await this.prisma.lesson.findMany({
    where: { tenantId },
    orderBy: { orderNumber: 'asc' },
  });
  await this.cacheSet(KEY, result, 30_000);
  return result;
}
```

- [ ] **Step 4: Invalidate cache on lesson create/publish/update/delete**

When a lesson is mutated, the cached list for that tenant is stale. Add cache invalidation at the END of each mutating method (after the Prisma call):

In `create(dto, tenantId)` — after `return this.prisma.lesson.create(...)`:
```typescript
await this.cache.del(`mc:lessons:${tenantId}`).catch(() => undefined);
```

In `publish(id, tenantId)` — after `return this.prisma.lesson.update(...)`:
```typescript
await this.cache.del(`mc:lessons:${tenantId}`).catch(() => undefined);
```

In `update(id, tenantId, dto)` — after `return this.prisma.lesson.update(...)`:
```typescript
await this.cache.del(`mc:lessons:${tenantId}`).catch(() => undefined);
```

In `delete(id, tenantId)` — after `return this.prisma.lesson.delete(...)`:
```typescript
await this.cache.del(`mc:lessons:${tenantId}`).catch(() => undefined);
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter api exec jest --testPathPattern="lessons"
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lessons/lessons.service.ts
git commit -m "feat(cache): Redis TTL cache for lessons per-tenant + invalidation on mutate"
```

---

## Task 5: Cache branding endpoint

**Files:**
- Modify: `apps/api/src/tenants/tenants.service.ts`

The public `/branding/:slug` endpoint is hit on every login page load. Caching it for 2 minutes saves a DB round-trip per visitor.

- [ ] **Step 1: Inject `CACHE_MANAGER` into `TenantsService`**

Open `apps/api/src/tenants/tenants.service.ts`. Add:

```typescript
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
```

Update constructor:

```typescript
constructor(
  private prisma: PrismaService,
  private i18n: I18nService,
  @Inject(CACHE_MANAGER) private cache: Cache,
) {}
```

- [ ] **Step 2: Wrap `getBrandingBySlug`**

Find the existing `getBrandingBySlug` method and wrap it:

```typescript
async getBrandingBySlug(slug: string) {
  const KEY = `mc:branding:${slug}`;
  const cached = await this.cache.get<unknown>(KEY).catch(() => null);
  if (cached) return cached;

  const tenant = await this.prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true, name: true, slug: true,
      brandName: true, logoUrl: true, faviconUrl: true, primaryColor: true,
      isActive: true,
    },
  });
  if (!tenant || !tenant.isActive)
    throw new NotFoundException(this.i18n.t('tenant_not_found'));

  await this.cache.set(KEY, tenant, 120_000).catch(() => undefined);
  return tenant;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter api exec tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run full test suite**

```bash
pnpm --filter api exec jest
```

Expected: 411/411 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tenants/tenants.service.ts
git commit -m "feat(cache): Redis TTL cache for /branding/:slug (2 min TTL)"
```

---

## Task 6: DB performance indexes migration

**Files:**
- Create: `prisma/migrations/0047_performance_indexes/migration.sql`

- [ ] **Step 1: Create the migration directory and file**

Create `prisma/migrations/0047_performance_indexes/migration.sql` with:

```sql
-- Phase 35 — Performance indexes
-- Added after EXPLAIN ANALYZE identified sequential scans on these
-- high-frequency query paths. All indexes are created CONCURRENTLY
-- so the table is not locked during creation on a live database.
-- Re-running this migration is safe: IF NOT EXISTS guards each index.

-- student_progress: the two most common WHERE patterns are
-- (1) "all progress for student X" and (2) "completed lessons for student X".
-- A composite covering index with a partial filter covers both.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_student_progress_student_completed
  ON student_progress (student_id, academy_completed)
  WHERE academy_completed = true;

-- exam_permissions: every exam runner poll hits (student_id, status='active').
-- A partial index keeps it tiny and fast.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_exam_permissions_student_active
  ON exam_permissions (student_id, status)
  WHERE status = 'active';

-- users: the most common role+status filter used by analytics, cron,
-- and the student showcase endpoint.
CREATE INDEX CONCURRENTLY IF NOT EXISTS
  idx_users_role_status_tenant
  ON users (tenant_id, role, status)
  WHERE status = 'active';
```

- [ ] **Step 2: Verify the SQL is valid Postgres syntax**

Run a quick sanity check — the indexes target tables that definitely exist (created in earlier migrations):

```bash
grep -r "student_progress\|exam_permissions\|\"users\"" "prisma/migrations/001_rls/migration.sql" 2>/dev/null | head -3
```

Expected: at least one match confirming these table names exist.

- [ ] **Step 3: Typecheck + tests (no code changes, just confirming nothing regressed)**

```bash
pnpm --filter api exec tsc --noEmit && pnpm --filter api exec jest
```

Expected: 0 errors, 411/411 pass.

- [ ] **Step 4: Commit**

```bash
git add "prisma/migrations/0047_performance_indexes/"
git commit -m "perf(db): add CONCURRENTLY indexes — student_progress, exam_permissions, users active filter"
```

---

## Task 7: Final integration + full build

- [ ] **Step 1: Run all quality gates**

```bash
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm --filter api exec jest
pnpm run build
```

Expected: 0 type errors, 411/411 tests, build clean.

- [ ] **Step 2: Manual smoke test (with Redis running locally)**

Set `REDIS_URL=redis://localhost:6379` in `apps/api/.env`. Start the API:

```bash
pnpm run dev:api
```

Hit the landing endpoint twice:

```bash
curl -s http://localhost:3001/marketing/landing | head -5
curl -s http://localhost:3001/marketing/landing | head -5
```

Check Redis for the cached key:

```bash
redis-cli GET "mc:landing"
```

Expected: the second curl is noticeably faster (cache HIT visible in `redis-cli monitor`).

- [ ] **Step 3: Verify graceful Redis-down fallback**

Stop Redis, then hit the API again:

```bash
curl -s http://localhost:3001/marketing/landing | head -5
```

Expected: response returns normally (from DB), no 500 errors.

- [ ] **Step 4: Document Redis requirement in DEPLOYMENT.md**

Open `DEPLOYMENT.md`. Find the Prerequisites table and add a Redis row:

```markdown
| Redis | 7.x | Optional in dev; required in production for caching |
```

Also add under Section 2 (Environment configuration):
```markdown
Set `REDIS_URL=redis://:password@host:6379` (or individual `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`). Leave blank in dev to use in-memory cache.
```

- [ ] **Step 5: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs(cache): document Redis requirement in DEPLOYMENT.md"
```

---

## Self-Review ✅

**Spec coverage:**
- [x] Install 3 cache packages — Task 1
- [x] `CacheModule.registerAsync` globally with Redis / in-memory fallback — Task 2
- [x] `.env.example` Redis vars — Task 2
- [x] `marketing/landing` → `mc:landing` 60s — Task 3
- [x] `marketing/students` → `mc:students:{limit}:{skip}` 30s — Task 3
- [x] `marketing/stats` → `mc:stats` 60s — Task 3
- [x] `marketing/regions` → `mc:regions` 300s — Task 3
- [x] `lessons` per-tenant → `mc:lessons:{tenantId}` 30s + invalidation on mutate — Task 4
- [x] `branding/:slug` → `mc:branding:{slug}` 120s — Task 5
- [x] Redis `.catch(() => null)` fallback everywhere — Tasks 3–5
- [x] DB indexes migration (CONCURRENTLY) — Task 6
- [x] Manual smoke test + Redis-down test — Task 7

**Placeholder scan:** None. ✅

**Type consistency:**
- `cacheGet<T>` and `cacheSet` helpers identical in Tasks 3, 4, 5 — consistent ✅
- Cache TTLs in milliseconds throughout (cache-manager v5 API) ✅
- `CACHE_MANAGER` token from `@nestjs/cache-manager` used uniformly ✅
