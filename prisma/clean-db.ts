/**
 * Destructive DB cleanup — wipes every table except the row(s)
 * needed to keep the existing superadmin login working.
 *
 * Behaviour:
 *   1. Snapshot the current superadmin user + their tenant.
 *   2. TRUNCATE every public table (except _prisma_migrations) with
 *      CASCADE so foreign-keyed children are torn down too.
 *   3. Re-insert the saved tenant + superadmin so the operator can
 *      still log in.
 *
 * Usage:
 *   pnpm --filter api exec ts-node -r tsconfig-paths/register \
 *     ../../prisma/clean-db.ts
 *
 * Or from repo root:
 *   pnpm exec ts-node -r tsconfig-paths/register prisma/clean-db.ts
 */
import { PrismaClient, type UserRole } from '@prisma/client';

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

  console.log(`Preserving:`);
  console.log(
    `  Tenant: "${tenantSnapshot.name}" (slug: ${tenantSnapshot.slug})`,
  );
  console.log(
    `  User:   "${userSnapshot.name}" (login: ${userSnapshot.login}, role: ${userSnapshot.role})`,
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

  // Final state confirmation.
  const afterUsers = await prisma.user.count();
  const afterTenants = await prisma.tenant.count();
  const afterLessons = await prisma.lesson.count();
  console.log(
    `After:  ${afterUsers} users, ${afterTenants} tenants, ${afterLessons} lessons (...)`,
  );

  if (afterUsers !== 1 || afterTenants !== 1) {
    console.warn(
      '[WARN] Final counts are not 1 user / 1 tenant — inspect manually.',
    );
  } else {
    console.log('Cleanup complete. Only the superadmin remains.');
  }
}

main()
  .catch((err) => {
    console.error('[ERROR]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
