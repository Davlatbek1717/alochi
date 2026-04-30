# Faza 3 Qolgan Subsystemlar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Adaptive Difficulty, Content Quality + A/B Test, Churn Prediction, and PostgreSQL Analytics subsystems.

**Architecture:** 4 new NestJS modules (adaptive, content-quality, churn, analytics) + 4 Prisma migrations + event logging in 3 existing services + 5 frontend pages.

**Tech Stack:** NestJS, Prisma v5, PostgreSQL 18, Next.js 14 App Router, TypeScript

---

## File Map

**Create:**
- `prisma/migrations/0015_adaptive/migration.sql`
- `prisma/migrations/0016_content_quality/migration.sql`
- `prisma/migrations/0017_churn/migration.sql`
- `prisma/migrations/0018_analytics/migration.sql`
- `apps/api/src/adaptive/adaptive.service.ts`
- `apps/api/src/adaptive/adaptive.controller.ts`
- `apps/api/src/adaptive/adaptive.module.ts`
- `apps/api/src/content-quality/content-quality.service.ts`
- `apps/api/src/content-quality/content-quality.controller.ts`
- `apps/api/src/content-quality/content-quality.module.ts`
- `apps/api/src/churn/churn.service.ts`
- `apps/api/src/churn/churn.controller.ts`
- `apps/api/src/churn/churn.module.ts`
- `apps/api/src/analytics/analytics.service.ts`
- `apps/api/src/analytics/analytics.controller.ts`
- `apps/api/src/analytics/analytics.module.ts`
- `apps/api/test/adaptive.spec.ts`
- `apps/api/test/churn.spec.ts`
- `apps/api/test/content-quality.spec.ts`
- `apps/api/test/analytics.spec.ts`
- `apps/web/app/(dashboard)/superadmin/adaptive/page.tsx`
- `apps/web/app/(dashboard)/superadmin/content-quality/page.tsx`
- `apps/web/app/(dashboard)/superadmin/churn/page.tsx`
- `apps/web/app/(dashboard)/superadmin/analytics/page.tsx`
- `apps/web/app/(dashboard)/student/lessons/[id]/_components/FeedbackWidget.tsx`

**Modify:**
- `prisma/schema.prisma` — 6 new models + back-relations + changedBy nullable
- `apps/api/src/cron/cron.service.ts` — 3 new cron methods
- `apps/api/src/cron/cron.module.ts` — import AdaptiveModule, ChurnModule
- `apps/api/src/lesson-progress/progress.service.ts` — analytics event logging
- `apps/api/src/attendance/attendance-students.service.ts` — analytics event logging
- `apps/api/src/gamification/streak.service.ts` — analytics event logging
- `apps/api/src/app.module.ts` — register 4 new modules
- `apps/web/app/(dashboard)/manager/page.tsx` — churn block
- `apps/web/app/(dashboard)/superadmin/page.tsx` — new nav cards

---

## Task 1: Prisma Schema + Migrations

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/0015_adaptive/migration.sql`
- Create: `prisma/migrations/0016_content_quality/migration.sql`
- Create: `prisma/migrations/0017_churn/migration.sql`
- Create: `prisma/migrations/0018_analytics/migration.sql`

- [ ] **Step 1: Add 6 new models to prisma/schema.prisma**

First, make `changedBy` nullable in `StudentLessonConfig` (needed for cron-generated configs):
```prisma
// In StudentLessonConfig model, change:
changedBy   String?  @map("changed_by") @db.Uuid
```

Add back-relations to existing models. In `Tenant` model add:
```prisma
adaptiveDifficultyConfig AdaptiveDifficultyConfig?
```

In `User` model add (after `tournamentRegistrations`):
```prisma
adaptiveLogs        AdaptiveDifficultyLog[]  @relation("AdaptiveLogs")
lessonFeedbacks     LessonFeedback[]         @relation("LessonFeedbacks")
variantAssignments  StudentVariantAssignment[] @relation("VariantAssignments")
churnScore          ChurnScore?              @relation("ChurnScores")
```

In `Lesson` model add (after `examPermissions`):
```prisma
adaptiveLogs        AdaptiveDifficultyLog[]  @relation("AdaptiveLogs")
feedbacks           LessonFeedback[]         @relation("LessonFeedbacks")
variants            LessonVariant[]          @relation("LessonVariants")
variantAssignments  StudentVariantAssignment[] @relation("VariantAssignments")
```

Add 6 new models at the end of `schema.prisma`:
```prisma
// ---- ADAPTIVE DIFFICULTY ----
model AdaptiveDifficultyConfig {
  id            String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId      String   @unique @map("tenant_id") @db.Uuid
  minN          Int      @default(1) @map("min_n")
  maxN          Int      @default(10) @map("max_n")
  hardThreshold Float    @default(0.40) @map("hard_threshold")
  easyThreshold Float    @default(0.15) @map("easy_threshold")
  updatedAt     DateTime @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@map("adaptive_difficulty_configs")
}

