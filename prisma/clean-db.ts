/**
 * Destructive DB cleanup — wipes every table except the row(s)
 * needed to keep the existing superadmin login working AND the
 * superadmin-authored lessons + their components, so the operator
 * doesn't have to re-author the curriculum on every reset.
 *
 * Behaviour:
 *   1. Snapshot the superadmin user + their tenant + every Lesson
 *      and its LessonComponent rows.
 *   2. TRUNCATE every public table (except _prisma_migrations) with
 *      CASCADE so foreign-keyed children are torn down too.
 *   3. Re-insert tenant → user → lessons → lesson components.
 *
 * Usage:
 *   pnpm exec ts-node -r tsconfig-paths/register prisma/clean-db.ts
 */
import {
  PrismaClient,
  type UserRole,
  type LessonType,
} from '@prisma/client';

const prisma = new PrismaClient();

interface TenantSnapshot {
  id: string;
  name: string;
  slug: string;
  status: string;
  isActive: boolean;
  warningBlockLimit: number;
  certTemplate: unknown;
  createdAt: Date;
}

interface UserSnapshot {
  id: string;
  tenantId: string;
  branchId: string | null;
  groupId: string | null;
  role: UserRole;
  name: string;
  phone: string | null;
  login: string;
  passwordHash: string;
  status: 'active' | 'blocked_warning' | 'blocked_payment';
  telegramId: bigint | null;
  birthDate: Date | null;
  parentTelegramId: string | null;
  createdAt: Date;
}

