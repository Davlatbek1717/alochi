/**
 * Import the 56 students from the legacy alochibolajon CRM (MongoDB)
 * dump at backups/alochi-students-20260510-131513/students.json into
 * the Postgres `users` table as role='student'.
 *
 * Idempotent: re-running upserts by `crmStudentId` (the original Mongo
 * _id), so already-imported students are updated rather than duplicated.
 *
 * Skipped per product decision: `totalScore` (the snapshot total is
 * derivable from steps × percentage; we keep `totalPoints` instead).
 *
 * Run: pnpm exec ts-node prisma/import-crm-students.ts
 */

import { Prisma, PrismaClient, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Target tenant resolution:
//   1. CLI / env override:  CRM_IMPORT_TENANT_SLUG=alochi  (production default)
//   2. Auto-create a fresh "alochi-bolajon" tenant when the slug above does
//      not exist (used for isolated dev / staging databases).
const TENANT_SLUG = process.env.CRM_IMPORT_TENANT_SLUG ?? 'alochi-bolajon';
const TENANT_NAME = process.env.CRM_IMPORT_TENANT_NAME ?? 'Alochi Bolajon';
const BRANCH_NAME =
  process.env.CRM_IMPORT_BRANCH_NAME ?? "Buxoro G'ijduvon filiali";

const BACKUP_FILE = path.resolve(
  __dirname,
  '..',
  'backups',
  'alochi-students-20260510-131513',
  'students.json',
);

// Fallback password for the 42 records without a CRM bcrypt hash.
// Communicated to filadmin out-of-band; admins must change on first login.
const DEFAULT_PASSWORD = 'alochi2025';

interface MongoOid {
  $oid: string;
}
interface MongoDate {
  $date: string;
}
interface CrmWarning {
  reason: string;
  date: MongoDate | string;
  adminId?: string;
  adminName?: string;
}
interface CrmStudent {
  _id: MongoOid;
  firstName: string;
  lastName: string;
  phone?: string;
  school?: string;
  region?: string;
  district?: string;
  grade?: string | number;
  totalScore?: number; // intentionally NOT imported
  steps?: number;
  percentage?: number;
  isPaid?: boolean;
  branchId?: string | null;
  createdAt?: MongoDate | string;
  updatedAt?: MongoDate | string;
  joinedAt?: MongoDate | string;
  blockedReason?: string | null;
  isLocked?: boolean;
  totalPoints?: number;
  warnings?: CrmWarning[];
  warningsCount?: number;
  timeSlot?: string;
  username?: string;
  password?: string; // bcrypt hash from CRM
}

function parseMongoDate(d: unknown): Date | null {
  if (!d) return null;
  if (typeof d === 'string') return new Date(d);
  if (typeof d === 'object' && d !== null && '$date' in d) {
    const v = (d as MongoDate).$date;
    return v ? new Date(v) : null;
  }
  return null;
}

/** "5" | 5 | "6-sinf" | "6B" → 6. "0" or unparseable → null. */
function normalizeGrade(g: unknown): number | null {
  if (g == null) return null;
  if (typeof g === 'number') return g > 0 && g <= 12 ? g : null;
  const m = String(g).match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= 12 ? n : null;
}

/** Phone "91 443 40 15" → "914434015". Strips +998 / spaces / dashes. */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^998/, '');
}

function pickLogin(s: CrmStudent, taken: Set<string>): string {
  const seed = s.username?.trim() || (s.phone ? digitsOnly(s.phone) : '') ||
    `${s.firstName}.${s.lastName}`.toLowerCase().replace(/[^a-z0-9.]/g, '');
  let login = seed || `student-${s._id.$oid.slice(-6)}`;
  let i = 1;
  while (taken.has(login)) {
    i += 1;
    login = `${seed}${i}`;
  }
  taken.add(login);
  return login;
}

async function main() {
  console.log('[import] Reading', BACKUP_FILE);
  const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
  const students: CrmStudent[] = JSON.parse(raw);
  console.log(`[import] Loaded ${students.length} student records.`);

  // 1. Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {},
    create: { name: TENANT_NAME, slug: TENANT_SLUG, status: 'active' },
  });
  console.log(`[import] Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Branch (find-or-create — Branch has no unique slug, so match by name)
  let branch = await prisma.branch.findFirst({
    where: { tenantId: tenant.id, name: BRANCH_NAME },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: { tenantId: tenant.id, name: BRANCH_NAME },
    });
  }
  console.log(`[import] Branch: ${branch.name} (${branch.id})`);

  // 3. Pre-fetch logins already taken in this tenant so we don't collide.
  const existingLogins = await prisma.user.findMany({
    where: { tenantId: tenant.id },
    select: { login: true },
  });
  const taken = new Set(existingLogins.map((u) => u.login));

  // 4. One-shot fallback hash so we don't pay bcrypt 42x.
  const fallbackHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of students) {
    const crmStudentId = s._id?.$oid;
    if (!crmStudentId) {
      console.warn('[import] Skipping record without _id:', s);
      skipped += 1;
      continue;
    }

    // If already imported, the login on the existing row is stable;
    // don't re-pick a fresh one (would collide).
    const existing = await prisma.user.findUnique({
      where: { crmStudentId },
      select: { id: true, login: true },
    });

    const login = existing?.login ?? pickLogin(s, taken);
    const passwordHash =
      s.password && s.password.startsWith('$2') ? s.password : fallbackHash;

    const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Noma\'lum';

    const status: UserStatus = s.isLocked
      ? UserStatus.blocked_warning
      : UserStatus.active;

    const data: Prisma.UserUncheckedCreateInput = {
      tenantId: tenant.id,
      branchId: branch.id,
      role: UserRole.student,
      name,
      login,
      passwordHash,
      phone: s.phone ?? null,
      status,
      firstName: s.firstName ?? null,
      lastName: s.lastName ?? null,
      region: s.region ?? null,
      school: s.school ?? null,
      district: s.district ?? null,
      grade: normalizeGrade(s.grade),
      // Json columns: use DbNull / JsonNull, NOT TS null.
      steps: s.steps ?? Prisma.DbNull,
      percentage: s.percentage ?? null,
      isPaid: s.isPaid ?? null,
      blockedReason: s.blockedReason ?? null,
      joinedAt: parseMongoDate(s.joinedAt),
      totalPoints: s.totalPoints ?? null,
      timeSlot: s.timeSlot ?? null,
      warnings: s.warnings
        ? (s.warnings as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      warningsCount: s.warningsCount ?? null,
      crmStudentId,
      createdAt: parseMongoDate(s.createdAt) ?? new Date(),
    };

    if (existing) {
      // Don't overwrite passwordHash on re-import — admins may have rotated.
      const {
        passwordHash: _omit,
        createdAt: _omit2,
        ...updateData
      } = data;
      await prisma.user.update({
        where: { id: existing.id },
        data: updateData,
      });
      updated += 1;
    } else {
      await prisma.user.create({ data });
      created += 1;
    }
  }

  console.log(
    `[import] Done. created=${created} updated=${updated} skipped=${skipped}`,
  );
}

main()
  .catch((e) => {
    console.error('[import] FAILED:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