model AdaptiveDifficultyLog {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId String   @map("student_id") @db.Uuid
  lessonId  String   @map("lesson_id") @db.Uuid
  oldN      Int      @map("old_n")
  newN      Int      @map("new_n")
  errorRate Float    @map("error_rate")
  changedAt DateTime @default(now()) @map("changed_at")

  student User   @relation("AdaptiveLogs", fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson @relation("AdaptiveLogs", fields: [lessonId], references: [id], onDelete: Cascade)

  @@index([studentId])
  @@map("adaptive_difficulty_logs")
}

// ---- CONTENT QUALITY + A/B TEST ----
model LessonFeedback {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId String   @map("student_id") @db.Uuid
  lessonId  String   @map("lesson_id") @db.Uuid
  rating    Int
  createdAt DateTime @default(now()) @map("created_at")

  student User   @relation("LessonFeedbacks", fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson @relation("LessonFeedbacks", fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([studentId, lessonId])
  @@map("lesson_feedbacks")
}

model LessonVariant {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  lessonId  String   @map("lesson_id") @db.Uuid
  variant   String
  isActive  Boolean  @default(true) @map("is_active")
  config    Json
  createdAt DateTime @default(now()) @map("created_at")

  lesson      Lesson                   @relation("LessonVariants", fields: [lessonId], references: [id], onDelete: Cascade)
  assignments StudentVariantAssignment[]

  @@unique([lessonId, variant])
  @@map("lesson_variants")
}

model StudentVariantAssignment {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId  String   @map("student_id") @db.Uuid
  lessonId   String   @map("lesson_id") @db.Uuid
  variantId  String   @map("variant_id") @db.Uuid
  assignedAt DateTime @default(now()) @map("assigned_at")

  student User          @relation("VariantAssignments", fields: [studentId], references: [id], onDelete: Cascade)
  lesson  Lesson        @relation("VariantAssignments", fields: [lessonId], references: [id], onDelete: Cascade)
  variant LessonVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@unique([studentId, lessonId])
  @@map("student_variant_assignments")
}

// ---- CHURN PREDICTION ----
model ChurnScore {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId String   @unique @map("student_id") @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  score     Int      @default(0)
  signals   Json
  alertSent Boolean  @default(false) @map("alert_sent")
  updatedAt DateTime @updatedAt @map("updated_at")

  student User @relation("ChurnScores", fields: [studentId], references: [id], onDelete: Cascade)

  @@index([tenantId, score])
  @@map("churn_scores")
}

// ---- ANALYTICS ----
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

- [ ] **Step 2: Create migration 0015**

Create directory `prisma/migrations/0015_adaptive/` and file `migration.sql`:
```sql
-- Make changed_by nullable (for system-generated adaptive configs)
ALTER TABLE "student_lesson_config" ALTER COLUMN "changed_by" DROP NOT NULL;

-- Adaptive difficulty config (one per tenant)
CREATE TABLE "adaptive_difficulty_configs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "min_n" INTEGER NOT NULL DEFAULT 1,
  "max_n" INTEGER NOT NULL DEFAULT 10,
  "hard_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
  "easy_threshold" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "adaptive_difficulty_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "adaptive_difficulty_configs_tenant_id_key" ON "adaptive_difficulty_configs"("tenant_id");

ALTER TABLE "adaptive_difficulty_configs" ADD CONSTRAINT "adaptive_difficulty_configs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adaptive difficulty log
CREATE TABLE "adaptive_difficulty_logs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "old_n" INTEGER NOT NULL,
  "new_n" INTEGER NOT NULL,
  "error_rate" DOUBLE PRECISION NOT NULL,
  "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "adaptive_difficulty_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "adaptive_difficulty_logs_student_id_idx" ON "adaptive_difficulty_logs"("student_id");

ALTER TABLE "adaptive_difficulty_logs" ADD CONSTRAINT "adaptive_difficulty_logs_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "adaptive_difficulty_logs" ADD CONSTRAINT "adaptive_difficulty_logs_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Create migration 0016**

Create `prisma/migrations/0016_content_quality/migration.sql`:
```sql
-- Lesson feedback (student rating: 1=hard, 2=medium, 3=easy)
CREATE TABLE "lesson_feedbacks" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lesson_feedbacks_student_id_lesson_id_key" ON "lesson_feedbacks"("student_id", "lesson_id");

ALTER TABLE "lesson_feedbacks" ADD CONSTRAINT "lesson_feedbacks_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "lesson_feedbacks" ADD CONSTRAINT "lesson_feedbacks_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lesson variants (A/B test)
CREATE TABLE "lesson_variants" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "lesson_id" UUID NOT NULL,
  "variant" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lesson_variants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lesson_variants_lesson_id_variant_key" ON "lesson_variants"("lesson_id", "variant");

ALTER TABLE "lesson_variants" ADD CONSTRAINT "lesson_variants_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Student variant assignments
CREATE TABLE "student_variant_assignments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_variant_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "student_variant_assignments_student_id_lesson_id_key" ON "student_variant_assignments"("student_id", "lesson_id");

ALTER TABLE "student_variant_assignments" ADD CONSTRAINT "student_variant_assignments_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_variant_assignments" ADD CONSTRAINT "student_variant_assignments_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_variant_assignments" ADD CONSTRAINT "student_variant_assignments_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "lesson_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 4: Create migration 0017**

Create `prisma/migrations/0017_churn/migration.sql`:
```sql
CREATE TABLE "churn_scores" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "student_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "score" INTEGER NOT NULL DEFAULT 0,
  "signals" JSONB NOT NULL,
  "alert_sent" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "churn_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "churn_scores_student_id_key" ON "churn_scores"("student_id");
CREATE INDEX "churn_scores_tenant_id_score_idx" ON "churn_scores"("tenant_id", "score");

ALTER TABLE "churn_scores" ADD CONSTRAINT "churn_scores_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 5: Create migration 0018**

Create `prisma/migrations/0018_analytics/migration.sql`:
```sql
-- Analytics events table
CREATE TABLE "analytics_events" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "student_id" UUID,
  "branch_id" UUID,
  "data" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_events_tenant_event_time_idx" ON "analytics_events"("tenant_id", "event_type", "created_at");
CREATE INDEX "analytics_events_tenant_branch_time_idx" ON "analytics_events"("tenant_id", "branch_id", "created_at");

-- Materialized view: lesson stats
CREATE MATERIALIZED VIEW lesson_stats_mv AS
SELECT
  sp.lesson_id,
  l.tenant_id,
  COUNT(DISTINCT sp.student_id) AS total_students,
  COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.academy_completed) AS passed,
  ROUND(
    COUNT(DISTINCT sp.student_id) FILTER (WHERE sp.academy_completed)::numeric
    / NULLIF(COUNT(DISTINCT sp.student_id), 0) * 100, 1
  ) AS pass_rate,
  ROUND(AVG(sp.session_count), 1) AS avg_sessions,
  ROUND(AVG(lf.rating)::numeric, 2) AS feedback_avg
FROM student_progress sp
JOIN lessons l ON sp.lesson_id = l.id
LEFT JOIN lesson_feedbacks lf ON sp.lesson_id = lf.lesson_id AND sp.student_id = lf.student_id
GROUP BY sp.lesson_id, l.tenant_id;

CREATE UNIQUE INDEX lesson_stats_mv_lesson_idx ON lesson_stats_mv(lesson_id);

-- Materialized view: branch stats
CREATE MATERIALIZED VIEW branch_stats_mv AS
SELECT
  u.branch_id,
  u.tenant_id,
  COUNT(DISTINCT u.id) AS active_students,
  ROUND(AVG(sx.current_streak), 1) AS avg_streak,
  ROUND(AVG(sx.total_xp), 0) AS avg_xp
FROM users u
JOIN student_xp sx ON u.id = sx.student_id
WHERE u.role = 'student' AND u.status = 'active'
GROUP BY u.branch_id, u.tenant_id;

CREATE UNIQUE INDEX branch_stats_mv_branch_idx ON branch_stats_mv(branch_id);
```

- [ ] **Step 6: Apply migrations and regenerate Prisma client**

```bash
cd d:/projects/alochi
npx prisma migrate deploy
npx prisma generate
```

Expected: 4 new migrations applied, `Generated Prisma Client`.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd d:/projects/alochi/apps/api
npx tsc --noEmit
```

Expected: 0 errors (the `changedBy` nullable change may produce warnings in student-lesson-config service — fix them if needed by making the field optional in create calls).

- [ ] **Step 8: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/0015_adaptive prisma/migrations/0016_content_quality prisma/migrations/0017_churn prisma/migrations/0018_analytics
git commit -m "feat: add schema models for adaptive, content-quality, churn, analytics (migrations 0015-0018)"
```

---

## Task 2: Analytics Module

**Files:**
- Create: `apps/api/src/analytics/analytics.service.ts`
- Create: `apps/api/src/analytics/analytics.controller.ts`
- Create: `apps/api/src/analytics/analytics.module.ts`
- Test: `apps/api/test/analytics.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/analytics.spec.ts`:
```typescript
import { AnalyticsService } from '../src/analytics/analytics.service';

describe('AnalyticsService', () => {
  const mockPrisma = {
    $queryRawUnsafe: jest.fn(),
    analyticsEvent: {
      groupBy: jest.fn(),
    },
  };

  const service = new AnalyticsService(mockPrisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('getLessonStats returns rows from materialized view', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { lesson_id: 'l-1', pass_rate: 75.0, total_students: 10, passed: 7, avg_sessions: 3.2, feedback_avg: 2.5 },
    ]);

    const result = await service.getLessonStats('tenant-1');

    expect(result).toHaveLength(1);
    expect(result[0].passRate).toBe(75.0);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('lesson_stats_mv'),
      'tenant-1',
    );
  });

  it('getBranchStats returns rows from materialized view', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { branch_id: 'b-1', active_students: 20, avg_streak: 5.5, avg_xp: 1200 },
    ]);

    const result = await service.getBranchStats('tenant-1');

    expect(result).toHaveLength(1);
    expect(result[0].avgStreak).toBe(5.5);
  });

  it('getStudentActivity returns daily counts for period', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { day: '2026-04-01', count: '15' },
      { day: '2026-04-02', count: '18' },
    ]);

    const result = await service.getStudentActivity('tenant-1', 'weekly');
    expect(result).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd d:/projects/alochi && npx jest apps/api/test/analytics.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '../src/analytics/analytics.service'`

- [ ] **Step 3: Create analytics.service.ts**

Create `apps/api/src/analytics/analytics.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getLessonStats(tenantId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
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
      feedbackAvg: r.feedback_avg ? Number(r.feedback_avg) : null,
    }));
  }

  async getBranchStats(tenantId: string) {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
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
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT DATE_TRUNC('day', created_at)::date::text AS day, COUNT(DISTINCT student_id)::text AS count
       FROM analytics_events
       WHERE tenant_id = $1
         AND event_type = 'lesson_completed'
         AND created_at >= NOW() - INTERVAL '${days} days'
       GROUP BY 1 ORDER BY 1`,
      tenantId,
    );
    return rows.map((r) => ({ day: r.day, count: Number(r.count) }));
  }

  async logEvent(params: {
    tenantId: string;
    eventType: string;
    studentId?: string;
    branchId?: string;
    data?: object;
  }) {
    return this.prisma.analyticsEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: params.eventType,
        studentId: params.studentId ?? null,
        branchId: params.branchId ?? null,
        data: params.data ?? {},
      },
    });
  }
}
```

- [ ] **Step 4: Create analytics.controller.ts**

Create `apps/api/src/analytics/analytics.controller.ts`:
```typescript
import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('lessons')
  @Roles(UserRole.superadmin)
  getLessons(@Request() req: any) {
    return this.analytics.getLessonStats(req.user.tenantId);
  }

  @Get('branches')
  @Roles(UserRole.superadmin, UserRole.filadmin)
  getBranches(@Request() req: any) {
    return this.analytics.getBranchStats(req.user.tenantId);
  }

  @Get('activity')
  @Roles(UserRole.superadmin)
  getActivity(
    @Request() req: any,
    @Query('period') period: 'weekly' | 'monthly' = 'monthly',
  ) {
    return this.analytics.getStudentActivity(req.user.tenantId, period);
  }
}
```

- [ ] **Step 5: Create analytics.module.ts**

Create `apps/api/src/analytics/analytics.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';

@Module({
  providers: [AnalyticsService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
```

- [ ] **Step 6: Run tests and verify pass**

```bash
cd d:/projects/alochi && npx jest apps/api/test/analytics.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/analytics apps/api/test/analytics.spec.ts
git commit -m "feat: add AnalyticsModule (service, controller, module)"
```

---

## Task 3: Adaptive Module

**Files:**
- Create: `apps/api/src/adaptive/adaptive.service.ts`
- Create: `apps/api/src/adaptive/adaptive.controller.ts`
- Create: `apps/api/src/adaptive/adaptive.module.ts`
- Test: `apps/api/test/adaptive.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/adaptive.spec.ts`:
```typescript
import { AdaptiveService } from '../src/adaptive/adaptive.service';

describe('AdaptiveService', () => {
  const mockPrisma = {
    adaptiveDifficultyConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    lessonComponent: {
      findMany: jest.fn(),
    },
    errorLog: {
      aggregate: jest.fn(),
    },
    studentLessonConfig: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    adaptiveDifficultyLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const service = new AdaptiveService(mockPrisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('increases nRepetitionsOverride when errorRate > hardThreshold', async () => {
    const config = { minN: 1, maxN: 10, hardThreshold: 0.40, easyThreshold: 0.15 };
    // errorRate = 5 errors / 10 questions = 0.50 > 0.40
    expect(service.computeNewN(3, 5, 10, config)).toBe(4); // 3 + 1
  });

  it('decreases nRepetitionsOverride when errorRate < easyThreshold', async () => {
    const config = { minN: 1, maxN: 10, hardThreshold: 0.40, easyThreshold: 0.15 };
    // errorRate = 1 / 10 = 0.10 < 0.15
    expect(service.computeNewN(3, 1, 10, config)).toBe(2); // 3 - 1
  });

  it('does not change N when errorRate is in the middle range', async () => {
    const config = { minN: 1, maxN: 10, hardThreshold: 0.40, easyThreshold: 0.15 };
    // errorRate = 3 / 10 = 0.30 is between 0.15 and 0.40
    expect(service.computeNewN(3, 3, 10, config)).toBe(3);
  });

  it('does not exceed maxN', async () => {
    const config = { minN: 1, maxN: 5, hardThreshold: 0.40, easyThreshold: 0.15 };
    expect(service.computeNewN(5, 8, 10, config)).toBe(5); // already at max
  });

  it('does not go below minN', async () => {
    const config = { minN: 2, maxN: 10, hardThreshold: 0.40, easyThreshold: 0.15 };
    expect(service.computeNewN(2, 1, 10, config)).toBe(2); // already at min
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd d:/projects/alochi && npx jest apps/api/test/adaptive.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../src/adaptive/adaptive.service'`

- [ ] **Step 3: Create adaptive.service.ts**

Create `apps/api/src/adaptive/adaptive.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AdaptiveConfig {
  minN: number;
  maxN: number;
  hardThreshold: number;
  easyThreshold: number;
}

@Injectable()
export class AdaptiveService {
  private readonly logger = new Logger(AdaptiveService.name);

  constructor(private prisma: PrismaService) {}

  computeNewN(currentN: number, errorCount: number, totalQuestions: number, config: AdaptiveConfig): number {
    if (totalQuestions === 0) return currentN;
    const errorRate = errorCount / totalQuestions;

    if (errorRate > config.hardThreshold) {
      return Math.min(currentN + 1, config.maxN);
    }
    if (errorRate < config.easyThreshold) {
      return Math.max(currentN - 1, config.minN);
    }
    return currentN;
  }

  async getAdaptiveConfig(tenantId: string) {
    const existing = await this.prisma.adaptiveDifficultyConfig.findUnique({
      where: { tenantId },
    });
    if (existing) return existing;

    return this.prisma.adaptiveDifficultyConfig.upsert({
      where: { tenantId },
      create: { tenantId },
      update: {},
    });
  }

  async updateAdaptiveConfig(tenantId: string, dto: Partial<AdaptiveConfig>) {
    return this.prisma.adaptiveDifficultyConfig.update({
      where: { tenantId },
      data: dto,
    });
  }

  async getStudentAdaptiveLogs(studentId: string) {
    return this.prisma.adaptiveDifficultyLog.findMany({
      where: { studentId },
      orderBy: { changedAt: 'desc' },
      take: 50,
    });
  }

  async runNightlyAdaptation(tenantId: string) {
    const config = await this.getAdaptiveConfig(tenantId);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: 'active' },
      select: { id: true },
    });

    const lessons = await this.prisma.lesson.findMany({
      where: { tenantId, isPublished: true },
      select: { id: true, nRepetitions: true },
    });

    let adjusted = 0;

    for (const student of students) {
      for (const lesson of lessons) {
        const components = await this.prisma.lessonComponent.findMany({
          where: { lessonId: lesson.id },
          select: { config: true },
        });

        const totalQuestions = components.reduce((acc, c: any) => {
          return acc + (c.config?.questions?.length ?? 0);
        }, 0);

        if (totalQuestions === 0) continue;

        const agg = await this.prisma.errorLog.aggregate({
          where: {
            studentId: student.id,
            lessonId: lesson.id,
            lastError: { gte: sevenDaysAgo },
          },
          _sum: { errorCount: true },
        });
        const errorCount = agg._sum.errorCount ?? 0;

        const existing = await this.prisma.studentLessonConfig.findUnique({
          where: { studentId_lessonId: { studentId: student.id, lessonId: lesson.id } },
        });

        const currentN = existing?.nRepetitionsOverride ?? lesson.nRepetitions;
        const newN = this.computeNewN(currentN, errorCount, totalQuestions, config);

        if (newN === currentN) continue;

        const errorRate = errorCount / totalQuestions;

        await this.prisma.studentLessonConfig.upsert({
          where: { studentId_lessonId: { studentId: student.id, lessonId: lesson.id } },
          create: {
            studentId: student.id,
            lessonId: lesson.id,
            nRepetitionsOverride: newN,
          },
          update: { nRepetitionsOverride: newN },
        });

        await this.prisma.adaptiveDifficultyLog.create({
          data: {
            studentId: student.id,
            lessonId: lesson.id,
            oldN: currentN,
            newN,
            errorRate,
          },
        });

        adjusted++;
      }
    }

    this.logger.log(`Tenant ${tenantId}: ${adjusted} adaptatsiya amalga oshirildi`);
    return adjusted;
  }
}
```

- [ ] **Step 4: Create adaptive.controller.ts**

Create `apps/api/src/adaptive/adaptive.controller.ts`:
```typescript
import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AdaptiveService } from './adaptive.service';

@ApiTags('adaptive')
@ApiBearerAuth()
@Controller('adaptive')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdaptiveController {
  constructor(private adaptive: AdaptiveService) {}

  @Get('config')
  @Roles(UserRole.superadmin)
  getConfig(@Request() req: any) {
    return this.adaptive.getAdaptiveConfig(req.user.tenantId);
  }

  @Patch('config')
  @Roles(UserRole.superadmin)
  updateConfig(@Request() req: any, @Body() body: any) {
    return this.adaptive.updateAdaptiveConfig(req.user.tenantId, body);
  }

  @Get('logs/:studentId')
  @Roles(UserRole.superadmin, UserRole.manager, UserRole.mentor)
  getLogs(@Param('studentId') studentId: string) {
    return this.adaptive.getStudentAdaptiveLogs(studentId);
  }
}
```

- [ ] **Step 5: Create adaptive.module.ts**

Create `apps/api/src/adaptive/adaptive.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { AdaptiveService } from './adaptive.service';
import { AdaptiveController } from './adaptive.controller';

@Module({
  providers: [AdaptiveService],
  controllers: [AdaptiveController],
  exports: [AdaptiveService],
})
export class AdaptiveModule {}
```

- [ ] **Step 6: Run tests and verify pass**

```bash
cd d:/projects/alochi && npx jest apps/api/test/adaptive.spec.ts --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/adaptive apps/api/test/adaptive.spec.ts
git commit -m "feat: add AdaptiveModule with nightly difficulty adaptation logic"
```

---

## Task 4: Churn Module

**Files:**
- Create: `apps/api/src/churn/churn.service.ts`
- Create: `apps/api/src/churn/churn.controller.ts`
- Create: `apps/api/src/churn/churn.module.ts`
- Test: `apps/api/test/churn.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/churn.spec.ts`:
```typescript
import { ChurnService } from '../src/churn/churn.service';

describe('ChurnService', () => {
  const mockPrisma = {
    churnScore: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    attendanceStudent: {
      count: jest.fn(),
    },
    studentXp: {
      findUnique: jest.fn(),
    },
    studentProgress: {
      count: jest.fn(),
    },
    studentStatus: {
      findFirst: jest.fn(),
    },
  };

  const mockNotifications = { send: jest.fn().mockResolvedValue({}) };
  const service = new ChurnService(mockPrisma as any, mockNotifications as any);

  beforeEach(() => jest.clearAllMocks());

  it('computes score 30 when student absent 3 days', () => {
    const signals = {
      absent3Days: true,
      streakBroken: false,
      passRateDrop: false,
      redStatus: false,
      noParentTg: false,
    };
    expect(service.computeScore(signals)).toBe(30);
  });

  it('computes score 75 when absent + streak broken + red status', () => {
    const signals = {
      absent3Days: true,
      streakBroken: true,
      passRateDrop: false,
      redStatus: true,
      noParentTg: false,
    };
    expect(service.computeScore(signals)).toBe(75); // 30+20+25
  });

  it('caps score at 100 when all signals active', () => {
    const signals = {
      absent3Days: true,
      streakBroken: true,
      passRateDrop: true,
      redStatus: true,
      noParentTg: true,
    };
    expect(service.computeScore(signals)).toBe(100); // raw=110, capped to 100
  });

  it('score is 0 when no signals', () => {
    const signals = {
      absent3Days: false,
      streakBroken: false,
      passRateDrop: false,
      redStatus: false,
      noParentTg: false,
    };
    expect(service.computeScore(signals)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd d:/projects/alochi && npx jest apps/api/test/churn.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../src/churn/churn.service'`

- [ ] **Step 3: Create churn.service.ts**

Create `apps/api/src/churn/churn.service.ts`:
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface ChurnSignals {
  absent3Days: boolean;
  streakBroken: boolean;
  passRateDrop: boolean;
  redStatus: boolean;
  noParentTg: boolean;
}

@Injectable()
export class ChurnService {
  private readonly logger = new Logger(ChurnService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  computeScore(signals: ChurnSignals): number {
    let raw = 0;
    if (signals.absent3Days) raw += 30;
    if (signals.streakBroken) raw += 20;
    if (signals.passRateDrop) raw += 25;
    if (signals.redStatus) raw += 25;
    if (signals.noParentTg) raw += 10;
    return Math.min(raw, 100);
  }

  async getHighRiskStudents(tenantId: string, branchId?: string) {
    return this.prisma.churnScore.findMany({
      where: {
        tenantId,
        score: { gt: 60 },
        student: branchId ? { branchId } : undefined,
      },
      include: { student: { select: { id: true, name: true, branchId: true } } },
      orderBy: { score: 'desc' },
    });
  }

  async getMediumRiskStudents(tenantId: string, branchId?: string) {
    return this.prisma.churnScore.findMany({
      where: {
        tenantId,
        score: { gte: 31, lte: 60 },
        student: branchId ? { branchId } : undefined,
      },
      include: { student: { select: { id: true, name: true, branchId: true } } },
      orderBy: { score: 'desc' },
    });
  }

  async runDailyScoring(tenantId: string) {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: 'active' },
      select: { id: true, parentTelegramId: true, branchId: true },
    });

    for (const student of students) {
      const [absenceCount, xp, thisWeekPassed, lastWeekPassed, latestStatus] = await Promise.all([
        this.prisma.attendanceStudent.count({
          where: {
            studentId: student.id,
            date: { gte: threeDaysAgo },
            status: 'absent',
          },
        }),
        this.prisma.studentXp.findUnique({ where: { studentId: student.id } }),
        this.prisma.studentProgress.count({
          where: {
            studentId: student.id,
            academyCompleted: true,
            completedAt: { gte: sevenDaysAgo },
          },
        }),
        this.prisma.studentProgress.count({
          where: {
            studentId: student.id,
            academyCompleted: true,
            completedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          },
        }),
        this.prisma.studentStatus.findFirst({
          where: { studentId: student.id },
          orderBy: { date: 'desc' },
        }),
      ]);

      const signals: ChurnSignals = {
        absent3Days: absenceCount >= 3,
        streakBroken: (xp?.currentStreak ?? 0) === 0,
        passRateDrop: lastWeekPassed > 0 && thisWeekPassed < lastWeekPassed * 0.8,
        redStatus:
          latestStatus?.englishStatus === 'qizil' ||
          latestStatus?.personalStatus === 'qizil',
        noParentTg: !student.parentTelegramId,
      };

      const score = this.computeScore(signals);

      const existing = await this.prisma.churnScore.findUnique({
        where: { studentId: student.id },
      });

      const wasHighRisk = (existing?.score ?? 0) > 60;
      const isHighRisk = score > 60;
      const alertAlreadySent = existing?.alertSent ?? false;

      await this.prisma.churnScore.upsert({
        where: { studentId: student.id },
        create: {
          studentId: student.id,
          tenantId,
          score,
          signals: signals as any,
          alertSent: false,
        },
        update: {
          score,
          signals: signals as any,
          alertSent: isHighRisk ? alertAlreadySent : false,
        },
      });

      if (isHighRisk && !alertAlreadySent) {
        const managers = await this.prisma.user.findMany({
          where: {
            tenantId,
            role: 'manager',
            branchId: student.branchId ?? undefined,
          },
          select: { id: true },
        });

        for (const mgr of managers) {
          await this.notifications
            .send(mgr.id, 'churn', "Yuqori xavfli o'quvchi", `Ball: ${score}`, {
              studentId: student.id,
              score,
              signals,
            })
            .catch(() => {});
        }

        await this.prisma.churnScore.update({
          where: { studentId: student.id },
          data: { alertSent: true },
        });
      }

      if (!isHighRisk && wasHighRisk) {
        await this.prisma.churnScore.update({
          where: { studentId: student.id },
          data: { alertSent: false },
        });
      }
    }

    this.logger.log(`Tenant ${tenantId}: churn scoring yakunlandi`);
  }
}
```

- [ ] **Step 4: Create churn.controller.ts**

Create `apps/api/src/churn/churn.controller.ts`:
```typescript
import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ChurnService } from './churn.service';

