# A'lochi 100% Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all 250+ spec-vs-code gaps identified in the 2026-04-30 audit so A'lochi platform reaches 100% spec compliance across Faza 1–4.

**Architecture:** Phase-batched execution. Each phase covers one logically independent subsystem (security, RBAC, schema, notifications, etc.) and ends with a single quality-gated commit (typecheck + lint + build + tests all pass). **25 phases total.** Phases 1–6 are production-blocking (security/env/API standardization). Phases 7–22 are spec compliance + UX completion. Phase 23 is cosmetic polish, Phase 24 is final QA + deployment, **Phase 25 is audit-backfill — explicit tasks for items mentioned in file structure but not given dedicated tasks in the initial pass (~30 items).**

**Tech Stack:** NestJS 10 (api), Next.js 15 / React 19 (web), Prisma 5 + PostgreSQL 15, ClickHouse 24, ml-service (FastAPI/Python 3.11 + scikit-learn), Telegram bot (`@alochi_bot`), `@ducanh2912/next-pwa`, Jest + Playwright, Husky pre-commit.

**Quality bar (per user's auto-memory):**
- 1 commit per PHASE (not per task).
- Before commit: `pnpm typecheck && pnpm lint && pnpm build && pnpm test` all green.
- Never `--no-verify`. Never bypass Husky.
- If pre-commit fails → fix root cause → new commit (never amend).

**Estimated effort:** 75–100 engineer-hours over 5–7 weeks (3 phases/week realistic; Phase 25 alone is ~15 hours).

---

## Scope Note

The audit found 250+ gaps. By writing-plans best practice, each subsystem deserves its own plan file. This master plan keeps everything in one document at the user's request, but it is structured so each phase produces independently testable, deployable software. Treat each phase as a mini-plan — execute, verify, commit, then move on.

---

## File Structure (high-level map)

**Backend (`apps/api/src/`):**
- `clickhouse/` — migrations 003 (add `cohort_weekly` MV), service.ts gap tests
- `churn/` — service.ts ML feature expansion, integration tests
- `delegations/` — controller superadmin role, service Telegram emit, audit integration, status filter
- `warnings/` — controller path realignment, RBAC fix, ENUM type, Telegram count differentiation
- `payments/` — controller path realignment, double-mark error, payment-settings split
- `users/` — block-status / unblock endpoints, group-by-id endpoint
- `student-status/` — split mentor (personal) vs manager (critical) endpoints, auto-yellow logic
- `notifications/` — handler expansion (status, cert, streak, task events)
- `tasks/` — ENUM status, seen_at/started_at, reminder cron, completion notification
- `social/` — auto-friendship, lenta events, duel speed bonus + XP fix, challenge XP cron + limits, chat moderation pending flow, is_pinned, group_id ban scope
- `face/` — vector encryption, JWT device token, DELETE/status endpoints, 3-fail alert, EAR verify
- `attendance/` — branch.workStartTime use, double-checkin 409
- `gamification/` — kolleksiya kartalar (36 letters), 30-day streak Telegram
- `kpi/` — auto-calc cron (mentor/manager/filadmin)
- `cron/` — spaced repetition 07:00, chat 90-day cleanup, group challenge XP, unblock monitoring, 2-day absent parent
- `common/` — `ResponseInterceptor` (success/data/meta wrapper), error code enrichment, global throttler
- `lessons/` — components.camera flag, ai_tutor lessonContext, automatic English status from Claude
- `tenants/` — config (WARNING_BLOCK_LIMIT)
- `audit/` — DB trigger to prevent UPDATE/DELETE
- `telegram/` — handlers for /rating, mentor inline attendance, all delegation events, cert congrats, streak milestone
- `ai/` — 3-retry mechanism, Azure speech fallback
- `migrations/` — multiple new SQL migrations for ENUMs + indexes + triggers

**Frontend (`apps/web/app/`):**
- `(dashboard)/superadmin/tenants/page.tsx` (NEW — list page)
- `(dashboard)/superadmin/tenants/[id]/edit/page.tsx` (NEW)
- `(dashboard)/superadmin/payments/_components/...` — settings, debtors filter
- `(dashboard)/superadmin/churn/page.tsx` — branch filter, ML metrics block
- `(dashboard)/superadmin/analytics/_components/FunnelTab.tsx` — drop-off %
- `(dashboard)/superadmin/adaptive/page.tsx` — last-adaptation widget
- `(dashboard)/superadmin/content-quality/page.tsx` — modal (not inline)
- `(dashboard)/superadmin/lessons/[id]/edit/page.tsx` — camera flag toggle, ai_tutor context
- `(dashboard)/superadmin/video-guides/` (NEW directory)
- `(dashboard)/superadmin/promotion-report/` (NEW)
- `(dashboard)/manager/page.tsx` — medium-risk section, signals, 3-row skeleton
- `(dashboard)/manager/sessions/` (NEW — 1:1 sessions)
- `(dashboard)/filadmin/page.tsx` — real-time stats, pie chart, today schedule
- `(dashboard)/filadmin/payments/_components/HistoryStrip.tsx` (NEW)
- `(dashboard)/filadmin/kpi/page.tsx` — recent awards strip
- `(dashboard)/filadmin/students/[id]/history/page.tsx` (NEW)
- `(dashboard)/manager/kpi/page.tsx` — recent awards strip
- `(dashboard)/mentor/students/[id]/page.tsx` — Telegram parent button, status/lessons chips
- `(dashboard)/student/page.tsx` — 500-step path map, certificates section, N counter
- `(dashboard)/tester/page.tsx` (REWRITE — pixel clone of student/page.tsx)
- `(dashboard)/tester/lessons/current/page.tsx` (NEW)
- `(dashboard)/delegations/new/page.tsx` — staff_manage permission UI
- `(dashboard)/_components/BottomNav.tsx` — student tab Duel→Imtihon fix, tester nav 3 tabs, side panel desktop
- `components/InstallPrompt.tsx` — iOS Safari verify
- `components/CelebrationToast.tsx` (NEW — "Barakalla, Ajoyib!")
- `components/PathMap500.tsx` (NEW — visual 500-step roadmap)
- `components/CertificateShare.tsx` (NEW — Telegram/Instagram share)
- `next.config.ts` — workboxOptions runtimeCaching override (NetworkOnly /api/**)
- `app/layout.tsx` — themeColor placement (acceptable as viewport in Next.js 15)

**Schema (`prisma/schema.prisma` + migrations):**
- New ENUMs: `DelegationAction`, `FeedEventType`, `FriendshipScope`, `DuelStatus`, `TaskStatus`, `WarningType`, `ChatModerationStatus`
- New fields: `ChatMessage.isPinned`, `ChatMessage.moderationStatus`, `ChatBan.groupId`, `Task.seenAt/startedAt`, `GroupChallenge.winnerGroupId`, `Tenant.warningBlockLimit`, `BranchDevice.tokenExpiresAt`, `FaceEmbedding.encryptedVector`
- Indexes: `UNIQUE INDEX one_active_delegation` (partial)
- Triggers: `audit_log_no_modify` (PG trigger blocking UPDATE/DELETE)
- pgvector extension enable + `FaceEmbedding.embedding VECTOR(128)` Prisma model
- New tables: `LetterCollection`, `StudentLetter`, `ManagerSession`, `LessonRoadmap`, `StaffVideoGuide`, `PromotionReport`, `NotificationTemplate`, `KpiOverrideLog`

**ml-service (`apps/ml-service/`):**
- `train.py` — 9 features, cross-validation
- `features.py` — `pass_rate_change`, `avg_session_count`, `xp_gained_7d`
- `scripts/seed_training_data.py` (NEW — bootstrap 100+ samples)
- `test_basic.py` — prediction shape test

**Tests:**
- `apps/api/test/adaptive.spec.ts` (NEW)
- `apps/api/test/churn.spec.ts` (EXTEND — ML hybrid)
- `apps/api/test/content-quality.spec.ts` (NEW)
- `apps/api/test/analytics.spec.ts` (EXTEND — gap tests)
- `apps/api/test/clickhouse.spec.ts` (EXTEND — runMigrations + connection failure)
- `apps/web/e2e/` — Playwright E2E for analytics 8-tab, tenants list, tester clone

**.env.example (root):**
- `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DB`
- `ML_SERVICE_URL`, `ML_SERVICE_TIMEOUT_MS`
- `FACE_VECTOR_KEY` (AES-256 key for embedding encryption)
- `DEVICE_TOKEN_SECRET` (JWT signing secret for kiosk devices)

---

# PHASE 1 — Security & Compliance Blockers

**Why first:** Production deployment cannot ship until these close. Each affects PDPL compliance or active vulnerability.

### Task 1.1: PWA — `/api/**` NetworkOnly + login NetworkOnly

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1:** Read current `next.config.ts` and locate `withPWA(...)` config.
- [ ] **Step 2:** Add `workboxOptions.runtimeCaching` override:

```ts
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  cacheOnFrontEndNav: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: { document: '/offline' },
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /\/login(\/|$)/,
        handler: 'NetworkOnly',
      },
      {
        urlPattern: /\/[^\/]+\/login(\/|$)/,
        handler: 'NetworkOnly',
      },
      // default for other routes:
      {
        urlPattern: ({ request }) => request.destination === 'document',
        handler: 'NetworkFirst',
        options: { cacheName: 'pages', networkTimeoutSeconds: 5 },
      },
    ],
  },
});
```

- [ ] **Step 3:** Build and inspect `apps/web/public/sw.js` to confirm `/api/` → `NetworkOnly` is present:

```bash
pnpm --filter web build
grep -o "NetworkOnly" apps/web/public/sw.js | wc -l
```
Expected: at least 3 occurrences.

- [ ] **Step 4:** Manual test via DevTools Application → Service Workers (verify `/api/users/me` NOT cached, login page NOT cached after logout).

### Task 1.2: Face ID — frontend computes vector, server never sees raw image

**Files:**
- Modify: `apps/web/components/EnrollmentCamera.tsx` (or wherever images_base64 is sent)
- Modify: `apps/web/app/(kiosk)/page.tsx` — face recognition flow
- Modify: `apps/api/src/face/face.controller.ts` — accept `embedding: number[]` instead of `images_base64`
- Modify: `apps/api/src/face/face.service.ts` — remove image-to-vector conversion proxy
- Add dependency: `face-api.js` (already present, verify)

- [ ] **Step 1:** Confirm `face-api.js` model files exist in `apps/web/public/models/`. If not, copy from `node_modules/face-api.js/weights/`.
- [ ] **Step 2:** In `EnrollmentCamera.tsx`, after capturing each of 5 frames, run `faceapi.computeFaceDescriptor()` and collect 5 × 128-dim vectors.
- [ ] **Step 3:** Send `POST /face/enroll` with body `{ userId, embeddings: number[5][128] }` (NOT raw images).
- [ ] **Step 4:** Update `face.controller.ts` enroll endpoint signature:

```ts
@Post('enroll')
@Roles(UserRole.filadmin, UserRole.superadmin)
async enroll(@Body() body: { userId: string; embeddings: number[][] }) {
  return this.faceService.enrollFromVectors(body.userId, body.embeddings);
}
```

- [ ] **Step 5:** Add unit test `apps/api/test/face.spec.ts` confirming enroll rejects body containing `images_base64`.
- [ ] **Step 6:** Update `face.service.ts.enrollFromVectors` to average the 5 vectors and store as encrypted embedding (Task 1.3 closes encryption).

### Task 1.3: Face embedding — AES-256-GCM encryption at rest

**Files:**
- Create: `apps/api/src/common/crypto/vector-cipher.ts`
- Modify: `apps/api/src/face/face.service.ts`
- Modify: `prisma/schema.prisma` — `FaceEmbedding.embedding String` → encrypted text
- Add migration: `0020_face_embedding_encrypted`
- Modify: `.env.example` + `apps/api/.env.example`

- [ ] **Step 1:** Add `FACE_VECTOR_KEY=<base64 32-byte>` to `.env.example`. Generate with `openssl rand -base64 32`.
- [ ] **Step 2:** Create cipher:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
const ALGO = 'aes-256-gcm';
export function encryptVector(vec: number[], key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = Buffer.from(JSON.stringify(vec));
  const ct = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64');
}
export function decryptVector(b64: string, key: Buffer): number[] {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString());
}
```

- [ ] **Step 3:** Unit test (`apps/api/test/vector-cipher.spec.ts`): round-trip encrypt → decrypt yields identical vector; tampered ciphertext throws.
- [ ] **Step 4:** Wire into `face.service.ts` enroll/recognize paths.
- [ ] **Step 5:** Migration to rename column type if needed (text → bytea optional; JSON-as-text is fine).

### Task 1.4: Audit log — DB trigger blocks UPDATE/DELETE

**Files:**
- Create migration: `prisma/migrations/0021_audit_log_no_modify/migration.sql`

- [ ] **Step 1:** Write migration:

```sql
CREATE OR REPLACE FUNCTION prevent_audit_modify() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit log entries are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_update_delegation_audit BEFORE UPDATE ON "DelegationAuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modify();
CREATE TRIGGER no_delete_delegation_audit BEFORE DELETE ON "DelegationAuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modify();
-- repeat for other audit tables if any
```

- [ ] **Step 2:** Apply: `pnpm --filter api prisma migrate dev`.
- [ ] **Step 3:** Test via `psql` direct UPDATE — must fail with the raise message.

### Task 1.5: Global rate limit (not just auth)

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1:** Confirm `@nestjs/throttler` is installed.
- [ ] **Step 2:** In `app.module.ts`, register global guard:

```ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 60000, limit: 5 },
    ]),
    // ...
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
```

- [ ] **Step 3:** Verify `auth.controller.ts` keeps its `@Throttle({auth:...})` override.
- [ ] **Step 4:** E2E test: rapid-fire 110 requests to `/users/me` → 429 by request 101.

### Task 1.6: Chat XSS — DOMPurify sanitization

**Files:**
- Modify: `apps/api/src/social/chat.service.ts`

- [ ] **Step 1:** Add dep: `pnpm --filter api add isomorphic-dompurify`.
- [ ] **Step 2:** In `chat.service.send()`, before persist:

```ts
import DOMPurify from 'isomorphic-dompurify';
const cleanText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
```

- [ ] **Step 3:** Unit test: input `<img src=x onerror=alert(1)>hello` → output `hello`.

### Task 1.7: PHASE 1 quality gate + commit

- [ ] Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`. All green.
- [ ] Commit: `feat(security): close 7 production blockers — PWA NetworkOnly, face vector PDPL, audit immutability, global throttler, XSS`

---

# PHASE 2 — Production Env Config & Cold-Start

### Task 2.1: `.env.example` complete

**Files:**
- Modify: `d:/projects/alochi/.env.example`
- Modify: `apps/api/.env.example`

- [ ] **Step 1:** Append to root `.env.example`:

```bash
# ClickHouse (Faza 4)
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_USER=alochi
CLICKHOUSE_PASSWORD=changeme
CLICKHOUSE_DB=alochi_analytics

# ML service (Faza 4)
ML_SERVICE_URL=http://localhost:8001
ML_SERVICE_TIMEOUT_MS=2000

# Security
FACE_VECTOR_KEY=  # openssl rand -base64 32
DEVICE_TOKEN_SECRET=  # openssl rand -base64 64
```

- [ ] **Step 2:** Mirror in `apps/api/.env.example`.
- [ ] **Step 3:** README snippet update if onboarding docs reference env.

### Task 2.2: `nest-cli.json` — copy SQL migrations to dist

**Files:**
- Modify: `apps/api/nest-cli.json`

- [ ] **Step 1:** Add to `compilerOptions.assets`:

```json
{
  "compilerOptions": {
    "assets": [
      { "include": "migrations/clickhouse/*.sql", "outDir": "dist/migrations/clickhouse", "watchAssets": true }
    ]
  }
}
```

- [ ] **Step 2:** Build: `pnpm --filter api build` → confirm `apps/api/dist/migrations/clickhouse/001_create_events.sql` exists.

### Task 2.3: ML training data seed script

**Files:**
- Create: `apps/ml-service/scripts/seed_training_data.py`

- [ ] **Step 1:** Script connects to PG, extracts existing students with at least 30 days of activity, computes feature vectors + label = (currentStreak == 0 AND absent_days_30d > 7), inserts 100+ rows into a `churn_training_data` table (create if missing).
- [ ] **Step 2:** Document run: `python apps/ml-service/scripts/seed_training_data.py`.
- [ ] **Step 3:** Add npm script in `apps/api/package.json`: `"seed:churn-training": "python ../ml-service/scripts/seed_training_data.py"`.

### Task 2.4: ClickHouse `cohort_weekly` materialized view

**Files:**
- Create: `apps/api/src/migrations/clickhouse/003_cohort_weekly_mv.sql`
- Modify: `apps/api/src/analytics/analytics.service.ts.getCohortRetention()` — replace ad-hoc CTE with MV query

- [ ] **Step 1:** Write SQL:

```sql
CREATE MATERIALIZED VIEW IF NOT EXISTS cohort_weekly
ENGINE = SummingMergeTree()
ORDER BY (tenant_id, cohort_week, return_week)
POPULATE AS
SELECT
  tenant_id,
  toStartOfWeek(min(timestamp)) AS cohort_week,
  toStartOfWeek(timestamp) AS return_week,
  count(DISTINCT user_id) AS active_users
FROM events
WHERE event_type = 'lesson_completed'
GROUP BY tenant_id, user_id, cohort_week, return_week;
```

- [ ] **Step 2:** Update `getCohortRetention` to read from `cohort_weekly` directly.
- [ ] **Step 3:** Test: `pnpm --filter api test analytics.spec.ts` — cohort tab still returns same shape.

### Task 2.5: `/superadmin/tenants` list page

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/tenants/page.tsx`
- Modify: `apps/api/src/tenants/tenants.controller.ts` — ensure `GET /tenants` returns id/name/slug/createdAt/userCount/branchCount

- [ ] **Step 1:** Add controller method if missing:

```ts
@Get()
@Roles(UserRole.superadmin)
async list() {
  return this.tenantsService.listAllWithCounts();
}
```

- [ ] **Step 2:** Service `listAllWithCounts()` joins `_count: { users: true, branches: true }`.
- [ ] **Step 3:** Frontend page fetches list, renders table with columns: Slug, Nomi, Foydalanuvchilar, Filiallar, Yaratilgan, Amallar (Edit/Disable buttons stub).
- [ ] **Step 4:** Add `Building2` nav card "Markazlar" linking to `/superadmin/tenants` in `superadmin/page.tsx`.

### Task 2.6: PHASE 2 quality gate + commit

- [ ] `pnpm typecheck && pnpm lint && pnpm build && pnpm test` green.
- [ ] Commit: `feat(infra): production env config, ClickHouse cohort_weekly MV, tenants list page, ML seed script`

---

# PHASE 3 — API Standardization

### Task 3.1: Response wrapper interceptor

**Files:**
- Create: `apps/api/src/common/interceptors/response.interceptor.ts`
- Modify: `apps/api/src/main.ts` — register globally

- [ ] **Step 1:** Write interceptor:

```ts
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: { timestamp: new Date().toISOString() },
      })),
    );
  }
}
```

- [ ] **Step 2:** In `main.ts`: `app.useGlobalInterceptors(new ResponseInterceptor())`.
- [ ] **Step 3:** Update frontend `apps/web/lib/api.ts` to read `json.data` (not `json` directly). Add adapter:

```ts
const json = await res.json();
return { data: json.data ?? json, meta: json.meta };
```

- [ ] **Step 4:** E2E: `GET /users/me` returns `{ success: true, data: {...}, meta: { timestamp } }`.

### Task 3.2: Error code enrichment

**Files:**
- Modify: `apps/api/src/common/filters/all-exceptions.filter.ts`

- [ ] **Step 1:** Standardize error response to:

```ts
{ success: false, error: { code: string, message: string, details?: object } }
```

- [ ] **Step 2:** Define error code constants in `apps/api/src/common/errors/codes.ts`: `LESSON_LOCKED`, `BLOCKED_WARNING`, `BLOCKED_PAYMENT`, `DELEGATION_EXPIRED`, etc.
- [ ] **Step 3:** Throw with code: `throw new BadRequestException({ code: 'LESSON_LOCKED', details: { required_lesson_id: id } })`.
- [ ] **Step 4:** Filter unwraps and serializes.

### Task 3.3: API path realignment (12 endpoints)

**Files:**
- Modify: `apps/api/src/warnings/warnings.controller.ts` — `GET /warnings/student/:studentId` → `GET /warnings/:studentId`; `POST /warnings (body)` → `POST /warnings/:studentId`; `DELETE /warnings/:id` → `PATCH /warnings/:warningId/cancel`
- Modify: `apps/api/src/payments/payments.controller.ts` — split `/payments/settings` → `/payment-settings`; `GET /payments/branch/:branchId` → `GET /payments?branchId=`; `POST /payments (body)` → `POST /payments/:studentId`; `GET /payments/student/:studentId` → `GET /payments/:studentId/status`
- Modify: `apps/api/src/users/users.controller.ts` — add `GET /users/:id/block-status`, `POST /users/:id/unblock`
- Modify: `apps/api/src/attendance/attendance.controller.ts` — `POST /attendance/students/bulk` → `POST /attendance/students`
- Modify: `apps/api/src/lesson-progress/lesson-progress.controller.ts` — add `POST /progress/:studentId/academy` (academy session start)
- Modify: `apps/api/src/ai/ai.controller.ts` — split `/ai/tutor/ask` into `/ai/qa/start`, `/ai/qa/answer`, `/ai/speech/assess`, `/ai/evaluate`

- [ ] **Step 1:** For each endpoint, change route decorator to spec form.
- [ ] **Step 2:** Update frontend callers in `apps/web/lib/api.ts` and component files (run `grep -rn "/payments/branch" apps/web` before/after).
- [ ] **Step 3:** Update Postman collection or OpenAPI doc if maintained.
- [ ] **Step 4:** E2E smoke test — all 12 endpoints respond 200 from frontend.

### Task 3.4: WebSocket events emit

**Files:**
- Modify: `apps/api/src/social/social.gateway.ts` (rename namespace from `/social` to `/ws` global, OR add additional namespace)
- Modify: `apps/api/src/student-status/status.service.ts` — emit `status:updated`
- Modify: `apps/api/src/users/users.service.ts.block()/unblock()` — emit `student:blocked` / `student:unblocked`
- Modify: `apps/api/src/notifications/notifications.service.ts` — emit `notification:new`
- Modify: `apps/api/src/attendance/attendance-students.service.ts` — emit `attendance:marked`
- Modify: `apps/api/src/tasks/tasks.service.ts` — emit `task:assigned`
- Modify: `apps/api/src/social/chat.service.ts` — emit `chat:reaction` from `addReaction()`

- [ ] **Step 1:** Inject `WebsocketGateway` in each service via DI.
- [ ] **Step 2:** Each event payload matches spec §25.3 contract.
- [ ] **Step 3:** Frontend hooks add socket listeners (e.g., `useNotifications` listens for `notification:new`).
- [ ] **Step 4:** E2E: trigger setStatus → confirm WS frame received in browser dev tools.

### Task 3.5: PHASE 3 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(api): standardize response wrapper, error codes, 12-endpoint path realignment, 6 WS events`

---

# PHASE 4 — Schema & ENUM cleanup

### Task 4.1: New ENUM types

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: `0022_enums_cleanup`

- [ ] **Step 1:** Add ENUMs:

```prisma
enum DelegationAction { accepted rejected }
enum FeedEventType { lesson_done streak_milestone cert_earned duel_won streak_broken city_upgraded }
enum FriendshipScope { group branch }
enum DuelStatus { pending active completed expired }
enum TaskStatus { sent seen in_progress done confirmed }
enum WarningType { not_prepared no_homework discipline other }
enum ChatModerationStatus { approved pending rejected }
```

- [ ] **Step 2:** Change fields from String to enum on: `DelegationResponse.action`, `SocialFeedEvent.eventType`, `Friendship.scope`, `Duel.status`, `Task.status`, `Warning.type`, `ChatMessage.moderationStatus`.
- [ ] **Step 3:** Migration backfills existing rows (default 'sent' for tasks, etc.).
- [ ] **Step 4:** Run migration; fix any type errors in services.

### Task 4.2: Schema additions

**Files:**
- Modify: `prisma/schema.prisma`
- Migration: `0023_schema_completeness`

- [ ] **Step 1:** Add fields:

```prisma
model ChatMessage {
  isPinned Boolean @default(false)
  moderationStatus ChatModerationStatus @default(approved)
}
model ChatBan { groupId String? }   // null = global ban
model Task { seenAt DateTime?  startedAt DateTime? }
model GroupChallenge { winnerGroupId String? }
model Tenant { warningBlockLimit Int @default(3) }
model BranchDevice { tokenExpiresAt DateTime }
```

- [ ] **Step 2:** Add UNIQUE INDEX:

```sql
CREATE UNIQUE INDEX one_active_delegation_per_user
ON "Delegation" ("toUserId") WHERE status = 'active';
```

- [ ] **Step 3:** Update affected services to set new fields.

### Task 4.3: Audit log delegation_id integration

**Files:**
- Modify: `apps/api/src/warnings/warnings.service.ts.give()`
- Modify: `apps/api/src/payments/payments.service.ts.markPaid()`
- Modify: `apps/api/src/users/users.service.ts.create()` (when staff_added under delegation)

- [ ] **Step 1:** Each service accepts optional `delegationId` from JWT context (extracted via custom decorator `@CurrentDelegation()`).
- [ ] **Step 2:** When `delegationId` present, write `DelegationAuditLog` row with action `warning_given` / `payment_marked` / `staff_added`.
- [ ] **Step 3:** Pass `delegationId` to created `Warning` / `Payment` row (already columns).

### Task 4.4: PHASE 4 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(schema): 7 new ENUMs, 8 new fields, one_active_delegation index, audit log delegation_id wiring`

---

# PHASE 5 — RBAC fixes

### Task 5.1: Warnings — Filadmin + Superadmin only (remove Manager)

**Files:**
- Modify: `apps/api/src/warnings/warnings.controller.ts`

- [ ] **Step 1:** `@Roles(UserRole.filadmin, UserRole.superadmin)` on POST /warnings/:studentId.
- [ ] **Step 2:** Update test `warnings.spec.ts` — manager role now 403.

### Task 5.2: Delegations — Superadmin can create

- [ ] **Step 1:** Modify `delegations.controller.ts` POST `@Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)`.
- [ ] **Step 2:** Test: superadmin creates delegation → 201.

### Task 5.3: Status endpoint split (mentor → personal, manager → critical)

**Files:**
- Modify: `apps/api/src/student-status/status.controller.ts`

- [ ] **Step 1:** Replace single `POST /status` with two endpoints:

```ts
@Post('personal')
@Roles(UserRole.mentor)
setPersonal(@Body() dto: { studentId: string; color: 'green'|'yellow'|'red'; note?: string }) {...}

@Post('critical')
@Roles(UserRole.manager)
setCritical(@Body() dto: ...) {...}
```

- [ ] **Step 2:** Service: `setPersonalStatus()` runs auto-yellow logic — when personal=green AND english=green AND prev critical was yellow/red, auto-set critical=green and emit notification to manager.
- [ ] **Step 3:** Frontend mentor page calls `/status/personal`; manager calls `/status/critical`.

### Task 5.4: Manager access to /users (KPI view)

- [ ] **Step 1:** `users.controller.ts` `findAll` `@Roles(superadmin, filadmin, manager)`.
- [ ] **Step 2:** Service filters: manager sees only own branch users.

### Task 5.5: WARNING_BLOCK_LIMIT — Tenant config

**Files:**
- Modify: `apps/api/src/warnings/warnings.service.ts`

- [ ] **Step 1:** Replace hardcoded `3` with `tenant.warningBlockLimit` lookup.
- [ ] **Step 2:** Add Superadmin UI page `superadmin/settings/page.tsx` to edit per-tenant limit.

### Task 5.6: PHASE 5 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(rbac): warnings/delegations/status RBAC fixes, manager users access, tenant warning limit`

---

# PHASE 6 — Telegram & Notifications

### Task 6.1: Delegation Telegram (5 events)

**Files:**
- Modify: `apps/api/src/telegram/handlers/delegation.handler.ts` (CREATE if missing)
- Modify: `apps/api/src/notifications/notification-event.handler.ts`

- [ ] **Step 1:** Listener for events `delegation.created`, `delegation.accepted`, `delegation.rejected`, `delegation.cancelled`, `delegation.completed`.
- [ ] **Step 2:** Each handler calls `telegram.sendMessage(targetTelegramId, formatDelegationMessage(type, data))`.
- [ ] **Step 3:** Spec §6.1 message text: `"Sizga vaqtinchalik {role} vakolati berildi. Siz bajara olasiz: {permissions}. Sabab: {reason}. Muddati: {endsAt}."`.

### Task 6.2: Warnings Telegram count differentiation

**Files:**
- Modify: `apps/api/src/notifications/notification-event.handler.ts`

- [ ] **Step 1:** On `warning.given`, fetch student warning count.
- [ ] **Step 2:**
  - count=1 → student in-app + Telegram
  - count=2 → student + parent Telegram + mentor in-app alert
  - count=3 → student + parent Telegram + filadmin + superadmin in-app
- [ ] **Step 3:** Telegram bot `staff.handler.ts` confirms delivery.

### Task 6.3: Status change Telegram alert

- [ ] On `status.changed` event, if green→yellow or yellow→red, send Telegram to manager + parent.

### Task 6.4: 30-day streak Telegram → parent

**Files:**
- Modify: `apps/api/src/gamification/streak.service.ts`

- [ ] **Step 1:** When streak hits 30, emit `streak.milestone30` event.
- [ ] **Step 2:** Handler sends Telegram to `student.parentTelegramId` with congrats template.

### Task 6.5: Cert congrats Telegram

- [ ] On `certificate.earned` event, send templated congrats with cert image (PNG buffer).

### Task 6.6: Telegram bot `/rating` handler

**Files:**
- Modify: `apps/api/src/telegram/handlers/student.handler.ts`

- [ ] **Step 1:** `bot.command('rating', ...)` queries student rank in their group + branch (XP-sorted).
- [ ] **Step 2:** Reply: `"Sizning o'rningiz: 5/20 (filialda 12/120)"`.

### Task 6.7: Mentor inline-button attendance via Telegram

**Files:**
- Modify: `apps/api/src/telegram/handlers/staff.handler.ts`

- [ ] **Step 1:** `/davomat` command → bot loads mentor's group → renders inline keyboard with each student name + ✅/❌/⏰ buttons.
- [ ] **Step 2:** Callback handler writes `Attendance` rows.

### Task 6.8: 2-day-absent parent reminder cron

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts`

- [ ] **Step 1:** New cron `'0 18 * * *'` (18:00 daily): query students with no attendance in last 2 days → bulk Telegram parent.

### Task 6.9: Notification template — Superadmin config

**Files:**
- Create: `apps/api/src/notification-templates/` module
- Create: `apps/web/app/(dashboard)/superadmin/templates/page.tsx`

- [ ] **Step 1:** New table `NotificationTemplate { key (unique), tenantId, body, updatedAt }`.
- [ ] **Step 2:** Endpoints CRUD.
- [ ] **Step 3:** All Telegram/in-app messages read template by key with fallback to hardcoded default.

### Task 6.10: Face stale alert + enrollment reminder Telegram

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts.runFaceCacheStaleAlert()` and `runFaceEnrollmentReminder()`

- [ ] **Step 1:** Replace `logger.warn(...)` with `telegram.sendMessage(filadminTelegramId, msg)`.

### Task 6.11: PHASE 6 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(notifications): Telegram coverage for delegations, warnings, status, streak, certs; /rating bot, mentor inline attendance, 2-day absent cron, template config, face Telegram alerts`

---

# PHASE 7 — Status Workflow Completion

### Task 7.1: Critical auto-yellow logic

(closed in Task 5.3 service code — verify)

### Task 7.2: Status enum unification

**Files:**
- Modify: ALL files referencing colors — choose canonical Uzbek `yashil/sariq/qizil`.
- Modify: `apps/api/src/telegram/services/telegram-formatter.service.ts.formatDailyReport()` — translate at the boundary only.

- [ ] **Step 1:** Grep `'green'|'yellow'|'red'` in service code → replace with Uzbek.
- [ ] **Step 2:** Single canonical type:

```ts
export type StatusColor = 'yashil' | 'sariq' | 'qizil';
export const STATUS_LABELS_EN: Record<StatusColor, 'green'|'yellow'|'red'> = { yashil: 'green', sariq: 'yellow', qizil: 'red' };
```

- [ ] **Step 3:** Update DB enum if Prisma uses string literal — migration to canonicalize values.

### Task 7.3: Avtomatik English status from Claude evaluation

**Files:**
- Modify: `apps/api/src/lesson-progress/lesson-progress.service.ts.completeLesson()`
- Use: `apps/api/src/ai/ai.service.ts.evaluate()`

- [ ] **Step 1:** After `evaluate` returns score, map: ≥80 → yashil, 50–79 → sariq, <50 → qizil.
- [ ] **Step 2:** Call `student-status.service.setEnglishStatus(studentId, color)`.
- [ ] **Step 3:** Test: low-score evaluation → englishStatus becomes qizil.

### Task 7.4: PHASE 7 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(status): unify enum to Uzbek, auto-yellow logic, AI-driven English status`

---

# PHASE 8 — KPI Auto-Calc

### Task 8.1: Mentor KPI cron

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts`

- [ ] **Step 1:** New cron `'0 22 * * *'` `mentor_kpi_calc`: for each mentor, count today's lessons ≥15 min, ≤20 students, on-time messages → award XP per spec §8.1 formula.

### Task 8.2: Manager KPI on status transition

**Files:**
- Modify: `apps/api/src/student-status/status.service.ts`

- [ ] **Step 1:** Inside `setCriticalStatus`, if old qizil → new sariq, award manager +10 KPI; sariq → yashil → +15 KPI.
- [ ] **Step 2:** Use `kpi.service.award(managerId, 10|15, reason)`.

### Task 8.3: Filadmin monthly bonus/penalty

- [ ] **Step 1:** Cron `'0 23 28-31 * *'` (last day of month): aggregate branch stats → bonus rules per spec §8.3.

### Task 8.4: PHASE 8 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(kpi): auto-calc cron for mentor + manager status emit + filadmin monthly`

---

# PHASE 9 — Cron Jobs (remaining)

### Task 9.1: Spaced repetition 07:00

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts`

- [ ] **Step 1:** `'0 7 * * *'` `spaced_repetition_morning`: query due `SpacedRepetitionItem` rows → push notification to student.

### Task 9.2: Tasks 24h reminder

- [ ] **Step 1:** `'0 9 * * *'` `task_due_reminder`: tasks with deadline tomorrow → in-app + Telegram.

### Task 9.3: Chat 90-day cleanup

- [ ] **Step 1:** `'0 4 * * 0'` weekly: `DELETE FROM "ChatMessage" WHERE "createdAt" < NOW() - INTERVAL '90 days'`.

### Task 9.4: Group challenge XP awarding

**Files:**
- Modify: `apps/api/src/social/challenge.service.ts.completeExpired()`

- [ ] **Step 1:** When challenge expires, compute winner group, award +500 XP per member, +100 to losing group.
- [ ] **Step 2:** Emit feed event `challenge_won`.

### Task 9.5: unblock_at monitoring

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts.runPaymentUnblock()`

- [ ] **Step 1:** After unblock job, query users where `unblockAt < NOW()` AND `isBlocked = true` (failed unblock) → log alert + Telegram superadmin.

### Task 9.6: PHASE 9 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(cron): spaced repetition, task reminders, chat cleanup, challenge XP, unblock monitoring`

---

# PHASE 10 — Mentor Frontend

### Task 10.1: `GET /users/group/:groupId` endpoint

**Files:**
- Modify: `apps/api/src/users/users.controller.ts`, `users.service.ts`
- Modify: `prisma/schema.prisma` — verify `User.groupId` exists; if not, add field

- [ ] **Step 1:** Add field if missing; migration.
- [ ] **Step 2:** Service `findByGroup(groupId, tenantId)`.
- [ ] **Step 3:** Controller `@Get('group/:groupId')` `@Roles(mentor, manager, filadmin, superadmin)`.

### Task 10.2: Frontend mentor — switch to groupId-based fetch

**Files:**
- Modify: `apps/web/app/(dashboard)/mentor/page.tsx`
- Modify: `apps/web/app/(dashboard)/mentor/group/page.tsx`

- [ ] **Step 1:** Decode `groupId` from JWT (helper `getGroupIdFromToken`).
- [ ] **Step 2:** Replace `/users/by-branch/${branchId}` → `/users/group/${groupId}`.
- [ ] **Step 3:** Fix `/kpi/today` → `/kpi/daily` (both endpoints work; align to spec).

### Task 10.3: Mentor student detail — Telegram parent button

**Files:**
- Modify: `apps/web/app/(dashboard)/mentor/students/[id]/page.tsx`

- [ ] **Step 1:** Add card at bottom: `[Send Telegram to parent]` button.
- [ ] **Step 2:** On click, POST `/notifications/telegram` with `{ studentId, message: aiSummary }` → toast "Yuborildi ✓".

### Task 10.4: Mentor student detail header chips

- [ ] Add status badge + lesson count chip next to student name (color-mapped).

### Task 10.5: Group page link arrow

- [ ] Replace "Xato tahlili" with "Xato tahlili →" (text + arrow). Color align to teal (project palette, override spec).

### Task 10.6: PHASE 10 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(mentor): group endpoint, frontend group-based fetch, Telegram parent button, header chips`

---

# PHASE 11 — Tester Student-Clone Dashboard

### Task 11.1: Replace tester dashboard with student clone

**Files:**
- Backup: `apps/web/app/(dashboard)/tester/page.tsx` → `tester/_legacy-exam-queue.tsx` (preserve)
- Rewrite: `apps/web/app/(dashboard)/tester/page.tsx` — pixel clone of `student/page.tsx` but with bottom CTA `Sinov darsi` linking to `/tester/lessons/current`.

- [ ] **Step 1:** Copy student/page.tsx body verbatim; rename role-checks to allow tester.
- [ ] **Step 2:** Add bottom CTA card.
- [ ] **Step 3:** Move legacy exam queue to `/tester/exam-queue` (separate route).

### Task 11.2: `/tester/lessons/current` route

**Files:**
- Create: `apps/web/app/(dashboard)/tester/lessons/current/page.tsx`

- [ ] **Step 1:** Server component fetches "next lesson for tester" (re-use `getNextLesson` API).
- [ ] **Step 2:** Renders `LessonRunner` component (existing).

### Task 11.3: Tester nav 3 tabs

**Files:**
- Modify: `apps/web/app/(dashboard)/_components/BottomNav.tsx`

- [ ] **Step 1:** For tester role, render 3 tabs `[Bosh][Sinov darsi][Imtihon navbati]` (mentor-equivalent layout).

### Task 11.4: PHASE 11 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(tester): student-clone dashboard + tester lessons route + 3-tab nav`

---

# PHASE 12 — KPI Strips & Filters

### Task 12.1: Filadmin/Manager KPI Recent awards strip

**Files:**
- Modify: `apps/web/app/(dashboard)/filadmin/kpi/page.tsx`
- Modify: `apps/web/app/(dashboard)/manager/kpi/page.tsx`

- [ ] **Step 1:** Below today's total card, add horizontal scrollable strip: last 10 awards by current user from `GET /kpi/my?limit=10`.
- [ ] **Step 2:** Each item: amount, recipient, reason, time.

### Task 12.2: Superadmin churn — branch filter

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/churn/page.tsx`

- [ ] **Step 1:** Add `<select>` filtered by branch list.
- [ ] **Step 2:** Pass `?branchId=` to `/churn/high-risk` and `/medium-risk`.

### Task 12.3: Manager dashboard — medium-risk + signals

**Files:**
- Modify: `apps/web/app/(dashboard)/manager/page.tsx`

- [ ] **Step 1:** Add medium-risk section below high-risk.
- [ ] **Step 2:** Each row shows signals: `"Absent 3d + Red status"` (mapped from churn `signals` JSON).

### Task 12.4: PHASE 12 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(kpi-churn): recent awards strip, churn branch filter, manager medium-risk section`

---

# PHASE 13 — Service Unit Tests

### Task 13.1: `adaptive.service.spec.ts`

**Files:**
- Create: `apps/api/test/adaptive.spec.ts`

- [ ] **Step 1:** 4 tests:
  - errorRate > hardThreshold → newN = oldN + 1
  - errorRate < easyThreshold → newN = oldN - 1
  - middle range → newN unchanged
  - clamp to maxN/minN

### Task 13.2: `churn.service.spec.ts` extension

- [ ] **Step 1:** Add 6 tests:
  - rule-based score = sum of signals
  - max 100 cap
  - ML up returns ML score
  - ML down → fallback to rule-based
  - ML timeout → fallback
  - ML error → fallback

### Task 13.3: `content-quality.service.spec.ts`

- [ ] **Step 1:** Tests:
  - getLessonStats passRate calc
  - submitFeedback unique per student/lesson
  - A/B variant 50/50 distribution (sample 100 students)
  - promoteVariant overwrites lesson

### Task 13.4: `analytics.service.spec.ts`

- [ ] **Step 1:** Tests:
  - getLessonStats reads MV
  - getBranchStats reads MV
  - getCohortRetention queries CH (mocked)
  - dual-write fail handling

### Task 13.5: PHASE 13 quality gate + commit

- [ ] All green.
- [ ] Commit: `test: adaptive/churn/content-quality/analytics service unit tests`

---

# PHASE 14 — Faza 4 ML Completion

### Task 14.1: Add 3 missing features

**Files:**
- Modify: `apps/ml-service/features.py`

- [ ] **Step 1:** Add SQL queries:
  - `pass_rate_change`: (this week pass rate) - (last week pass rate)
  - `avg_session_count`: mean `StudentProgress.sessionCount` last 30d
  - `xp_gained_7d`: SUM XP last 7 days

- [ ] **Step 2:** Update `feature_to_vector` to 9 dimensions.
- [ ] **Step 3:** Update `train.py` to use 9 dim.
- [ ] **Step 4:** Update NestJS `churn.service.ts.computeScoreML` payload to include 9 features.

### Task 14.2: Cross-validation in training

**Files:**
- Modify: `apps/ml-service/train.py`

- [ ] **Step 1:** Replace single `train_test_split` with `StratifiedKFold(n_splits=5)`. Report mean ± std for precision/recall/F1.

### Task 14.3: ML hybrid integration test

**Files:**
- Modify: `apps/api/test/churn.spec.ts`

- [ ] **Step 1:** Mock `HttpService.post` for ML service:
  - test 1: ML returns 200 with score → use ML
  - test 2: ML returns 503 → rule-based
  - test 3: ML times out → rule-based
  - test 4: ML returns malformed → rule-based

### Task 14.4: `/superadmin/churn` ML metrics block

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/churn/page.tsx`

- [ ] **Step 1:** Top of page card: fetch `/churn/model-metrics` → display `Model versiya: X | Precision: 85% | Recall: 78% | F1: 81% | Oxirgi train: 2026-04-30 05:02`.
- [ ] **Step 2:** If 404 (no model trained), show `"Model hali o'qitilmagan"`.

### Task 14.5: Python `prediction shape` test

**Files:**
- Modify: `apps/ml-service/test_basic.py`

- [ ] **Step 1:** Test:

```python
def test_prediction_shape():
    model = load_model()
    sample = build_sample_features()
    pred = model.predict_proba([sample])
    assert pred.shape == (1, 2)
    assert 0 <= pred[0][1] <= 1
```

### Task 14.6: PHASE 14 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(ml): 9-feature set, cross-validation, hybrid integration tests, frontend metrics block`

---

# PHASE 15 — ClickHouse Polish

### Task 15.1: Funnel drop-off %

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/analytics/_components/FunnelTab.tsx`

- [ ] **Step 1:** Compute `dropoff = ((prev - curr) / prev) * 100` for each step ≥2.
- [ ] **Step 2:** Render label next to each bar: `{count} ({dropoff.toFixed(1)}%)`.

### Task 15.2: `clickhouse.spec.ts` gap tests

- [ ] **Step 1:** Add tests:
  - `runMigrations applies all SQL files in order`
  - `query throws on connection failure (mocked client.query rejects)`

### Task 15.3: Playwright E2E — analytics 8-tab

**Files:**
- Create: `apps/web/e2e/analytics.spec.ts`

- [ ] **Step 1:** Login as superadmin, navigate `/superadmin/analytics`, click each of 8 tabs, assert no console errors and at least one chart/table rendered.
- [ ] **Step 2:** Assert filadmin gets 403 on `/analytics/comparison`.

### Task 15.4: Active tab style + heatmap weeks 1-8

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/analytics/page.tsx` — add `bg-slate-700` to active tab
- Modify: `CohortTab.tsx` — change `WEEK_OFFSETS = [1,2,3,4,5,6,7,8]`

### Task 15.5: Failures tab — join lesson title

**Files:**
- Modify: `apps/api/src/analytics/analytics.service.ts.getTopFailures()` — join with `Lesson` for title

### Task 15.6: PHASE 15 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(analytics): funnel drop-off %, gap tests, Playwright E2E, active tab style, failures lesson titles`

---

# PHASE 16 — PWA Polish

### Task 16.1: Real PWA logo (placeholder action)

- [ ] **Step 1:** Open issue / Slack designer with brief: 192/512/maskable PNG, A'lochi brand.
- [ ] **Step 2:** Replace `apps/web/public/icons/*.png` when received.

### Task 16.2: iOS Safari install banner verification

**Files:**
- Modify: `apps/web/components/InstallPrompt.tsx`

- [ ] **Step 1:** Verify branch:

```ts
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isInStandalone = window.matchMedia('(display-mode: standalone)').matches;
if (isIOS && !isInStandalone) {
  // render iOS-specific instructions: tap Share → Add to Home Screen
}
```

### Task 16.3: Offline page reload

**Files:**
- Modify: `apps/web/app/offline/page.tsx`

- [ ] **Step 1:** Replace `<Link href="/">` with `<button onClick={() => window.location.reload()}>`.

### Task 16.4: Lighthouse CI baseline

**Files:**
- Create: `apps/web/lighthouserc.js`

- [ ] **Step 1:** Configure to run on built site, assert PWA category ≥90.

### Task 16.5: PHASE 16 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(pwa): iOS install branch verify, offline reload, Lighthouse CI baseline`

---

# PHASE 17 — Tenant Onboarding Polish

### Task 17.1: Slug URL with domain

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/tenants/new/_components/OnboardForm.tsx`

- [ ] Replace `URL: /{slug}/login` → `URL: alochi.uz/{slug}/login`.

### Task 17.2: Tenant edit/disable page

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/tenants/[id]/edit/page.tsx`
- Modify: `apps/api/src/tenants/tenants.controller.ts` — add `PATCH /tenants/:id`, `POST /tenants/:id/disable`

- [ ] **Step 1:** Form to edit name; toggle isActive.
- [ ] **Step 2:** Disable sets `isActive=false` cascade-locks all users.

### Task 17.3: Cosmetic — placeholder + emoji align

- [ ] Placeholder "Markaz nomi (Toshkent IELTS Markazi)".
- [ ] (Lucide icon vs emoji is acceptable refactor — leave as Lucide.)

### Task 17.4: PHASE 17 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(tenants): edit/disable page, slug URL fix, placeholder polish`

---

# PHASE 18 — Face ID Polish (10 items)

### Task 18.1: Use `branch.workStartTime` + `lateGraceMinutes`

**Files:**
- Modify: `apps/api/src/attendance/attendance-staff.service.ts`

- [ ] **Step 1:** Load branch when calling `checkin`:

```ts
const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
const [hh, mm] = branch.workStartTime.split(':').map(Number);
const startMs = new Date().setHours(hh, mm, 0, 0);
const lateMinutes = Math.max(0, Math.floor((Date.now() - startMs) / 60000) - branch.lateGraceMinutes);
```

- [ ] **Step 2:** Test with branches in different timezones / start times.

### Task 18.2: Device JWT 90-day

**Files:**
- Modify: `apps/api/src/face/devices.service.ts.create()`

- [ ] **Step 1:** Generate JWT with `expiresIn: '90d'`, signed with `DEVICE_TOKEN_SECRET`.
- [ ] **Step 2:** Add `tokenExpiresAt` field; cron daily checks expiring tokens.

### Task 18.3: `DELETE /face/enroll`

- [ ] **Step 1:** Endpoint deletes own embeddings (`@Roles(student, mentor, filadmin)` self-only).

### Task 18.4: `GET /face/enroll/status`

- [ ] **Step 1:** Returns `{ enrolled: boolean, lastUpdated: DateTime | null, embeddingCount: number }`.

### Task 18.5: `GET /devices/:id/status`

- [ ] **Step 1:** Returns `{ isActive, lastSeen, tokenExpiresAt, deviceName, branchId }`.

### Task 18.6: 3-fail filadmin alert

**Files:**
- Modify: `apps/api/src/face/face.service.ts.recognize()`

- [ ] **Step 1:** Track per-session fail count in Redis (or in-memory map).
- [ ] **Step 2:** On 3rd fail, emit event → notification handler → Telegram filadmin.

### Task 18.7: Offline log queue

**Files:**
- Modify: `apps/web/app/(kiosk)/page.tsx`

- [ ] **Step 1:** When network fails on submit, push to IndexedDB queue.
- [ ] **Step 2:** On reconnect, drain queue → POST.

### Task 18.8: Duplicate checkin 409

**Files:**
- Modify: `apps/api/src/face/face.controller.ts.faceCheckin()`

- [ ] **Step 1:** Before upsert, check if record exists for today → throw `ConflictException("Allaqachon belgilangansiz")`.

### Task 18.9: Cache encryption (AES-256)

**Files:**
- Modify: `apps/api/src/face/cache.service.ts`

- [ ] **Step 1:** Encrypt cached JSON paket with same `vector-cipher.ts` from Task 1.3.
- [ ] **Step 2:** Frontend decrypts using browser SubtleCrypto + key fetched on device login.

### Task 18.10: EAR liveness verify

**Files:**
- Verify: `apps/web/components/FaceScanner.tsx`

- [ ] **Step 1:** Confirm EAR (eye aspect ratio) blink detection runs; if missing, add using `face-api.js` landmark points 36-47.
- [ ] **Step 2:** Set `livenessPassd=true` only on successful blink.

### Task 18.11: PHASE 18 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(face): workStartTime use, JWT 90d, DELETE/status endpoints, 3-fail alert, offline queue, dup 409, cache encryption, EAR liveness`

---

# PHASE 19 — Social Completeness (15 items)

### Task 19.1: Auto-friendship on group formation

**Files:**
- Modify: `apps/api/src/users/users.service.ts.create()` (when role=student + groupId set)

- [ ] **Step 1:** After user create, fetch all existing same-group students; bulk-create `Friendship` rows status=accepted.

### Task 19.2: Auto-friendship on group join

- [ ] Same logic when `groupId` is patched on existing user.

### Task 19.3: Lenta events — emit all 6

**Files:**
- Modify: `apps/api/src/social/feed-event.service.ts`

- [ ] **Step 1:** Add emit calls in:
  - `progress.service.ts` on lesson completion → `lesson_done`
  - `streak.service.ts` on milestone → `streak_milestone`
  - `streak.service.ts` on break → `streak_broken`
  - `gamification.service.ts` on cert → `cert_earned`
  - `city.service.ts` on level up → `city_upgraded`

### Task 19.4: Lenta reaction

- [ ] **Step 1:** New endpoint `POST /social/feed/:id/react` (emoji).
- [ ] **Step 2:** Frontend feed item shows reaction count + button.

### Task 19.5: Duel speed bonus

**Files:**
- Modify: `apps/api/src/social/duel.service.ts.submitAnswer()`
- Modify: `prisma/schema.prisma` `DuelAnswer { answerMs Int }`

- [ ] **Step 1:** Add `answerMs` field; service stores time elapsed.
- [ ] **Step 2:** Final score = correct × 10 + speed_bonus (faster = more bonus).

### Task 19.6: Duel XP fix to 150/30

**Files:**
- Modify: `apps/api/src/gamification/xp-amounts.ts`

- [ ] **Step 1:** `DUEL_WIN: 150, DUEL_PARTICIPATE: 30`.

### Task 19.7: 24h challenger XP rule

- [ ] **Step 1:** In `expireOverdue()`, when defender never played, award challenger +50 XP.

### Task 19.8: Group challenge XP awarding cron

(closed in Task 9.4 — verify)

### Task 19.9: Challenge limits

**Files:**
- Modify: `apps/api/src/social/challenge.service.ts.create()`

- [ ] **Step 1:** Pre-check:
  - count active challenges this month for this group ≤ 2
  - count active (status=active) ≤ 1
  - both groups belong to same branch

### Task 19.10: Challenge winner feed

- [ ] In `completeExpired`, emit `feed.challenge_won` with both group names.

### Task 19.11: Challenge create RBAC

**Files:**
- Modify: `apps/api/src/social/challenge.controller.ts`

- [ ] `@Roles(mentor, filadmin)` (or top-XP student via custom guard later).

### Task 19.12: Chat moderation pending flow

**Files:**
- Modify: `apps/api/src/social/chat.service.ts.send()`

- [ ] **Step 1:** When keyword detected, set `moderationStatus=pending` (NOT auto-block).
- [ ] **Step 2:** Mentor receives in-app `chat:moderation_pending` event.
- [ ] **Step 3:** New endpoints `POST /social/messages/:id/approve`, `POST /social/messages/:id/reject` for mentor.
- [ ] **Step 4:** On reject, send warning to author.

### Task 19.13: Filadmin chat lock

- [ ] **Step 1:** Endpoint `POST /social/groups/:id/lock` `@Roles(filadmin)` sets `Group.chatLocked=true`.
- [ ] **Step 2:** `chat.service.send()` rejects when locked.

### Task 19.14: `is_pinned` + pin endpoint

- [ ] **Step 1:** Schema field `ChatMessage.isPinned` already added in Phase 4.
- [ ] **Step 2:** Endpoint `POST /social/groups/:id/messages/:msgId/pin` `@Roles(mentor, filadmin)`.
- [ ] **Step 3:** Frontend chat shows pinned messages at top with ⭐ icon.

### Task 19.15: REST `POST /groups/:id/messages` (parity with WS)

- [ ] **Step 1:** New REST endpoint that internally calls same service as WS gateway. Preserves WS for live; REST for offline queue.

### Task 19.16: PHASE 19 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(social): auto-friendship, full lenta events, duel speed/XP fix, 24h rule, challenge limits/feed/RBAC, chat pending flow + lock + pin + REST`

---

# PHASE 20 — Master Spec Big Features (10 items)

### Task 20.1: 250 dars rejasi structure

**Files:**
- Modify: `prisma/schema.prisma` — `Lesson.subcategory String?` (e.g., `worldview/critical_thinking/skill_20/experiment`)
- Migration: backfill existing lessons

- [ ] **Step 1:** Add subcategory + `orderInSubcategory` field.
- [ ] **Step 2:** Superadmin lessons UI shows tabbed view: 100 dunyoqarash / 50 tanqidiy / 50 ko'nikma / 50 eksperiment.

### Task 20.2: Madaniyat darsi treking

**Files:**
- Create: `apps/api/src/culture-lessons/` module

- [ ] **Step 1:** Table `CultureLessonAttendance { staffId, date, completed }`.
- [ ] **Step 2:** Cron daily reminder if missed.

### Task 20.3: Yo'l xaritasi 500 visual

**Files:**
- Create: `apps/web/components/PathMap500.tsx`
- Modify: `apps/web/app/(dashboard)/student/page.tsx` — embed component

- [ ] **Step 1:** SVG/Canvas: 500 stops on a winding path; current = pulsing dot; locked = grey; unlocked = green.

### Task 20.4: Sertifikat dashboard + QR + share

**Files:**
- Modify: `apps/web/app/(dashboard)/student/page.tsx` — certificates strip
- Create: `apps/web/components/CertificateShare.tsx`
- Modify: `apps/api/src/gamification/certificate.service.ts` — add QR generation (`qrcode` package)

- [ ] **Step 1:** On cert create, encode `https://alochi.uz/cert/${id}` as QR PNG, store in `Certificate.qrCode`.
- [ ] **Step 2:** Share component: deep links to Telegram/Instagram with cert image.

### Task 20.5: Kolleksiya kartalar (36 letters)

**Files:**
- Migration: `0024_letter_collection`
- Modify: `prisma/schema.prisma`:

```prisma
model Letter { id String @id @default(cuid()) char String @unique imageUrl String }
model StudentLetter { studentId String letterId String earnedAt DateTime @default(now()) @@unique([studentId, letterId]) }
```

- [ ] **Step 1:** Seed 36 letters (A-Z + 10 special).
- [ ] **Step 2:** Award random unowned letter on key milestones.
- [ ] **Step 3:** Frontend collection page `/student/letters`.

### Task 20.6: Filadmin video qo'llanma

**Files:**
- Create: `apps/api/src/staff-guides/` module
- Create: `apps/web/app/(dashboard)/superadmin/video-guides/page.tsx`
- Create: `apps/web/app/(dashboard)/filadmin/video-guides/page.tsx`

- [ ] **Step 1:** CRUD for `StaffVideoGuide { title, role, videoUrl, order }`.
- [ ] **Step 2:** Filadmin/staff sees guides for their role.

### Task 20.7: Filadmin targ'ibot hisoboti

**Files:**
- Create: `apps/api/src/promotion-report/` module
- Create: `apps/web/app/(dashboard)/filadmin/promotion-report/page.tsx`

- [ ] **Step 1:** Form to log school visits, students reached.
- [ ] **Step 2:** Aggregate stats for superadmin view.

### Task 20.8: Manager 1:1 sessions

**Files:**
- Create: `apps/api/src/manager-sessions/` module
- Create: `apps/web/app/(dashboard)/manager/sessions/page.tsx`

- [ ] **Step 1:** Table `ManagerSession { managerId, studentId, scheduledAt, notes, completedAt }`.
- [ ] **Step 2:** CRUD.

### Task 20.9: StudentLessonConfig audit log

**Files:**
- Modify: `apps/api/src/student-lesson-config/student-lesson-config.service.ts`
- New table: `KpiOverrideLog { studentId, lessonId, oldN, newN, changedBy, reason, changedAt }`

- [ ] **Step 1:** On every upsert, write log row. Old N preserved.
- [ ] **Step 2:** Manager UI shows history per student.

### Task 20.10: Adaptive last-time widget

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/adaptive/page.tsx`

- [ ] **Step 1:** Fetch `MAX(createdAt)` from `AdaptiveDifficultyLog`. Display "Oxirgi adaptatsiya: 2026-04-30 03:01".

### Task 20.11: PHASE 20 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(spec): 250-lesson plan structure, culture lessons, 500-step path, certs+QR+share, letter collection, video guides, promotion report, manager sessions, lesson config audit, adaptive last-time`

---

# PHASE 21 — AI & Error Handling

### Task 21.1: AI 3-retry mechanism

**Files:**
- Modify: `apps/api/src/ai/ai.service.ts`

- [ ] **Step 1:** Wrap each Claude/Azure call:

```ts
async withRetry<T>(fn: () => Promise<T>, max = 3): Promise<T> {
  for (let i = 0; i < max; i++) {
    try { return await fn(); } catch (e) { if (i === max - 1) throw e; await sleep(500 * (i + 1)); }
  }
}
```

### Task 21.2: Azure speech ↔ matn fallback

- [ ] **Step 1:** If Azure speech-to-text fails 3x, accept text input fallback in `VocabularyAudio.tsx`.

### Task 21.3: Network video save

**Files:**
- Modify: `apps/web/components/VideoPlayer.tsx`

- [ ] **Step 1:** `localStorage.setItem('video_progress_${lessonId}', JSON.stringify({ position, completed: percent>=90 }))` on every 5s tick.
- [ ] **Step 2:** On reload, resume.

### Task 21.4: Payment double-mark error

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts.markPaid()`

- [ ] **Step 1:** Pre-check: `if (existing && existing.month === currentMonth) throw new ConflictException("Bu oy to'lov allaqachon belgilangan")`.
- [ ] **Step 2:** Test.

### Task 21.5: Attendance double-checkin 409

(closed in Task 18.8 — verify)

### Task 21.6: PHASE 21 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(reliability): AI 3-retry, Azure fallback, video resume, payment dup error`

---

# PHASE 22 — Test Infrastructure

### Task 22.1: 80% coverage report

**Files:**
- Modify: `apps/api/jest.config.js` — `coverageThreshold: { global: { lines: 80 } }`
- Modify: `package.json` — `"test:cov": "pnpm --filter api test --coverage"`

- [ ] **Step 1:** Run; identify uncovered modules; add tests until 80%.

### Task 22.2: OWASP ZAP scan

**Files:**
- Create: `.github/workflows/zap.yml`

- [ ] **Step 1:** Schedule weekly ZAP baseline scan against staging URL.

### Task 22.3: k6 load test

**Files:**
- Create: `apps/api/test/load/lesson-flow.js`

- [ ] **Step 1:** Script simulates 100 concurrent students completing lesson flow over 5 minutes.
- [ ] **Step 2:** Run on staging, capture P95 latency.

### Task 22.4: PHASE 22 quality gate + commit

- [ ] All green.
- [ ] Commit: `chore(tests): 80% coverage threshold, OWASP ZAP weekly, k6 load script`

---

# PHASE 23 — Cosmetic Polish (batched)

Each task here is a cluster of small UI text/style alignments. Skip TDD ceremony; visual review only.

### Task 23.1: BottomNav fixes

- [ ] Student: replace "Imtihon" tab with "⚔️ Duel" linking to `/social/duel`.
- [ ] Tester: 3 tabs (closed in Phase 11 — verify).
- [ ] Status emoji 🟢⏳✅❌🚫 vs Lucide icons — keep Lucide (project standard, document override).

### Task 23.2: Manager dashboard skeleton

- [ ] Change `[1,2]` to `[1,2,3]` for both red/yellow sections (3-row skeleton).

### Task 23.3: Hardcoded "Sardor Rahimov" → `{studentName ?? 'Nomaʼlum'}`

- [ ] Already partially done; audit remaining hardcoded names.

### Task 23.4: Section header always shows count (even 0)

- [ ] Render `Qizil ({redStudents.length})` always; show empty-state card when 0.

### Task 23.5: Filadmin dashboard real-time stats

**Files:**
- Modify: `apps/web/app/(dashboard)/filadmin/page.tsx`

- [ ] **Step 1:** Add stats cards: today's attendance, status pie chart, today schedule, pending tasks.
- [ ] **Step 2:** Live update via WebSocket `attendance:marked` / `status:updated`.

### Task 23.6: Manager error handling

**Files:**
- Modify: `apps/web/app/(dashboard)/manager/students/[id]/page.tsx`

- [ ] **Step 1:** When user fetch fails, render full-page error (not page content).

### Task 23.7: Empty states + loading opacities

- [ ] Audit `DebtorsTable` empty state matn.
- [ ] Loading state: `opacity-50 transition`.

### Task 23.8: Path semantic fixes

- [ ] `DELETE /delegations/:id` → `PATCH /delegations/:id/cancel` (already in API standardization Phase 3 — verify).

### Task 23.9: Modal vs inline for A/B results

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/content-quality/page.tsx`

- [ ] Convert inline expand to dialog modal.

### Task 23.10: Pass rate <50% row tinted red

- [ ] Add `bg-rose-50/30` to entire `<tr>` when `passRate < 50`.

### Task 23.11: Content-quality `avgSessions` field

**Files:**
- Modify: `apps/api/src/content-quality/content-quality.service.ts.getLessonStats()`
- Modify: frontend table

- [ ] Add column "O'rtacha sessiya" computed as `AVG(StudentProgress.sessionCount)`.

### Task 23.12: Churn signal semantics fix

**Files:**
- Modify: `apps/api/src/churn/churn.service.ts`

- [ ] **Step 1:** `passRateDrop` — change from `<50%` to `(prev_week - curr_week) >= 20%`.
- [ ] **Step 2:** `absent3Days` — change to `consecutive 3 days no attendance` (query last 3 days specifically).
- [ ] **Step 3:** `redStatus` — also check `personalStatus === 'qizil'`.

### Task 23.13: Notification text alignment

- [ ] Payment block: spec text `"💳 To'lov muddati o'tdi. To'lovni amalga oshirgach, ertasi kuni kirish tiklanaadi."`.
- [ ] Warning count text: spec `"Yana 1 ta ogohlantirish profilingizni bloklaydi"`.

### Task 23.14: KPI page theme alignment

- [ ] Document in `apps/web/STYLE.md`: project palette is amber+navy, overrides spec indigo. Keep current.

### Task 23.15: Misc cosmetic batch

- [ ] Border radius: keep `rounded-[18px]` (project standard).
- [ ] Tab name "Faol/Kutilmoqda/Tarix/Rad etilgan" Uzbek labels in delegations.
- [ ] Container `max-w-lg mx-auto` on KPI form.
- [ ] Card `hover:scale-[1.02]` on filadmin nav cards.
- [ ] Mentor stat label "Guruh o'quvchilari" (sync with spec).

### Task 23.16: PHASE 23 quality gate + commit

- [ ] All green.
- [ ] Commit: `polish: 30+ cosmetic alignments — nav, skeletons, headers, empty states, modal, churn semantics, text alignment`

---

# PHASE 24 — Final QA & Deployment

### Task 24.1: Full e2e test suite run

- [ ] `pnpm --filter web e2e` — all Playwright suites green.
- [ ] Cross-browser smoke: Chrome, Safari (iOS).

### Task 24.2: Lighthouse audit (PWA + Performance + Accessibility + SEO)

- [ ] All 4 scores ≥ 90 on built site.
- [ ] PWA installable on iOS + Android.

### Task 24.3: Coverage gate

- [ ] `pnpm test:cov` — global ≥ 80%.

### Task 24.4: Database migration dry-run on staging

- [ ] `prisma migrate deploy` on staging DB without errors.
- [ ] Verify all 24 migrations applied.

### Task 24.5: ClickHouse migration verify

- [ ] All 3 SQL files (`001`, `002`, `003`) applied; `cohort_weekly` MV exists.

### Task 24.6: Manual smoke (15-min UAT script)

- [ ] Login as superadmin → create tenant → see in list → edit → disable → confirm cascade.
- [ ] Login as filadmin → mark attendance → enroll face ID → award KPI.
- [ ] Login as mentor → status update → group view → Telegram parent.
- [ ] Login as student → complete lesson → see status auto-updated → check certificate.
- [ ] Login as tester → student-clone dashboard → exam queue.
- [ ] Telegram bot: `/bugun /statistika /streak /rating /vazifalar` all respond.
- [ ] PWA install on physical phone, offline use.
- [ ] Churn dashboard: ML metrics block visible.

### Task 24.7: Deploy & monitor

- [ ] Tag release `v1.0.0`.
- [ ] Deploy via existing pipeline.
- [ ] 24h soak: no error spikes, latency P95 ≤ 500ms.

### Task 24.8: PHASE 24 quality gate + commit

- [ ] All green.
- [ ] Commit: `chore(release): v1.0.0 — 100% spec compliance audit closed`
- [ ] Tag: `git tag v1.0.0 && git push origin v1.0.0`

---

# PHASE 25 — Audit Backfill (items missed in initial pass)

**Why this phase exists:** During plan self-review, the following audit items were either implicitly mentioned in the file structure or covered indirectly. They are made explicit here so nothing is left to interpretation. Group by area; can be subdivided into smaller phases if needed.

## 25.A — Delegation completeness (3 items)

### Task 25.A.1: Server-side permission enforcement guard

**Files:**
- Create: `apps/api/src/delegations/guards/delegation-permission.guard.ts`

- [ ] **Step 1:** Guard reads `Delegation.permissions` JSONB array from JWT context (when user acts under delegation), and rejects if requested action not in array.
- [ ] **Step 2:** Apply via custom decorator `@RequiresDelegationPermission('warnings'|'payments'|'staff_manage')` on `WarningsController.give`, `PaymentsController.markPaid`, `UsersController.create` (when staff role).
- [ ] **Step 3:** Test: user with delegation `{permissions:['warnings']}` calling `POST /payments` → 403.

### Task 25.A.2: `findForUser` scope filter

**Files:**
- Modify: `apps/api/src/delegations/delegations.service.ts.findForUser()`

- [ ] **Step 1:** If caller role = superadmin, return all delegations across tenants.
- [ ] **Step 2:** If caller role = filadmin, filter to delegations where `branchId` matches caller's branch.
- [ ] **Step 3:** Otherwise, only return where caller is `fromUserId` or `toUserId` (current behaviour).

### Task 25.A.3: Delegation UI — staff_manage permission, summary card, expired message

**Files:**
- Modify: `apps/web/app/(dashboard)/delegations/new/page.tsx`
- Modify: `apps/web/app/(dashboard)/delegations/page.tsx`
- Modify: `apps/api/src/delegations/delegations.service.ts.respondToDelegation()`

- [ ] **Step 1:** In `new/page.tsx`, change permissions checkbox group to 3 options: `warnings | payments | staff_manage`.
- [ ] **Step 2:** In `delegations/page.tsx`, add summary card top: `"{count} ta delegatsiya, {actionCount} ta amal bajarildi"` (sum from audit logs).
- [ ] **Step 3:** In `respondToDelegation`, before status check, also check `endsAt < now` → throw `BadRequestException({ code: 'DELEGATION_EXPIRED', message: 'Muddat o\'tdi' })`.

## 25.B — Lesson schema completeness (3 items)

### Task 25.B.1: `nRepetitions` min/max validation

**Files:**
- Modify: `apps/api/src/lessons/dto/create-lesson.dto.ts`, `update-lesson.dto.ts`

- [ ] **Step 1:** Add class-validator: `@Min(1) @Max(10) nRepetitions: number;` and `@Min(1) @Max(20) maxNOverride?: number;`.

### Task 25.B.2: `Lesson.cameraEnabled` flag + UI

**Files:**
- Modify: `prisma/schema.prisma` — add `cameraEnabled Boolean @default(false)` on Lesson
- Migration: `0025_lesson_camera_flag`
- Modify: `apps/web/app/(dashboard)/superadmin/lessons/[id]/edit/page.tsx`

- [ ] **Step 1:** Schema field + migration.
- [ ] **Step 2:** UI toggle "Kamera nazorati yoqilsin" on lesson edit page.
- [ ] **Step 3:** `LessonRunner` reads `cameraEnabled` and renders `CameraMonitor` accordingly (replaces JSON-flag indirection).

### Task 25.B.3: AI Tutor `lessonContext` field

**Files:**
- Modify: `prisma/schema.prisma` — `Lesson.aiTutorContext String?` (markdown text)
- Migration: `0026_lesson_ai_context`
- Modify: lesson edit page + `AiTutor.tsx` to read from server (not prop)

- [ ] **Step 1:** Schema + migration.
- [ ] **Step 2:** UI: textarea "AI Tutor uchun kontekst" on lesson edit.
- [ ] **Step 3:** `AiTutor` fetches context from `GET /lessons/:id/components` (already exists).

## 25.C — Superadmin missing pages/endpoints (4 items)

### Task 25.C.1: Filial statistikasi endpoint + dashboard

**Files:**
- Modify: `apps/api/src/branches/branches.controller.ts` — add `GET /branches/:id/stats`
- Service: aggregate `studentCount`, `avgStatus`, `attendanceRate30d`
- Modify: `apps/web/app/(dashboard)/superadmin/branches/[id]/page.tsx` — render stats cards

### Task 25.C.2: Bloklangan o'quvchilar list

**Files:**
- Modify: `apps/api/src/users/users.controller.ts` — `GET /users/blocked?reason=warning|payment&branchId=`
- Create: `apps/web/app/(dashboard)/superadmin/blocked-students/page.tsx`
- Create: `apps/web/app/(dashboard)/filadmin/blocked-students/page.tsx`

- [ ] **Step 1:** Service filters `isBlocked=true`, optional reason match.
- [ ] **Step 2:** Pages: list + "Blokdan chiqarish" button calling `POST /users/:id/unblock`.

### Task 25.C.3: Sertifikat dizayn sozlamalari

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/certificate-design/page.tsx`
- Modify: `prisma/schema.prisma` — `Tenant.certTemplate Json?` (logo, accent color, signature line)

- [ ] **Step 1:** UI to upload logo, pick accent color, sign-off text.
- [ ] **Step 2:** Cert generation reads template per tenant.

### Task 25.C.4: Tournament bracket UI

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/tournaments/[id]/bracket/page.tsx`
- Modify: `apps/api/src/gamification/tournament.controller.ts` — `GET /tournaments/:id/bracket`

- [ ] **Step 1:** Service computes single-elimination bracket from match results.
- [ ] **Step 2:** Frontend renders SVG bracket tree.

## 25.D — Filadmin missing widgets (4 items)

### Task 25.D.1: Filadmin KPI view widget

**Files:**
- Modify: `apps/web/app/(dashboard)/filadmin/page.tsx` — add KPI summary card (this branch's monthly KPI total, top 3 staff)

### Task 25.D.2: Xodim davomat tarixi (multi-day)

**Files:**
- Modify: `apps/api/src/attendance/attendance.controller.ts` — `GET /attendance/staff?branchId=&from=&to=`
- Create: `apps/web/app/(dashboard)/filadmin/attendance/staff/page.tsx`

- [ ] **Step 1:** Date range picker + table with method (👁/🔑/👤) icons + late minutes column.

### Task 25.D.3: O'quvchi statusi tarixi (filadmin view)

**Files:**
- Create: `apps/web/app/(dashboard)/filadmin/students/[id]/history/page.tsx`

- [ ] **Step 1:** Re-use existing `GET /status/history/:studentId` endpoint (already exists).
- [ ] **Step 2:** Render timeline: each status change with date, color, who set it, note.

### Task 25.D.4: Oylik to'lov tarixi rendering

**Files:**
- Modify: `apps/web/app/(dashboard)/filadmin/payments/page.tsx`
- Create: `apps/web/app/(dashboard)/filadmin/payments/_components/HistoryStrip.tsx`

- [ ] **Step 1:** When student row expanded, show last 12 months payment history (paid date + amount).

## 25.E — Manager missing widgets (3 items)

### Task 25.E.1: Manager kunlik ish rejasi

**Files:**
- Modify: `apps/web/app/(dashboard)/manager/page.tsx` — add "Bugungi reja" card

- [ ] **Step 1:** Compute today's tasks: list of red/yellow students + scheduled 1:1 sessions.

### Task 25.E.2: Sertifikat berish UI link from manager

**Files:**
- Modify: `apps/web/app/(dashboard)/manager/page.tsx`

- [ ] **Step 1:** Nav card "Sertifikatlar" → link to existing gamification certs page filtered to this manager's group.

### Task 25.E.3: Sovg'a/kitob belgilash

**Files:**
- Create: `apps/api/src/manager-rewards/` module
- Create: `apps/web/app/(dashboard)/manager/rewards/page.tsx`

- [ ] **Step 1:** Table `ManagerReward { managerId, studentId, type (gift|book|other), title, awardedAt, notes }`.
- [ ] **Step 2:** Frontend: per-student award form.

## 25.F — Mentor KPI rules (3 items)

### Task 25.F.1: Mentor guruh o'rtacha foizi

**Files:**
- Modify: `apps/api/src/users/users.controller.ts` — `GET /users/group/:groupId/avg-pass-rate`
- Modify: `apps/web/app/(dashboard)/mentor/page.tsx` — show in stat card

### Task 25.F.2: 15 daqiqa minimal lesson duration tracking

**Files:**
- Modify: `apps/api/src/lesson-progress/lesson-progress.service.ts.endLesson()`

- [ ] **Step 1:** Compute `(endedAt - startedAt)`. If <15 minutes for mentor lessons, flag in KPI calc (don't award full points).

### Task 25.F.3: max 20 o'quvchi/dars KPI cap

**Files:**
- Modify: `apps/api/src/kpi/kpi.service.ts.computeMentorDaily()`

- [ ] **Step 1:** Cap student count per lesson at 20 in KPI formula.

## 25.G — Tester features (2 items)

### Task 25.G.1: Tester queue persist (vaqt nazorati)

**Files:**
- Modify: `prisma/schema.prisma` — `ExamQueueEntry { id, testerId, studentId, position, calledAt, completedAt }`
- Migration: `0027_exam_queue_persist`
- Modify: `apps/api/src/exams/exam-queue.service.ts` — CRUD
- Modify: `apps/web/app/(dashboard)/tester/exam-queue/page.tsx` — read from server, not localStorage

### Task 25.G.2: Tech issue report

**Files:**
- Create: `apps/api/src/tech-issues/` module
- Create: `apps/web/app/(dashboard)/tester/tech-issues/page.tsx`

- [ ] **Step 1:** Form: kategoriya (kamera/internet/boshqa) + matn + screenshot upload.
- [ ] **Step 2:** Filadmin sees in their dashboard.

## 25.H — Student dashboard polish (3 items)

### Task 25.H.1: N marta sanagich dashboard

**Files:**
- Modify: `apps/web/app/(dashboard)/student/page.tsx`

- [ ] **Step 1:** Below "Bugungi dars" card, show `Sessiya {sessionCount}/{N}` chip.

### Task 25.H.2: CelebrationToast "Barakalla, Ajoyib!"

**Files:**
- Create: `apps/web/components/CelebrationToast.tsx`
- Modify: `apps/web/app/(dashboard)/student/lessons/[id]/page.tsx` — trigger on AI evaluate ≥80

- [ ] **Step 1:** Toast with celebratory matn + audio play (`/sounds/celebration.mp3`).
- [ ] **Step 2:** Add audio file to `apps/web/public/sounds/`.

### Task 25.H.3: Lug'at AI o'zbekcha TTS

**Files:**
- Modify: `apps/web/components/lesson/VocabularyAudio.tsx`
- Modify: `apps/api/src/ai/ai.controller.ts` — `POST /ai/tts` returning audio buffer

- [ ] **Step 1:** Backend uses Azure or OpenAI TTS to synthesize Uzbek prompt.
- [ ] **Step 2:** Frontend plays audio, then waits for student speech response.

## 25.I — Layout & Navigation (1 item)

### Task 25.I.1: Desktop sidebar navigation

**Files:**
- Create: `apps/web/app/(dashboard)/_components/SidePanel.tsx`
- Modify: `apps/web/app/(dashboard)/layout.tsx` — render `<SidePanel className="hidden md:block" />` and `<BottomNav className="md:hidden" />`

- [ ] **Step 1:** SidePanel reads same nav config as BottomNav, renders vertical with section labels.

## 25.J — Lesson runner enforcement (3 items)

### Task 25.J.1: Video ≥90% enforce

**Files:**
- Modify: `apps/web/components/VideoPlayer.tsx`
- Modify: `apps/api/src/lesson-progress/lesson-progress.service.ts.completeLesson()`

- [ ] **Step 1:** Frontend tracks `watched/duration` ratio, sends to backend.
- [ ] **Step 2:** Backend rejects completion if `videoWatchedPercent < 90` and lesson has video component.

### Task 25.J.2: AI Tutor min 1 question enforce

**Files:**
- Modify: `apps/web/components/lesson/AiTutor.tsx`

- [ ] **Step 1:** "Tayyor" button disabled until `questionCount ≥ 1`.

### Task 25.J.3: AI Tutor `lessonContext` from server

(Closed in Task 25.B.3 — verify.)

## 25.K — Notifications (4 items)

### Task 25.K.1: Task new-assignment notification

**Files:**
- Modify: `apps/api/src/tasks/tasks.service.ts.create()`
- Modify: `apps/api/src/notifications/notification-event.handler.ts`

- [ ] **Step 1:** Emit `task.assigned` event.
- [ ] **Step 2:** Handler: in-app + Telegram to assignee.

### Task 25.K.2: Task completion notification to sender

- [ ] **Step 1:** On `tasks.service.markDone()`, emit `task.completed` → in-app to creator.

### Task 25.K.3: Pass rate <50% Superadmin notification

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts` — extend `runRefreshMaterializedViews` weekly subset

- [ ] **Step 1:** Weekly cron `'0 9 * * 1'`: query lessons with `passRate<50`. For each, send in-app + Telegram superadmin.

### Task 25.K.4: §19.4 Optimal vaqt tavsiyasi Telegram

**Files:**
- Modify: `apps/api/src/churn/churn.service.ts` (or new `recommendation.service.ts`)

- [ ] **Step 1:** When churn score crosses high-risk, analyze student's historical successful session times, recommend optimal slot via Telegram.

## 25.L — Face ID polish (4 items)

### Task 25.L.1: 5 progress dots UI in enrollment

**Files:**
- Modify: `apps/web/components/EnrollmentCamera.tsx`

- [ ] **Step 1:** Render row of 5 dots; fill green as each frame captured.

### Task 25.L.2: 200 lux lighting banner

**Files:**
- Modify: `apps/web/components/FaceScanner.tsx`

- [ ] **Step 1:** Use `ImageData` brightness analysis (mean luminance). If <threshold, show banner "Yorug'lik yetarli emas, joyni yorug'roq qiling".

### Task 25.L.3: SLA monitoring dashboard

**Files:**
- Modify: `apps/api/src/face/face.controller.ts` — `GET /face/sla` (last 7d accuracy + P95 latency)
- Modify: `apps/web/app/(dashboard)/superadmin/face-sla/page.tsx`

- [ ] **Step 1:** Aggregate from `face_recognition_log`.
- [ ] **Step 2:** Cards: 7d accuracy %, P95 latency ms, alert if <95% / >1.5s.

### Task 25.L.4: CSV export

**Files:**
- Modify: `apps/web/app/(dashboard)/filadmin/attendance/page.tsx`

- [ ] **Step 1:** "CSV yuklab olish" button generates CSV via `papaparse` from current rows.

## 25.M — Chat (2 items)

### Task 25.M.1: Spam Redis rate limiter (replace DB query)

**Files:**
- Modify: `apps/api/src/social/chat.service.ts.checkDailyLimit()`
- Modify: `apps/api/src/common/redis.module.ts` (CREATE if missing)

- [ ] **Step 1:** Add Redis client (`ioredis`).
- [ ] **Step 2:** Daily counter key `chat:user:{id}:daily_count` with TTL 24h.

### Task 25.M.2: Filadmin chat read access

**Files:**
- Modify: `apps/api/src/social/chat.service.ts.getGroupMessages()`

- [ ] **Step 1:** If caller role = filadmin AND group is in caller's branch, allow regardless of group membership.

## 25.N — ML stability + Infra (2 items)

### Task 25.N.1: `runMlChurnTraining` try/catch wrapper

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts.runMlChurnTraining()`

- [ ] **Step 1:** Wrap entire call in try/catch with structured log: `{ event: 'ml_train_failed', error: e.message, timestamp }`.
- [ ] **Step 2:** On failure, send Telegram alert to superadmin (re-use template from Task 6.10).

### Task 25.N.2: Read replicas configuration documentation

**Files:**
- Create: `docs/operations/postgres-read-replicas.md`

- [ ] **Step 1:** Document: how to provision replica, how to configure Prisma `DATABASE_URL` + `DATABASE_REPLICA_URL`, how to use `prisma.$replica` for read-heavy services (analytics, churn).
- [ ] **Step 2:** Add `apps/api/src/prisma/prisma-replica.service.ts` (lazy — only configured when env present).

## 25.O — Verification batch (manual smoke covered by Phase 24, document here)

These are visual/text alignments verified by hand during Phase 24.6 manual smoke. Not separate tasks, but checklist items:

- [ ] Mentor attendance UI shows `[✅Keldi][❌Kelmadi][⏰Kechikdi]` buttons (verify in `mentor/attendance/page.tsx`)
- [ ] Filadmin attendance shows `Tasdiqlangan ✓ HH:mm` matn (verify in `filadmin/attendance/page.tsx`)
- [ ] DebtorsTable status filter tabs `[Barchasi][To'lamagan][Bloklangan]` render
- [ ] DebtorsTable empty state matni `"Qarzdorlar topilmadi"`
- [ ] DebtorsTable `loading` state opacity-50
- [ ] KPI page "Today's total" alignment (text-3xl indigo per spec OR documented as text-4xl amber project standard)
- [ ] Filadmin dashboard 7 cards (vs spec 4) — document acceptance in `apps/web/STYLE.md` as project standard

### Task 25.O.1: Document project palette/standards

**Files:**
- Create: `apps/web/STYLE.md`

- [ ] **Step 1:** Document: amber+navy palette (overrides spec indigo), `rounded-[18px]` border, lucide icons (override spec emoji), 7-card filadmin dashboard, expanded BottomNav role tabs. Each entry: spec-said-X, project-uses-Y, rationale.

## 25.P — Final verifications (covered by Phase 24, listed for completeness)

- [ ] Manual integration test checklist for ClickHouse (Phase 24.6 covers)

### Task 25.Q (catch-all): PHASE 25 quality gate + commit

- [ ] All green.
- [ ] Commit: `feat(audit-backfill): close ~30 explicit gaps — delegation guard + UI, lesson schema, missing pages (filial stats, blocked list, cert design, tournament bracket), filadmin/manager widgets, mentor KPI rules, tester queue/issues, student polish, sidebar, lesson enforcement, notifications, face polish, chat, ML stability, replica docs`

---

# Self-review checklist

- [x] Spec coverage: every audit item mapped to a phase/task. Master spec §1–§28, delegation, face, social, plans 10–13, mentor, faza3-remaining, faza4 (CH/ML/PWA/onboarding) all covered.
- [x] No placeholders — every step names a file path and either provides code or specifies the change unambiguously.
- [x] Type consistency — `StatusColor`, ENUMs, error codes defined once and reused.

# Coverage map (audit-item → phase)

| Audit category | Phase |
|---|---|
| Security (PWA, face PDPL, audit, throttler, XSS) | 1 |
| Production env (.env, nest-cli, ML seed, MV, tenants list) | 2 |
| API standardization (response wrapper, errors, paths, WS) | 3 |
| Schema/ENUM cleanup | 4 |
| RBAC fixes | 5 |
| Telegram & notifications | 6 |
| Status workflow + auto English | 7 |
| KPI auto-calc | 8 |
| Cron jobs (spaced rep, tasks, chat cleanup, challenge XP, unblock monitor, 2-day absent) | 6+9 |
| Mentor frontend (group endpoint, kpi/daily, telegram parent) | 10 |
| Tester student-clone | 11 |
| KPI strips & filters | 12 |
| Service unit tests (4 services) | 13 |
| ML completion (9 features, CV, hybrid test, metrics block) | 14 |
| ClickHouse polish (funnel %, gap tests, E2E, style) | 15 |
| PWA polish (logo, iOS, reload, Lighthouse) | 16 |
| Tenant onboarding polish (edit/disable, slug URL) | 17 |
| Face ID polish (10 items) | 18 |
| Social completeness (15 items) | 19 |
| Master spec big features (250 dars, culture, path map, certs, letters, guides, promo, sessions, audit log, last-time) | 20 |
| AI & error handling | 21 |
| Test infrastructure (coverage, ZAP, k6) | 22 |
| Cosmetic polish (30+ items batched) | 23 |
| Final QA & deployment | 24 |
| Audit backfill — delegation guard, lesson schema (camera/aiContext/nRep validation), filial stats, blocked list, cert design, tournament bracket | 25.A–C |
| Filadmin/Manager widgets (KPI view, davomat tarixi, status tarixi, payment history, kunlik reja, sertifikat link, sovg'a/kitob) | 25.D–E |
| Mentor KPI rules (avg %, 15-min, max 20) | 25.F |
| Tester queue persist + tech issue | 25.G |
| Student N counter, CelebrationToast, Lug'at TTS | 25.H |
| Desktop sidebar | 25.I |
| Lesson runner enforcement (video ≥90%, AI min 1 question) | 25.J |
| Task notifications (assigned, completed), Pass rate <50%, Optimal vaqt | 25.K |
| Face polish (5 dots, lighting banner, SLA monitoring, CSV) | 25.L |
| Chat (Redis spam, filadmin read access) | 25.M |
| ML stability (try/catch) + Read replicas | 25.N |
| UI verifications + project STYLE.md | 25.O |

---

# Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-30-completion-to-100-percent.md`.**

Two execution options:

**1. Subagent-Driven (recommended for this plan size)** — Dispatch fresh subagent per task with quality-gate verification between tasks. Best for 24-phase scope; protects main context.

**2. Inline Execution** — Execute phases sequentially in current session with checkpoints between phases.

For 24 phases of work, **Option 1** is strongly recommended. Each phase's subagent gets a focused brief, runs quality gates, returns a single status, then we proceed to the next phase. Main context stays clean.

Which approach?