interface LessonSnapshot {
  id: string;
  tenantId: string;
  title: string;
  type: LessonType;
  orderNumber: number;
  subcategory: string | null;
  orderInSubcategory: number | null;
  youtubeUrl: string;
  nRepetitions: number;
  maxNOverride: number;
  components: unknown;
  hasExam: boolean;
  cameraEnabled: boolean;
  aiTutorContext: string | null;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface LessonComponentSnapshot {
  id: string;
  lessonId: string;
  type: string;
  config: unknown;
}

async function main() {
  console.log('--- A\'lochi DB cleanup ---');

  const superadmin = await prisma.user.findFirst({
    where: { role: 'superadmin' },
    include: { tenant: true },
    orderBy: { createdAt: 'asc' },
  });

  if (!superadmin) {
    console.error(
      '[ABORT] No superadmin user found. Refusing to wipe a DB with no recovery account.',
    );
    process.exit(1);
  }

  const tenantSnapshot: TenantSnapshot = {
    id: superadmin.tenant.id,
    name: superadmin.tenant.name,
    slug: superadmin.tenant.slug,
    status: superadmin.tenant.status,
    isActive: superadmin.tenant.isActive,
    warningBlockLimit: superadmin.tenant.warningBlockLimit,
    certTemplate: superadmin.tenant.certTemplate,
    createdAt: superadmin.tenant.createdAt,
  };

  // Strip the joined `tenant` field — only keep the column data.
  const userSnapshot: UserSnapshot = {
    id: superadmin.id,
    tenantId: superadmin.tenantId,
    // Branch/group references will not survive the truncate; null them
    // so we don't immediately violate FKs when re-inserting the user.
    branchId: null,
    groupId: null,
    role: superadmin.role,
    name: superadmin.name,
    phone: superadmin.phone,
    login: superadmin.login,
    passwordHash: superadmin.passwordHash,
    status: superadmin.status as UserSnapshot['status'],
    telegramId: superadmin.telegramId,
    birthDate: superadmin.birthDate,
    parentTelegramId: superadmin.parentTelegramId,
    createdAt: superadmin.createdAt,
  };

  // Snapshot every lesson + its components so the curriculum
  // survives the wipe. We re-insert with the original IDs to keep
  // any external references (e.g. URL bookmarks) stable.
  const lessons = await prisma.lesson.findMany({
    include: { components_data: true },
  });
  const lessonSnapshots: LessonSnapshot[] = lessons.map((l) => ({
    id: l.id,
    tenantId: l.tenantId,
    title: l.title,
    type: l.type,
    orderNumber: l.orderNumber,
    subcategory: l.subcategory,
    orderInSubcategory: l.orderInSubcategory,
    youtubeUrl: l.youtubeUrl,
    nRepetitions: l.nRepetitions,
    maxNOverride: l.maxNOverride,
    components: l.components,
    hasExam: l.hasExam,
    cameraEnabled: l.cameraEnabled,
    aiTutorContext: l.aiTutorContext,
    isPublished: l.isPublished,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  }));
  const componentSnapshots: LessonComponentSnapshot[] = lessons.flatMap((l) =>
    l.components_data.map((c) => ({
      id: c.id,
      lessonId: c.lessonId,
      type: c.type,
      config: c.config,
    })),
  );

  console.log(`Preserving:`);
  console.log(
    `  Tenant: "${tenantSnapshot.name}" (slug: ${tenantSnapshot.slug})`,
  );
  console.log(
    `  User:   "${userSnapshot.name}" (login: ${userSnapshot.login}, role: ${userSnapshot.role})`,
  );
  console.log(
    `  Lessons: ${lessonSnapshots.length} (with ${componentSnapshots.length} components)`,
  );

  // Pre-truncate counts for the audit line.
  const beforeUsers = await prisma.user.count();
  const beforeTenants = await prisma.tenant.count();
  const beforeLessons = await prisma.lesson.count();
  console.log(
    `Before: ${beforeUsers} users, ${beforeTenants} tenants, ${beforeLessons} lessons (...)`,
  );

  // Wipe everything in `public` except the migration history.
  // Postgres-specific. Keeps schema, drops all data; CASCADE follows
  // the FK graph so we don't have to walk it manually.
  await prisma.$executeRawUnsafe(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename != '_prisma_migrations'
      LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
      END LOOP;
    END $$;
  `);

  console.log('All public tables truncated.');

  // Re-insert in dependency order: Tenant → User.
  await prisma.tenant.create({
    data: {
      id: tenantSnapshot.id,
      name: tenantSnapshot.name,
      slug: tenantSnapshot.slug,
      status: tenantSnapshot.status,
      isActive: tenantSnapshot.isActive,
      warningBlockLimit: tenantSnapshot.warningBlockLimit,
      // Cast through unknown — Prisma's Json field accepts the original
      // shape we read out of the DB.
      certTemplate: tenantSnapshot.certTemplate as never,
      createdAt: tenantSnapshot.createdAt,
    },
  });

  await prisma.user.create({
    data: userSnapshot,
  });

  // Re-insert the curriculum. Lessons first (no FK dependencies on
  // user/branch since they belong to the tenant), then their
  // components.
  if (lessonSnapshots.length > 0) {
    await prisma.lesson.createMany({
      data: lessonSnapshots.map((l) => ({
        ...l,
        components: l.components as never,
      })),
    });
  }
  if (componentSnapshots.length > 0) {
    await prisma.lessonComponent.createMany({
      data: componentSnapshots.map((c) => ({
        ...c,
        config: c.config as never,
      })),
    });
  }

  // Final state confirmation.
  const afterUsers = await prisma.user.count();
  const afterTenants = await prisma.tenant.count();
  const afterLessons = await prisma.lesson.count();
  const afterComponents = await prisma.lessonComponent.count();
  console.log(
    `After:  ${afterUsers} users, ${afterTenants} tenants, ${afterLessons} lessons, ${afterComponents} components`,
  );

  if (
    afterUsers !== 1 ||
    afterTenants !== 1 ||
    afterLessons !== lessonSnapshots.length
  ) {
    console.warn(
      '[WARN] Final counts diverge from snapshot — inspect manually.',
    );
  } else {
    console.log('Cleanup complete. Superadmin + curriculum preserved.');
  }
}

main()
  .catch((err) => {
    console.error('[ERROR]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