@ApiTags('churn')
@ApiBearerAuth()
@Controller('churn')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChurnController {
  constructor(private churn: ChurnService) {}

  @Get('high-risk')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  getHighRisk(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.churn.getHighRiskStudents(req.user.tenantId, branchId);
  }

  @Get('medium-risk')
  @Roles(UserRole.superadmin, UserRole.filadmin, UserRole.manager)
  getMediumRisk(@Request() req: any, @Query('branchId') branchId?: string) {
    return this.churn.getMediumRiskStudents(req.user.tenantId, branchId);
  }
}
```

- [ ] **Step 5: Create churn.module.ts**

Create `apps/api/src/churn/churn.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ChurnService } from './churn.service';
import { ChurnController } from './churn.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ChurnService],
  controllers: [ChurnController],
  exports: [ChurnService],
})
export class ChurnModule {}
```

- [ ] **Step 6: Run tests and verify pass**

```bash
cd d:/projects/alochi && npx jest apps/api/test/churn.spec.ts --no-coverage
```

Expected: 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/churn apps/api/test/churn.spec.ts
git commit -m "feat: add ChurnModule with rule-based scoring (5 signals, 0-100 ball)"
```

---

## Task 5: Content Quality Module

**Files:**
- Create: `apps/api/src/content-quality/content-quality.service.ts`
- Create: `apps/api/src/content-quality/content-quality.controller.ts`
- Create: `apps/api/src/content-quality/content-quality.module.ts`
- Test: `apps/api/test/content-quality.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/content-quality.spec.ts`:
```typescript
import { ContentQualityService } from '../src/content-quality/content-quality.service';

describe('ContentQualityService', () => {
  const mockPrisma = {
    studentProgress: {
      count: jest.fn(),
    },
    lessonFeedback: {
      upsert: jest.fn().mockResolvedValue({}),
      aggregate: jest.fn(),
    },
    lessonVariant: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'v-1', variant: 'B' }),
      findMany: jest.fn(),
    },
    studentVariantAssignment: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue({ variantId: 'v-1' }),
    },
  };

  const mockNotifications = { send: jest.fn().mockResolvedValue({}) };
  const service = new ContentQualityService(mockPrisma as any, mockNotifications as any);

  beforeEach(() => jest.clearAllMocks());

  it('submitFeedback saves rating in DB', async () => {
    await service.submitFeedback('student-1', 'lesson-1', 3);
    expect(mockPrisma.lessonFeedback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId_lessonId: { studentId: 'student-1', lessonId: 'lesson-1' } },
        create: expect.objectContaining({ rating: 3 }),
      }),
    );
  });

  it('getVariantForStudent returns existing assignment', async () => {
    mockPrisma.studentVariantAssignment.findUnique.mockResolvedValue({ variantId: 'v-A' });
    const result = await service.getVariantForStudent('s-1', 'l-1');
    expect(result).toEqual({ variantId: 'v-A' });
    expect(mockPrisma.studentVariantAssignment.create).not.toHaveBeenCalled();
  });

  it('getVariantForStudent creates 50/50 random assignment when none exists', async () => {
    mockPrisma.studentVariantAssignment.findUnique.mockResolvedValue(null);
    mockPrisma.lessonVariant.findMany.mockResolvedValue([
      { id: 'v-A', variant: 'A' },
      { id: 'v-B', variant: 'B' },
    ]);

    const results = await Promise.all(
      Array.from({ length: 20 }, () => service.getVariantForStudent('s-1', 'l-1')),
    );
    // All calls when no existing assignment create a new one
    expect(mockPrisma.studentVariantAssignment.create).toHaveBeenCalledTimes(20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd d:/projects/alochi && npx jest apps/api/test/content-quality.spec.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../src/content-quality/content-quality.service'`

- [ ] **Step 3: Create content-quality.service.ts**

Create `apps/api/src/content-quality/content-quality.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ContentQualityService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getLessonStats(tenantId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: { tenantId, isPublished: true },
      select: { id: true, title: true },
    });

    return Promise.all(
      lessons.map(async (lesson) => {
        const [total, passed, feedbackAgg] = await Promise.all([
          this.prisma.studentProgress.count({ where: { lessonId: lesson.id } }),
          this.prisma.studentProgress.count({
            where: { lessonId: lesson.id, academyCompleted: true },
          }),
          this.prisma.lessonFeedback.aggregate({
            where: { lessonId: lesson.id },
            _avg: { rating: true },
            _count: true,
          }),
        ]);

        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        return {
          lessonId: lesson.id,
          title: lesson.title,
          passRate,
          totalStudents: total,
          feedbackAvg: feedbackAgg._avg.rating ?? null,
          feedbackCount: feedbackAgg._count,
        };
      }),
    );
  }

  async submitFeedback(studentId: string, lessonId: string, rating: number) {
    return this.prisma.lessonFeedback.upsert({
      where: { studentId_lessonId: { studentId, lessonId } },
      create: { studentId, lessonId, rating },
      update: { rating },
    });
  }

  async createVariant(lessonId: string, config: object) {
    return this.prisma.lessonVariant.create({
      data: { lessonId, variant: 'B', config },
    });
  }

  async getVariantForStudent(studentId: string, lessonId: string) {
    const existing = await this.prisma.studentVariantAssignment.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    if (existing) return existing;

    const variants = await this.prisma.lessonVariant.findMany({
      where: { lessonId, isActive: true },
      select: { id: true, variant: true },
    });

    if (variants.length === 0) return null;

    const chosen = variants[Math.floor(Math.random() * variants.length)];
    return this.prisma.studentVariantAssignment.create({
      data: { studentId, lessonId, variantId: chosen.id },
    });
  }

  async getABResults(lessonId: string) {
    const variants = await this.prisma.lessonVariant.findMany({
      where: { lessonId },
      select: { id: true, variant: true },
    });

    return Promise.all(
      variants.map(async (v) => {
        const assignments = await this.prisma.studentVariantAssignment.findMany({
          where: { variantId: v.id },
          select: { studentId: true },
        });
        const studentIds = assignments.map((a) => a.studentId);
        if (studentIds.length === 0) {
          return { variant: v.variant, students: 0, passRate: 0 };
        }

        const [total, passed] = await Promise.all([
          this.prisma.studentProgress.count({
            where: { lessonId, studentId: { in: studentIds } },
          }),
          this.prisma.studentProgress.count({
            where: { lessonId, studentId: { in: studentIds }, academyCompleted: true },
          }),
        ]);

        return {
          variant: v.variant,
          students: studentIds.length,
          passRate: total > 0 ? Math.round((passed / total) * 100) : 0,
        };
      }),
    );
  }

  async promoteVariant(lessonId: string, winner: 'A' | 'B') {
    await this.prisma.lessonVariant.updateMany({
      where: { lessonId, variant: { not: winner } },
      data: { isActive: false },
    });
    return { promoted: winner };
  }
}
```

- [ ] **Step 4: Create content-quality.controller.ts**

Create `apps/api/src/content-quality/content-quality.controller.ts`:
```typescript
import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { ContentQualityService } from './content-quality.service';

@ApiTags('content-quality')
@ApiBearerAuth()
@Controller('content-quality')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ContentQualityController {
  constructor(private cq: ContentQualityService) {}

  @Get('lessons')
  @Roles(UserRole.superadmin)
  getLessons(@Request() req: any) {
    return this.cq.getLessonStats(req.user.tenantId);
  }

  @Post('feedback')
  @Roles(UserRole.student)
  submitFeedback(@Request() req: any, @Body() body: { lessonId: string; rating: number }) {
    return this.cq.submitFeedback(req.user.userId, body.lessonId, body.rating);
  }

  @Post('lessons/:id/variant')
  @Roles(UserRole.superadmin)
  createVariant(@Param('id') id: string, @Body() body: { config: object }) {
    return this.cq.createVariant(id, body.config);
  }

  @Get('lessons/:id/ab-results')
  @Roles(UserRole.superadmin)
  getABResults(@Param('id') id: string) {
    return this.cq.getABResults(id);
  }

  @Post('lessons/:id/promote/:variant')
  @Roles(UserRole.superadmin)
  promoteVariant(@Param('id') id: string, @Param('variant') variant: 'A' | 'B') {
    return this.cq.promoteVariant(id, variant);
  }
}
```

- [ ] **Step 5: Create content-quality.module.ts**

Create `apps/api/src/content-quality/content-quality.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ContentQualityService } from './content-quality.service';
import { ContentQualityController } from './content-quality.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ContentQualityService],
  controllers: [ContentQualityController],
  exports: [ContentQualityService],
})
export class ContentQualityModule {}
```

- [ ] **Step 6: Run tests and verify pass**

```bash
cd d:/projects/alochi && npx jest apps/api/test/content-quality.spec.ts --no-coverage
```

Expected: 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/content-quality apps/api/test/content-quality.spec.ts
git commit -m "feat: add ContentQualityModule with A/B test and feedback collection"
```

---

## Task 6: Cron + App Module Wiring

**Files:**
- Modify: `apps/api/src/cron/cron.service.ts`
- Modify: `apps/api/src/cron/cron.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Add 3 new cron methods to cron.service.ts**

Add imports at top of `apps/api/src/cron/cron.service.ts`:
```typescript
import { AdaptiveService } from '../adaptive/adaptive.service';
import { ChurnService } from '../churn/churn.service';
```

Add to the constructor signature (after `private notifications: NotificationsService`):
```typescript
private adaptive: AdaptiveService,
private churn: ChurnService,
```

Add 3 new methods to the class body (after the existing `runFiladminDailyReport` method):
```typescript
@Cron('0 2 * * *', { name: 'refresh_mv' })
async runRefreshMaterializedViews() {
  this.logger.log('Cron: materialized views yangilanmoqda...');
  await this.prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY lesson_stats_mv');
  await this.prisma.$executeRawUnsafe('REFRESH MATERIALIZED VIEW CONCURRENTLY branch_stats_mv');
  this.logger.log('Materialized views yangilandi');
}

@Cron('0 3 * * *', { name: 'adaptive_difficulty' })
async runAdaptiveDifficulty() {
  this.logger.log('Cron: adaptive difficulty boshlanmoqda...');
  const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    await this.adaptive.runNightlyAdaptation(tenant.id).catch((e) =>
      this.logger.error(`Adaptive error tenant ${tenant.id}: ${e.message}`),
    );
  }
}

@Cron('0 6 * * *', { name: 'churn_scoring' })
async runChurnScoring() {
  this.logger.log('Cron: churn scoring boshlanmoqda...');
  const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    await this.churn.runDailyScoring(tenant.id).catch((e) =>
      this.logger.error(`Churn error tenant ${tenant.id}: ${e.message}`),
    );
  }
}
```

- [ ] **Step 2: Update cron.module.ts**

Replace the existing content of `apps/api/src/cron/cron.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdaptiveModule } from '../adaptive/adaptive.module';
import { ChurnModule } from '../churn/churn.module';
import { CronService } from './cron.service';

@Module({
  imports: [PrismaModule, TelegramModule, NotificationsModule, AdaptiveModule, ChurnModule],
  providers: [CronService],
  exports: [CronService],
})
export class CronModule {}
```

- [ ] **Step 3: Register 4 new modules in app.module.ts**

In `apps/api/src/app.module.ts`, add imports at the top:
```typescript
import { AdaptiveModule } from './adaptive/adaptive.module';
import { ContentQualityModule } from './content-quality/content-quality.module';
import { ChurnModule } from './churn/churn.module';
import { AnalyticsModule } from './analytics/analytics.module';
```

Add to the `imports` array (after `ExamsModule`):
```typescript
AdaptiveModule,
ContentQualityModule,
ChurnModule,
AnalyticsModule,
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd d:/projects/alochi/apps/api && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cron apps/api/src/app.module.ts
git commit -m "feat: wire adaptive+churn crons, register 4 new modules in AppModule"
```

---

## Task 7: Event Logging in 3 Services

**Files:**
- Modify: `apps/api/src/lesson-progress/progress.service.ts`
- Modify: `apps/api/src/attendance/attendance-students.service.ts`
- Modify: `apps/api/src/gamification/streak.service.ts`

Also update the modules to import AnalyticsModule.

- [ ] **Step 1: Add analytics event logging to progress.service.ts**

In `apps/api/src/lesson-progress/progress.service.ts`:

1. Add import:
```typescript
import { AnalyticsService } from '../analytics/analytics.service';
```

2. Add `AnalyticsService` to constructor:
```typescript
constructor(
  private prisma: PrismaService,
  private feedEvent: FeedEventService,
  private analytics: AnalyticsService,
) {}
```

3. At the end of `completeSession` method, after the `upsert`, add:
```typescript
const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, tenantId } });
if (lesson) {
  this.analytics.logEvent({
    tenantId,
    eventType: homeCompleted ? 'lesson_completed' : 'lesson_session',
    studentId,
    data: { lessonId, sessionCount: newCount },
  }).catch(() => {});
}
return progress;
```

Note: Replace the existing `return this.prisma.studentProgress.upsert(...)` with:
```typescript
const progress = await this.prisma.studentProgress.upsert({
  where: { studentId_lessonId: { studentId, lessonId } },
  create: {
    studentId,
    lessonId,
    sessionCount: newCount,
    homeCompleted,
    lastActivityAt: new Date(),
    ...(homeCompleted ? { completedAt: new Date() } : {}),
  },
  update: {
    sessionCount: newCount,
    homeCompleted,
    lastActivityAt: new Date(),
    ...(homeCompleted ? { completedAt: new Date() } : {}),
  },
});

const lesson = await this.prisma.lesson.findFirst({ where: { id: lessonId, tenantId } });
if (lesson) {
  this.analytics.logEvent({
    tenantId,
    eventType: homeCompleted ? 'lesson_completed' : 'lesson_session',
    studentId,
    data: { lessonId, sessionCount: newCount },
  }).catch(() => {});
}
return progress;
```

- [ ] **Step 2: Update progress.module.ts to import AnalyticsModule**

Find `apps/api/src/lesson-progress/progress.module.ts` and add AnalyticsModule:
```typescript
import { AnalyticsModule } from '../analytics/analytics.module';
// ... in @Module imports array: add AnalyticsModule
```

- [ ] **Step 3: Add event logging to attendance-students.service.ts**

In `apps/api/src/attendance/attendance-students.service.ts`:

1. Add import:
```typescript
import { AnalyticsService } from '../analytics/analytics.service';
```

2. Add to constructor:
```typescript
constructor(
  private prisma: PrismaService,
  private analytics: AnalyticsService,
) {}
```

3. In `markBulk`, after `const results = await Promise.all(...)`, add:
```typescript
for (const r of records) {
  this.analytics.logEvent({
    tenantId: r.tenantId,
    eventType: 'attendance_marked',
    studentId: r.studentId,
    branchId: r.branchId,
    data: { status: r.status, date: r.date },
  }).catch(() => {});
}
return results;
```

Note: Add `return results;` at the end and update the attendance module to import AnalyticsModule.

- [ ] **Step 4: Update attendance module**

Find `apps/api/src/attendance/attendance.module.ts` and add:
```typescript
import { AnalyticsModule } from '../analytics/analytics.module';
// ... in @Module imports: add AnalyticsModule
```

- [ ] **Step 5: Add event logging to streak.service.ts**

In `apps/api/src/gamification/streak.service.ts`:

1. Add import:
```typescript
import { AnalyticsService } from '../analytics/analytics.service';
```

2. Add to constructor:
```typescript
constructor(
  private prisma: PrismaService,
  private analytics: AnalyticsService,
) {}
```

3. In `recordActivity`, after the final `return this.prisma.studentXp.update(...)` calls that change streak, log the event. Replace the last `return` block (the `daysSinceLast === 1` branch):

After the `update` in the `daysSinceLast === 1` case, add:
```typescript
const updated = await this.prisma.studentXp.update({
  where: { studentId },
  data: {
    currentStreak: newStreak,
    longestStreak: Math.max(xp.longestStreak, newStreak),
    lastActivity: today,
    shieldCount: newStreak % 7 === 0 ? xp.shieldCount + 1 : xp.shieldCount,
  },
});
this.analytics.logEvent({
  tenantId: '', // streak service doesn't have tenantId — pass empty, or look it up
  eventType: 'streak_updated',
  studentId,
  data: { newStreak, oldStreak: xp.currentStreak },
}).catch(() => {});
return updated;
```

Note: StreakService doesn't have tenantId in `recordActivity`. To get tenantId, look up the user:
```typescript
const user = await this.prisma.user.findUnique({ where: { id: studentId }, select: { tenantId: true } });
if (user) {
  this.analytics.logEvent({
    tenantId: user.tenantId,
    eventType: 'streak_updated',
    studentId,
    data: { newStreak, oldStreak: xp.currentStreak },
  }).catch(() => {});
}
```

Apply the same pattern to the `shieldCount` use case. The gamification module also needs AnalyticsModule imported — add it to `GamificationModule`:
```typescript
import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
// ...
@Module({
  imports: [AnalyticsModule],
  providers: [...],
  // ...
})
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd d:/projects/alochi/apps/api && npx tsc --noEmit
```

Expected: 0 errors. Fix any constructor injection issues surfaced.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/lesson-progress apps/api/src/attendance apps/api/src/gamification
git commit -m "feat: add analytics event logging in progress, attendance, streak services"
```

---

## Task 8: Frontend Pages

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/adaptive/page.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/content-quality/page.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/churn/page.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/analytics/page.tsx`
- Create: `apps/web/app/(dashboard)/student/lessons/[id]/_components/FeedbackWidget.tsx`
- Modify: `apps/web/app/(dashboard)/manager/page.tsx`
- Modify: `apps/web/app/(dashboard)/superadmin/page.tsx`

- [ ] **Step 1: Create superadmin/adaptive/page.tsx**

Create `apps/web/app/(dashboard)/superadmin/adaptive/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface AdaptiveConfig {
  minN: number;
  maxN: number;
  hardThreshold: number;
  easyThreshold: number;
}

export default function AdaptivePage() {
  const [config, setConfig] = useState<AdaptiveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    apiRequest<AdaptiveConfig>('/adaptive/config', {}, token())
      .then((r) => setConfig(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!config) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await apiRequest('/adaptive/config', {
        method: 'PATCH',
        body: JSON.stringify({
          minN: Number(config.minN),
          maxN: Number(config.maxN),
          hardThreshold: Number(config.hardThreshold),
          easyThreshold: Number(config.easyThreshold),
        }),
      }, token());
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="text-blue-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Adaptiv Qiyinlik Sozlamalari</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
      {saved && <div className="mb-4 p-3 bg-green-900/40 border border-green-700 rounded-lg text-green-300 text-sm">Saqlandi ✓</div>}

      {config && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Minimal N (takrorlash)</label>
              <input
                type="number" min={1} max={20}
                value={config.minN}
                onChange={(e) => setConfig({ ...config, minN: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Maksimal N (takrorlash)</label>
              <input
                type="number" min={1} max={20}
                value={config.maxN}
                onChange={(e) => setConfig({ ...config, maxN: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Qiyin chegarasi (%)</label>
              <input
                type="number" min={1} max={100}
                value={Math.round(config.hardThreshold * 100)}
                onChange={(e) => setConfig({ ...config, hardThreshold: Number(e.target.value) / 100 })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Xato foizi bundan yuqori bo'lsa N oshiriladi</p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Oson chegarasi (%)</label>
              <input
                type="number" min={1} max={100}
                value={Math.round(config.easyThreshold * 100)}
                onChange={(e) => setConfig({ ...config, easyThreshold: Number(e.target.value) / 100 })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Xato foizi bundan past bo'lsa N kamaytiriladi</p>
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
          >
            <Save size={16} />
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create superadmin/content-quality/page.tsx**

Create `apps/web/app/(dashboard)/superadmin/content-quality/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { BarChart2, Play } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface LessonStat {
  lessonId: string;
  title: string;
  passRate: number;
  totalStudents: number;
  feedbackAvg: number | null;
  feedbackCount: number;
}

interface ABResult {
  variant: string;
  students: number;
  passRate: number;
}

export default function ContentQualityPage() {
  const [lessons, setLessons] = useState<LessonStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [abResults, setAbResults] = useState<ABResult[] | null>(null);

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    apiRequest<LessonStat[]>('/content-quality/lessons', {}, token())
      .then((r) => setLessons(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function viewABResults(lessonId: string) {
    setSelectedLesson(lessonId);
    try {
      const r = await apiRequest<ABResult[]>(`/content-quality/lessons/${lessonId}/ab-results`, {}, token());
      setAbResults(r.data);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function startABTest(lessonId: string) {
    try {
      await apiRequest(`/content-quality/lessons/${lessonId}/variant`, {
        method: 'POST',
        body: JSON.stringify({ config: { description: 'B varianti' } }),
      }, token());
      alert('B variant yaratildi');
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <BarChart2 className="text-purple-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Darslar Samaradorligi</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Dars</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Pass rate</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">O'quvchilar</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Fikr avg</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <>
                <tr
                  key={l.lessonId}
                  className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${l.passRate < 50 ? 'bg-red-900/10' : ''}`}
                >
                  <td className="px-4 py-3 text-white">{l.title}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 bg-slate-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${l.passRate >= 70 ? 'bg-green-500' : l.passRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${l.passRate}%` }}
                        />
                      </div>
                      <span className={l.passRate < 50 ? 'text-red-400' : 'text-slate-300'}>{l.passRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-300">{l.totalStudents}</td>
                  <td className="px-4 py-3 text-center text-slate-300">
                    {l.feedbackAvg ? `${l.feedbackAvg.toFixed(1)} ⭐` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => viewABResults(l.lessonId)}
                      className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
                    >
                      A/B natijalar
                    </button>
                    <button
                      onClick={() => startABTest(l.lessonId)}
                      className="text-xs px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-white flex items-center gap-1 inline-flex"
                    >
                      <Play size={10} /> A/B boshlash
                    </button>
                  </td>
                </tr>
                {selectedLesson === l.lessonId && abResults && (
                  <tr key={`${l.lessonId}-ab`} className="bg-slate-900/60">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="text-sm text-slate-400 mb-2">A/B Test natijalari:</div>
                      <div className="flex gap-4">
                        {abResults.map((ab) => (
                          <div key={ab.variant} className="bg-slate-800 border border-slate-600 rounded-lg p-4 min-w-36">
                            <div className="text-lg font-bold text-white">Variant {ab.variant}</div>
                            <div className="text-slate-400 text-sm">{ab.students} o'quvchi</div>
                            <div className="text-2xl font-bold text-blue-400 mt-1">{ab.passRate}%</div>
                            <div className="text-xs text-slate-500">pass rate</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {lessons.length === 0 && (
          <div className="p-8 text-center text-slate-500">Hali darslar yo'q</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create superadmin/churn/page.tsx**

Create `apps/web/app/(dashboard)/superadmin/churn/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface ChurnStudent {
  id: string;
  score: number;
  signals: Record<string, boolean>;
  student: { id: string; name: string; branchId: string | null };
}

const SIGNAL_LABELS: Record<string, string> = {
  absent3Days: 'Absent 3+ kun',
  streakBroken: 'Streak uzildi',
  passRateDrop: 'Pass rate tushdi',
  redStatus: 'Qizil status',
  noParentTg: 'Ota Telegram yo\'q',
};

export default function ChurnPage() {
  const [high, setHigh] = useState<ChurnStudent[]>([]);
  const [medium, setMedium] = useState<ChurnStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    Promise.all([
      apiRequest<ChurnStudent[]>('/churn/high-risk', {}, token()),
      apiRequest<ChurnStudent[]>('/churn/medium-risk', {}, token()),
    ])
      .then(([h, m]) => { setHigh(h.data); setMedium(m.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  function StudentTable({ students, color }: { students: ChurnStudent[]; color: 'red' | 'yellow' }) {
    if (students.length === 0) return <div className="text-slate-500 text-sm p-4">Yo'q</div>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400">Ism</th>
              <th className="text-center px-4 py-3 text-slate-400">Ball</th>
              <th className="text-left px-4 py-3 text-slate-400">Sabablar</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="px-4 py-3 text-white font-medium">{s.student.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-bold text-lg ${color === 'red' ? 'text-red-400' : 'text-yellow-400'}`}>
                    {s.score}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(s.signals)
                      .filter(([, v]) => v)
                      .map(([k]) => (
                        <span key={k} className={`text-xs px-2 py-0.5 rounded-full ${color === 'red' ? 'bg-red-900/40 text-red-300' : 'bg-yellow-900/40 text-yellow-300'}`}>
                          {SIGNAL_LABELS[k] ?? k}
                        </span>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <AlertTriangle className="text-red-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Churn Risk Monitoring</h1>
      </div>

      {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

      <div className="space-y-6">
        <div className="bg-slate-800/60 border border-red-900/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-900/50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-300 font-medium">Yuqori xavf (&gt;60 ball) — {high.length} ta o'quvchi</span>
          </div>
          <StudentTable students={high} color="red" />
        </div>

        <div className="bg-slate-800/60 border border-yellow-900/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-yellow-900/50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-yellow-300 font-medium">O'rta xavf (31–60 ball) — {medium.length} ta o'quvchi</span>
          </div>
          <StudentTable students={medium} color="yellow" />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create superadmin/analytics/page.tsx**

Create `apps/web/app/(dashboard)/superadmin/analytics/page.tsx`:
```tsx
'use client';
import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface LessonStat {
  lessonId: string;
  passRate: number;
  totalStudents: number;
  passed: number;
  avgSessions: number;
  feedbackAvg: number | null;
}

interface BranchStat {
  branchId: string;
  activeStudents: number;
  avgStreak: number;
  avgXp: number;
}

interface ActivityPoint {
  day: string;
  count: number;
}

export default function AnalyticsPage() {
  const [lessons, setLessons] = useState<LessonStat[]>([]);
  const [branches, setBranches] = useState<BranchStat[]>([]);
  const [activity, setActivity] = useState<ActivityPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    Promise.all([
      apiRequest<LessonStat[]>('/analytics/lessons', {}, token()),
      apiRequest<BranchStat[]>('/analytics/branches', {}, token()),
      apiRequest<ActivityPoint[]>('/analytics/activity?period=monthly', {}, token()),
    ])
      .then(([l, b, a]) => { setLessons(l.data); setBranches(b.data); setActivity(a.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-3">
        <TrendingUp className="text-green-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
      </div>

      {error && <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}

      {/* Faollik grafigi */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">So'nggi 30 kun — Faol o'quvchilar</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={activity}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: 8 }} />
            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Darslar samaradorligi */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Darslar Samaradorligi</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400">Dars ID</th>
              <th className="text-center px-4 py-3 text-slate-400">Pass rate</th>
              <th className="text-center px-4 py-3 text-slate-400">O'quvchilar</th>
              <th className="text-center px-4 py-3 text-slate-400">O'rtacha sessiya</th>
              <th className="text-center px-4 py-3 text-slate-400">Fikr</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <tr key={l.lessonId} className="border-b border-slate-700/50">
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{l.lessonId.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-center">
                  <span className={l.passRate >= 70 ? 'text-green-400' : l.passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                    {l.passRate}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-slate-300">{l.totalStudents}</td>
                <td className="px-4 py-3 text-center text-slate-300">{l.avgSessions}</td>
                <td className="px-4 py-3 text-center text-slate-300">{l.feedbackAvg ?? '—'}</td>
              </tr>
            ))}
            {lessons.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">Ma'lumot yo'q (MV bo'sh)</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Filiallar taqqoslash */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Filiallar Taqqoslash</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400">Filial</th>
              <th className="text-center px-4 py-3 text-slate-400">Faol o'quvchilar</th>
              <th className="text-center px-4 py-3 text-slate-400">O'rt. streak</th>
              <th className="text-center px-4 py-3 text-slate-400">O'rt. XP</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.branchId} className="border-b border-slate-700/50">
                <td className="px-4 py-3 text-slate-300 font-mono text-xs">{b.branchId.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-center text-white font-semibold">{b.activeStudents}</td>
                <td className="px-4 py-3 text-center text-blue-400">{b.avgStreak}</td>
                <td className="px-4 py-3 text-center text-purple-400">{b.avgXp}</td>
              </tr>
            ))}
            {branches.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-slate-500">Ma'lumot yo'q</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create FeedbackWidget.tsx**

Create `apps/web/app/(dashboard)/student/lessons/[id]/_components/FeedbackWidget.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';

interface Props {
  lessonId: string;
  onDone?: () => void;
}

const RATINGS = [
  { value: 1, emoji: '😕', label: 'Qiyin' },
  { value: 2, emoji: '😐', label: "O'rtacha" },
  { value: 3, emoji: '😊', label: 'Tushunarli' },
];

export function FeedbackWidget({ lessonId, onDone }: Props) {
  const [submitted, setSubmitted] = useState(() =>
    typeof window !== 'undefined'
      ? !!localStorage.getItem(`feedback_${lessonId}`)
      : false,
  );
  const [submitting, setSubmitting] = useState(false);

  async function submit(rating: number) {
    setSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest('/content-quality/feedback', {
        method: 'POST',
        body: JSON.stringify({ lessonId, rating }),
      }, token);
      localStorage.setItem(`feedback_${lessonId}`, '1');
      setSubmitted(true);
      onDone?.();
    } catch {
      // silent fail — feedback is optional
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return null;

  return (
    <div className="mt-4 p-4 bg-slate-800/60 border border-slate-700 rounded-xl">
      <p className="text-sm text-slate-400 mb-3 text-center">Bu dars qanday bo'ldi?</p>
      <div className="flex justify-center gap-4">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            onClick={() => submit(r.value)}
            disabled={submitting}
            className="flex flex-col items-center gap-1 p-3 rounded-xl hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <span className="text-3xl">{r.emoji}</span>
            <span className="text-xs text-slate-400">{r.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add churn block to manager/page.tsx**

In `apps/web/app/(dashboard)/manager/page.tsx`, add after existing imports:
```tsx
import { AlertTriangle } from 'lucide-react';
```

Add state and fetch in the component:
```tsx
const [highRisk, setHighRisk] = useState<Array<{
  score: number;
  signals: Record<string, boolean>;
  student: { name: string };
}>>([]);

// In useEffect or separate useEffect:
apiRequest<any[]>('/churn/high-risk', {}, token())
  .then((r) => setHighRisk(r.data.slice(0, 5)))
  .catch(() => {});
```

Add the churn block in the JSX (after existing stat cards):
```tsx
{highRisk.length > 0 && (
  <div className="bg-slate-800/60 border border-red-900/40 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-red-900/40 flex items-center gap-2">
      <AlertTriangle size={16} className="text-red-400" />
      <span className="text-red-300 font-medium text-sm">Xavfli O'quvchilar</span>
    </div>
    <div className="divide-y divide-slate-700/50">
      {highRisk.map((s, i) => (
        <div key={i} className="px-4 py-3 flex items-center justify-between">
          <span className="text-white text-sm">{s.student.name}</span>
          <span className="text-red-400 font-bold text-sm">{s.score} ball</span>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 7: Add new nav cards to superadmin/page.tsx**

In `apps/web/app/(dashboard)/superadmin/page.tsx`, add 4 new nav cards to the existing grid:
```tsx
{ href: '/superadmin/adaptive', icon: Settings, label: 'Adaptiv Qiyinlik', color: 'text-blue-400' },
{ href: '/superadmin/content-quality', icon: BarChart2, label: 'Kontent Sifati', color: 'text-purple-400' },
{ href: '/superadmin/churn', icon: AlertTriangle, label: 'Churn Monitor', color: 'text-red-400' },
{ href: '/superadmin/analytics', icon: TrendingUp, label: 'Analytics', color: 'text-green-400' },
```

Add required imports: `import { Settings, BarChart2, AlertTriangle, TrendingUp } from 'lucide-react';`

- [ ] **Step 8: Verify TypeScript in web**

```bash
cd d:/projects/alochi/apps/web && npx tsc --noEmit
```

Expected: 0 errors. Fix any missing `recharts` import by checking `package.json` — if recharts is not installed:
```bash
cd d:/projects/alochi && pnpm add recharts --filter @alochi/web
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/\(dashboard\)/superadmin/adaptive apps/web/app/\(dashboard\)/superadmin/content-quality apps/web/app/\(dashboard\)/superadmin/churn apps/web/app/\(dashboard\)/superadmin/analytics apps/web/app/\(dashboard\)/student apps/web/app/\(dashboard\)/manager/page.tsx apps/web/app/\(dashboard\)/superadmin/page.tsx
git commit -m "feat: add 4 superadmin pages (adaptive, content-quality, churn, analytics) + FeedbackWidget + manager churn block"
```

---

## Task 9: Final Verification

- [ ] **Step 1: Run all API tests**

```bash
cd d:/projects/alochi && npx jest apps/api/test --no-coverage
```

Expected: All tests pass (adaptive: 5, churn: 4, content-quality: 3, analytics: 3 + existing tests).

- [ ] **Step 2: Build API**

```bash
cd d:/projects/alochi && pnpm --filter @alochi/api build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Build Web**

```bash
cd d:/projects/alochi && pnpm --filter @alochi/web build
```

Expected: Build succeeds (fix any type errors that appear).

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify Faza 3 build passes — adaptive, churn, content-quality, analytics complete"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Adaptive difficulty: cron at 03:00, `computeNewN` with hard/easy threshold, config endpoint, logs endpoint
- ✅ Churn: 5 signals, score 0-100, cron at 06:00, manager notification, alertSent reset
- ✅ Content quality: pass rate, feedback widget, A/B variant creation, A/B results, promote winner
- ✅ Analytics: `lesson_stats_mv`, `branch_stats_mv`, activity query, cron at 02:00 for refresh
- ✅ Event logging: lesson_completed, attendance_marked, streak_updated
- ✅ 4 superadmin frontend pages + FeedbackWidget + manager churn block

**Critical notes:**
- `StudentLessonConfig.changedBy` made nullable in migration 0015 — adaptive service creates records without a human changedBy
- `REFRESH MATERIALIZED VIEW CONCURRENTLY` requires a unique index — both MVs have one (`lesson_stats_mv_lesson_idx`, `branch_stats_mv_branch_idx`)
- If `recharts` is not in `@alochi/web` package.json, install it before building
- `GamificationModule` needs `imports: [AnalyticsModule]` added — currently has no `imports` array
