# Faza 4 Multi-tenant Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Superadmin uchun bitta sahifada yangi markaz + birinchi admin (filadmin) + ixtiyoriy birinchi filialni atomic tarzda yaratuvchi onboarding flow.

**Architecture:** `POST /tenants/onboard` endpoint Prisma `$transaction` ichida tenant + branch (ixtiyoriy) + filadmin user yaratadi. Frontend'da `/superadmin/tenants/new` sahifa: 3 seksiyali form, slug auto-derive, crypto-secure parol generatori, muvaffaqiyatdan keyin credentials modal (clipboard + print).

**Tech Stack:** NestJS 10, Prisma v5 + PostgreSQL, Next.js 15 App Router, TypeScript, Tailwind CSS, bcrypt, class-validator.

---

## Execution Discipline

**Phase-level batching:** Bu plan 3 ta phase'ga bo'lingan. Har phase ichida hamma task'lar bajariladi, **keyin** quality gates **bir marta** ishga tushiriladi, **keyin** bitta commit qilinadi. Phase ichida intermediate commit yo'q.

**Sacred quality bar (har phase commit'idan oldin majburiy):**
1. `pnpm tsc --noEmit` — 0 errors
2. `pnpm lint` (yoki `npm run lint`) — 0 errors changed code'da
3. `pnpm build` (affected workspace) — pass
4. Unit testlar — barchasi pass
5. Cross-aggregate integratsiya testlari — bu plan'da Phase 1 oxirida `tenants.spec.ts` integratsiya pattern bilan (real Prisma transaction mock'lar bilan) yoziladi

**Hard ban:**
- `--no-verify` **ishlatilmaydi**. Pre-commit hook fail bo'lsa, root cause'ni topib tuzatish.
- `HUSKY=0`, hook disable, hook config edit — **yo'q**. Hook noto'g'ri bo'lsa user bilan kelishish kerak.

**Worktree:** Plan executor'i `.worktrees/faza4-tenant-onboarding` worktree'ida ishlashi kerak (`feat/faza4-tenant-onboarding` branch).

---

## File Map

**Phase 1 — Backend (Create/Modify):**
- Create: `apps/api/src/tenants/dto/onboard-tenant.dto.ts`
- Create: `apps/api/test/tenants.spec.ts`
- Modify: `apps/api/src/tenants/tenants.service.ts` — `onboardTenant()` method qo'shish
- Modify: `apps/api/src/tenants/tenants.controller.ts` — `POST /onboard` endpoint qo'shish

**Phase 2 — Frontend (Create/Modify):**
- Create: `apps/web/app/(dashboard)/superadmin/tenants/new/page.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/tenants/new/_components/OnboardForm.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/tenants/new/_components/CredentialsModal.tsx`
- Modify: `apps/web/app/(dashboard)/superadmin/page.tsx` — "Yangi Markaz" nav card qo'shish

**Phase 3 — Integration verification:** kod o'zgarishi yo'q, manual e2e test va plan natijalarini hujjatlash.

---

# Phase 1: Backend onboarding endpoint

**Maqsad:** `POST /tenants/onboard` endpoint atomic transaction bilan tenant + admin + (ixtiyoriy) branch yaratadi. Unit testlar bilan qoplangan.

**Phase commit:** Phase 1 oxirida — barcha task'lar tugagandan keyin va quality gates pass etgandan keyin.

---

## Task 1.1: Onboard DTO yaratish

**Files:**
- Create: `apps/api/src/tenants/dto/onboard-tenant.dto.ts`

- [ ] **Step 1: DTO faylini yaratish**

Yangi fayl `apps/api/src/tenants/dto/onboard-tenant.dto.ts`:
```ts
import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardTenantPart {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,50}$/, {
    message: "Slug faqat a-z, 0-9, - belgilarni o'z ichiga oladi (3-50 belgi)",
  })
  slug!: string;
}

export class OnboardAdminPart {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Login: faqat harflar, raqamlar, _ . -',
  })
  login!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class OnboardBranchPart {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class OnboardTenantDto {
  @IsObject()
  @ValidateNested()
  @Type(() => OnboardTenantPart)
  tenant!: OnboardTenantPart;

  @IsObject()
  @ValidateNested()
  @Type(() => OnboardAdminPart)
  admin!: OnboardAdminPart;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OnboardBranchPart)
  branch?: OnboardBranchPart;
}
```

---

## Task 1.2: Service'ga `onboardTenant` method qo'shish

**Files:**
- Modify: `apps/api/src/tenants/tenants.service.ts`

- [ ] **Step 1: Import'larga `bcrypt` va `UserRole` qo'shish**

`apps/api/src/tenants/tenants.service.ts` faylining tepasida import'lar quyidagicha bo'lsin:
```ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
```

- [ ] **Step 2: `TenantsService` class ichiga `onboardTenant` method qo'shish**

Mavjud `findById` method'idan keyin yangi method qo'shing:
```ts
  async onboardTenant(dto: OnboardTenantDto) {
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.tenant.slug },
    });
    if (existing) {
      throw new ConflictException("Bu slug band, boshqasini tanlang");
    }

    const passwordHash = await bcrypt.hash(dto.admin.password, 12);

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.tenant.name,
          slug: dto.tenant.slug,
          status: 'active',
        },
      });

      let branch: { id: string; name: string } | null = null;
      if (dto.branch) {
        const created = await tx.branch.create({
          data: { tenantId: tenant.id, name: dto.branch.name },
        });
        branch = { id: created.id, name: created.name };
      }

      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          branchId: branch?.id,
          role: UserRole.filadmin,
          name: dto.admin.name,
          login: dto.admin.login,
          passwordHash,
          phone: dto.admin.phone,
          status: 'active',
        },
      });

      return {
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        admin: { id: admin.id, name: admin.name, login: admin.login },
        branch,
      };
    });
  }
```

---

## Task 1.3: Controller'ga `POST /onboard` qo'shish

**Files:**
- Modify: `apps/api/src/tenants/tenants.controller.ts`

- [ ] **Step 1: Import'ga `OnboardTenantDto` qo'shish**

`apps/api/src/tenants/tenants.controller.ts` faylining tepasiga:
```ts
import { OnboardTenantDto } from './dto/onboard-tenant.dto';
```

- [ ] **Step 2: Yangi route handler qo'shish**

Mavjud `create()` method'idan keyin (yoki controller class ichidagi mos joyga):
```ts
  @Post('onboard')
  @Roles(UserRole.superadmin)
  onboard(@Body() dto: OnboardTenantDto) {
    return this.tenants.onboardTenant(dto);
  }
```

`@UseGuards(JwtAuthGuard, RolesGuard)` class-level decorator allaqachon mavjud — qo'shimcha kerak emas.

---

## Task 1.4: Unit testlar

**Files:**
- Create: `apps/api/test/tenants.spec.ts`

- [ ] **Step 1: Test fayli yaratish**

Yangi fayl `apps/api/test/tenants.spec.ts`:
```ts
import { TenantsService } from '../src/tenants/tenants.service';
import { ConflictException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('TenantsService — onboardTenant', () => {
  function makeMockPrisma() {
    const mock = {
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      branch: {
        create: jest.fn(),
      },
      user: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    // $transaction(cb) → cb(tx) where tx === mock (same handlers)
    mock.$transaction.mockImplementation(async (cb: (tx: typeof mock) => Promise<unknown>) =>
      cb(mock),
    );
    return mock;
  }

  beforeEach(() => jest.clearAllMocks());

  it('creates tenant + admin + branch atomically when all fields valid', async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.create.mockResolvedValue({ id: 't1', name: 'Markaz', slug: 'markaz' });
    mockPrisma.branch.create.mockResolvedValue({ id: 'b1', name: 'Markaziy' });
    mockPrisma.user.create.mockResolvedValue({ id: 'u1', name: 'Akmal', login: 'akmal' });

    const service = new TenantsService(mockPrisma as never);
    const result = await service.onboardTenant({
      tenant: { name: 'Markaz', slug: 'markaz' },
      admin: { name: 'Akmal', login: 'akmal', password: 'secret123' },
      branch: { name: 'Markaziy' },
    });

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.tenant.create).toHaveBeenCalledWith({
      data: { name: 'Markaz', slug: 'markaz', status: 'active' },
    });
    expect(mockPrisma.branch.create).toHaveBeenCalledWith({
      data: { tenantId: 't1', name: 'Markaziy' },
    });
    const userCallArg = mockPrisma.user.create.mock.calls[0][0];
    expect(userCallArg.data.tenantId).toBe('t1');
    expect(userCallArg.data.branchId).toBe('b1');
    expect(userCallArg.data.role).toBe(UserRole.filadmin);
    expect(userCallArg.data.passwordHash).toBeDefined();
    expect(userCallArg.data.passwordHash).not.toBe('secret123');
    expect(userCallArg.data.password).toBeUndefined();
    expect(result).toEqual({
      tenant: { id: 't1', name: 'Markaz', slug: 'markaz' },
      admin: { id: 'u1', name: 'Akmal', login: 'akmal' },
      branch: { id: 'b1', name: 'Markaziy' },
    });
  });

  it('creates tenant + admin without branch when branch field omitted', async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.create.mockResolvedValue({ id: 't2', name: 'M2', slug: 'm2' });
    mockPrisma.user.create.mockResolvedValue({ id: 'u2', name: 'B', login: 'b' });

    const service = new TenantsService(mockPrisma as never);
    const result = await service.onboardTenant({
      tenant: { name: 'M2', slug: 'm2' },
      admin: { name: 'B', login: 'b', password: 'secret123' },
    });

    expect(mockPrisma.branch.create).not.toHaveBeenCalled();
    const userCallArg = mockPrisma.user.create.mock.calls[0][0];
    expect(userCallArg.data.branchId).toBeUndefined();
    expect(result.branch).toBeNull();
  });

  it('throws ConflictException when slug already exists', async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.tenant.findUnique.mockResolvedValue({ id: 'existing', slug: 'taken' });

    const service = new TenantsService(mockPrisma as never);
    await expect(
      service.onboardTenant({
        tenant: { name: 'X', slug: 'taken' },
        admin: { name: 'A', login: 'a', password: 'secret123' },
      }),
    ).rejects.toThrow(ConflictException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.tenant.create).not.toHaveBeenCalled();
  });

  it('does not call user.create when branch.create fails (transaction integrity)', async () => {
    const mockPrisma = makeMockPrisma();
    mockPrisma.tenant.findUnique.mockResolvedValue(null);
    mockPrisma.tenant.create.mockResolvedValue({ id: 't3', name: 'M3', slug: 'm3' });
    mockPrisma.branch.create.mockRejectedValue(new Error('DB error'));

    const service = new TenantsService(mockPrisma as never);
    await expect(
      service.onboardTenant({
        tenant: { name: 'M3', slug: 'm3' },
        admin: { name: 'A', login: 'a', password: 'secret123' },
        branch: { name: 'X' },
      }),
    ).rejects.toThrow('DB error');
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });
});
```

---

## Phase 1 — Quality Gates va Commit

- [ ] **Step 1: TypeScript tekshirish (api workspace)**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/api && npx tsc --noEmit
```

Kutilgan: 0 errors. Output bo'lmasligi kerak.

- [ ] **Step 2: Lint tekshirish (changed files)**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding && npx eslint apps/api/src/tenants apps/api/test/tenants.spec.ts
```

Kutilgan: 0 errors va 0 warnings.

Eslatma: `apps/api/.eslintrc` yoki `apps/api/eslint.config.*` bo'lmasligi mumkin — agar root config'dan vorislik bo'lsa, yuqoridagi buyruq ishlaydi. Agar `pnpm` script mavjud bo'lsa: `cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/api && npm run lint -- src/tenants test/tenants.spec.ts` (lekin api'da bu script yo'q — ESLint to'g'ridan-to'g'ri ishlatiladi).

- [ ] **Step 3: Unit testlarni ishga tushirish**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/api && npm test -- --testPathPattern="test/tenants" --no-coverage
```

Kutilgan: 4 ta test pass.

- [ ] **Step 4: To'liq API test suite — regression yo'qligini tekshirish**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/api && npm test -- --no-coverage 2>&1 | tail -10
```

Kutilgan: yangi test'lar pass (`tenants.spec.ts`). Mavjud pre-existing infra failures (`test/prisma.spec.ts`, `test/cron.spec.ts`, `src/cron/cron.spec.ts`, `src/delegations/delegations.spec.ts`) — baseline davomi (4 fail), yangi failures **yo'q**. Agar yangi failure bor bo'lsa — to'xtab tahlil qilish.

- [ ] **Step 5: API build**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/api && npm run build 2>&1 | tail -5
```

Kutilgan: build pass (Nest build "Successfully compiled" yoki shunga o'xshash).

- [ ] **Step 6: Phase 1 ni single commit qilish**

```bash
git -C d:/projects/alochi/.worktrees/faza4-tenant-onboarding add \
  apps/api/src/tenants/dto/onboard-tenant.dto.ts \
  apps/api/src/tenants/tenants.service.ts \
  apps/api/src/tenants/tenants.controller.ts \
  apps/api/test/tenants.spec.ts

git -C d:/projects/alochi/.worktrees/faza4-tenant-onboarding commit -m "feat(api): atomic tenant onboarding endpoint with admin + optional branch

- POST /tenants/onboard creates tenant + filadmin user + optional branch in one transaction
- bcrypt cost 12 for password, crypto-secure handling
- 4 unit tests covering happy path, no-branch path, slug conflict, transaction rollback"
```

**Husky pre-commit hook ishga tushadi.** Agar fail bo'lsa, root cause'ni topib tuzatish — `--no-verify` **YO'Q**.

---

# Phase 2: Frontend onboarding flow

**Maqsad:** `/superadmin/tenants/new` sahifasi — form, slug auto-derive, parol generator, credentials modal.

**Phase commit:** Phase 2 oxirida — barcha task'lar tugagandan keyin va quality gates pass etgandan keyin.

---

## Task 2.1: `OnboardForm` client component yaratish

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/tenants/new/_components/OnboardForm.tsx`

- [ ] **Step 1: Form komponentini yaratish**

Yangi fayl `apps/web/app/(dashboard)/superadmin/tenants/new/_components/OnboardForm.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { Building2, RefreshCw, User, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { CredentialsModal } from './CredentialsModal';

const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function generatePassword(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

interface OnboardResponse {
  tenant: { id: string; name: string; slug: string };
  admin: { id: string; name: string; login: string };
  branch: { id: string; name: string } | null;
}

interface ModalData {
  tenantSlug: string;
  login: string;
  password: string;
}

export function OnboardForm() {
  const [tenantName, setTenantName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminLogin, setAdminLogin] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [includeBranch, setIncludeBranch] = useState(false);
  const [branchName, setBranchName] = useState('Markaziy filial');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<ModalData | null>(null);

  function onTenantNameChange(value: string) {
    setTenantName(value);
    if (!slugTouched) setSlug(deriveSlug(value));
  }

  function onSlugChange(value: string) {
    setSlug(value);
    setSlugTouched(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const r = await apiRequest<OnboardResponse>('/tenants/onboard', {
        method: 'POST',
        body: JSON.stringify({
          tenant: { name: tenantName, slug },
          admin: {
            name: adminName,
            login: adminLogin,
            password: adminPassword,
            ...(adminPhone ? { phone: adminPhone } : {}),
          },
          ...(includeBranch ? { branch: { name: branchName } } : {}),
        }),
      }, token);
      setModal({
        tenantSlug: r.data.tenant.slug,
        login: r.data.admin.login,
        password: adminPassword,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Server xatosi';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
        {error && (
          <div className="p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Building2 size={16} className="text-emerald-400" />
            Markaz ma&apos;lumotlari
          </h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Markaz nomi *</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={tenantName}
              onChange={(e) => onTenantNameChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
              placeholder="Toshkent IELTS Markazi"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Slug *</label>
            <input
              type="text"
              required
              pattern="[a-z0-9-]{3,50}"
              value={slug}
              onChange={(e) => onSlugChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-emerald-500 outline-none"
              placeholder="toshkent-ielts"
            />
            <p className="text-xs text-slate-500 mt-1">URL: /{slug || 'slug'}/login</p>
          </div>
        </section>

        <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <User size={16} className="text-blue-400" />
            Birinchi admin (filadmin)
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Ism *</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Login *</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={50}
                pattern="[a-zA-Z0-9_.\-]+"
                value={adminLogin}
                onChange={(e) => setAdminLogin(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Lock size={12} /> Parol *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                minLength={6}
                maxLength={100}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm font-mono focus:border-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setAdminPassword(generatePassword())}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 flex items-center gap-1.5"
              >
                <RefreshCw size={12} /> Generate
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Telefon (ixtiyoriy)</label>
            <input
              type="text"
              maxLength={20}
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-blue-500 outline-none"
              placeholder="+998 90 123 45 67"
            />
          </div>
        </section>

        <section className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includeBranch}
              onChange={(e) => setIncludeBranch(e.target.checked)}
              className="w-4 h-4"
            />
            Birinchi filial ham yaratish (ixtiyoriy)
          </label>
          {includeBranch && (
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Filial nomi *</label>
              <input
                type="text"
                required={includeBranch}
                minLength={2}
                maxLength={100}
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none"
              />
            </div>
          )}
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => history.back()}
            className="px-5 py-2 text-sm text-slate-400 hover:text-white"
          >
            Bekor
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm"
          >
            {submitting ? 'Yaratilmoqda...' : 'Markaz Yaratish'}
          </button>
        </div>
      </form>

      {modal && <CredentialsModal data={modal} onClose={() => (window.location.href = '/superadmin')} />}
    </>
  );
}
```

---

## Task 2.2: `CredentialsModal` komponenti

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/tenants/new/_components/CredentialsModal.tsx`

- [ ] **Step 1: Modal komponentini yaratish**

Yangi fayl `apps/web/app/(dashboard)/superadmin/tenants/new/_components/CredentialsModal.tsx`:
```tsx
'use client';
import { useState } from 'react';
import { CheckCircle2, Copy, Printer, AlertTriangle } from 'lucide-react';

interface Props {
  data: {
    tenantSlug: string;
    login: string;
    password: string;
  };
  onClose: () => void;
}

export function CredentialsModal({ data, onClose }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function copy(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // clipboard yo'q yoki HTTPS emas
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 print:bg-white print:relative print:p-0">
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 print:bg-white print:border-0 print:shadow-none print:max-w-full" id="credentials-print">
        <div className="flex items-center gap-3 mb-4 print:text-black">
          <CheckCircle2 className="text-emerald-400 print:text-emerald-700" size={24} />
          <h2 className="text-lg font-bold text-white print:text-black">
            Markaz muvaffaqiyatli yaratildi
          </h2>
        </div>

        <div className="bg-amber-900/30 border border-amber-800 rounded-lg p-3 mb-4 flex items-start gap-2 print:hidden">
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={14} />
          <p className="text-xs text-amber-200">
            Bu ma&apos;lumotlarni admin&apos;ga yetkazib bering. Modal yopilgandan keyin parol qaytadan ko&apos;rsatilmaydi.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <CredentialRow label="Markaz URL" value={`/${data.tenantSlug}/login`} field="url" copiedField={copiedField} onCopy={copy} />
          <CredentialRow label="Login" value={data.login} field="login" copiedField={copiedField} onCopy={copy} />
          <CredentialRow label="Parol" value={data.password} field="password" copiedField={copiedField} onCopy={copy} />
        </div>

        <div className="flex justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <Printer size={14} /> Chop etish
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm"
          >
            Yopib ro&apos;yxatga
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  field,
  copiedField,
  onCopy,
}: {
  label: string;
  value: string;
  field: string;
  copiedField: string | null;
  onCopy: (v: string, f: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 print:py-1">
      <span className="text-xs text-slate-400 w-24 print:text-black print:font-semibold">{label}</span>
      <code className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white font-mono print:bg-transparent print:border-0 print:text-black print:px-0">
        {value}
      </code>
      <button
        type="button"
        onClick={() => onCopy(value, field)}
        className="px-2 py-1.5 text-slate-400 hover:text-white print:hidden"
        aria-label="Nusxa olish"
      >
        {copiedField === field ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
```

---

## Task 2.3: Sahifa entry point

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/tenants/new/page.tsx`

- [ ] **Step 1: Sahifani yaratish**

Yangi fayl `apps/web/app/(dashboard)/superadmin/tenants/new/page.tsx`:
```tsx
import { Building2 } from 'lucide-react';
import { OnboardForm } from './_components/OnboardForm';

export const metadata = {
  title: 'Yangi Markaz — Alochi',
};

export default function NewTenantPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="text-emerald-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Yangi Markaz Qo&apos;shish</h1>
      </div>
      <OnboardForm />
    </div>
  );
}
```

---

## Task 2.4: Superadmin nav card

**Files:**
- Modify: `apps/web/app/(dashboard)/superadmin/page.tsx`

- [ ] **Step 1: Mavjud sahifani o'qib mos joyni topish**

`apps/web/app/(dashboard)/superadmin/page.tsx` da nav cards array bo'ladi (Faza 3 da kengaytirildi). Birinchi navbatda nav card array'i qaerdaligini aniqlang.

- [ ] **Step 2: "Yangi Markaz" nav card qo'shish**

Mavjud nav card array'iga (`{ href: '/superadmin/branches', icon: Building2, ... }` bilan birga) yangi entry qo'shing — birinchi pozitsiyada (eng muhim onboarding amali):
```tsx
{ href: '/superadmin/tenants/new', icon: Building2, label: "Yangi Markaz", color: 'text-emerald-400' },
```

Eslatma: `Building2` ikonkasi allaqachon ishlatiladi. Agar yo'q bo'lsa — `import { Building2 } from 'lucide-react'` qo'shish.

---

## Phase 2 — Quality Gates va Commit

- [ ] **Step 1: TypeScript tekshirish (web workspace)**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/web && node_modules/.bin/tsc --noEmit
```

Kutilgan: 0 errors. Output bo'lmasligi kerak.

- [ ] **Step 2: Lint (changed files)**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/web && node_modules/.bin/eslint "app/(dashboard)/superadmin/tenants/**" "app/(dashboard)/superadmin/page.tsx"
```

Kutilgan: 0 errors va 0 warnings.

- [ ] **Step 3: Web production build**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/web && npm run build 2>&1 | tail -10
```

Kutilgan: build pass, `Compiled successfully` yoki ekvivalent. Yangi route `/superadmin/tenants/new` build output'da ko'rinishi kerak.

- [ ] **Step 4: Phase 2 ni single commit qilish**

```bash
git -C d:/projects/alochi/.worktrees/faza4-tenant-onboarding add \
  "apps/web/app/(dashboard)/superadmin/tenants" \
  "apps/web/app/(dashboard)/superadmin/page.tsx"

git -C d:/projects/alochi/.worktrees/faza4-tenant-onboarding commit -m "feat(web): tenant onboarding form + credentials modal at /superadmin/tenants/new

- 3-section form: tenant info, admin user, optional branch
- Auto-derive slug from tenant name (with manual override)
- Crypto-secure password generator (no Math.random)
- Success modal shows credentials once with clipboard + print support
- Adds 'Yangi Markaz' nav card to superadmin dashboard"
```

**Husky pre-commit hook ishga tushadi** — fail bo'lsa root cause'ni topib tuzatish, `--no-verify` **YO'Q**.

---

# Phase 3: Integration verification

**Maqsad:** End-to-end manual test — yangi markaz yaratib, o'sha credentials bilan kirib, dashboard'ga o'tish ishlashini tasdiqlash.

**Phase commit:** Bu phase'da kod o'zgarishi yo'q. Agar manual test'da xato chiqsa — tegishli phase'ga qaytib fix qilinadi va Phase 1/2 commit'i ustiga `fix:` commit qo'shiladi.

---

## Task 3.1: API + Web ni production'da ishga tushirish

**Files:** None (verification only)

- [ ] **Step 1: API ni ishga tushirish (terminal 1)**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/api && npm run start:dev
```

Kutilgan: NestJS started, port 3001'da listening.

- [ ] **Step 2: Web'ni production'da ishga tushirish (terminal 2)**

```bash
cd d:/projects/alochi/.worktrees/faza4-tenant-onboarding/apps/web && npm run start
```

Kutilgan: Next.js started, port 3000'da listening (production mode).

---

## Task 3.2: End-to-end manual test

**Files:** None

- [ ] **Step 1: Superadmin sifatida login qilish**

Brauzerda `http://localhost:3000/login` ga o'tib mavjud superadmin login + parol bilan kirish.

- [ ] **Step 2: `/superadmin/tenants/new` ga o'tish**

Dashboard'da "Yangi Markaz" nav card bosish yoki to'g'ridan-to'g'ri URL'ga o'tish. Kutilgan: form ochiladi.

- [ ] **Step 3: Form to'ldirish**

Misol ma'lumotlar:
- Markaz nomi: `Test E2E Markaz`
- Slug: avtomatik `test-e2e-markaz` ga o'rnatiladi
- Admin ism: `E2E Admin`
- Admin login: `e2eadmin`
- Parol: "Generate" tugma bosib generatsiya qilish
- Telefon: bo'sh
- Filial: belgilash, nom: `Markaziy filial`

"Markaz Yaratish" tugma bosish.

- [ ] **Step 4: Credentials modal'ni tasdiqlash**

Kutilgan:
- Modal ochiladi
- "✓ Markaz muvaffaqiyatli yaratildi" sarlavha ko'rinadi
- 3 ta credential qator: URL (`/test-e2e-markaz/login`), Login (`e2eadmin`), Parol (generated)
- Har birida nusxalash tugma — bosib clipboard'ga ko'chadi (icon checkmark'ga o'zgaradi)

Parolni qog'ozga yozib oling — keyingi qadam uchun kerak.

- [ ] **Step 5: Print preview**

"Chop etish" tugma bosish — brauzer print preview ochilishi kerak. Preview'da credentials sahifasi A4 formatda, navigation/banner'siz. Cancel bosish.

- [ ] **Step 6: Modal yopish**

"Yopib ro'yxatga" tugma — `/superadmin` ga redirect bo'lish kerak.

- [ ] **Step 7: Yangi tenant bilan login qilish**

`/login` (yoki `/test-e2e-markaz/login`) ga o'tib:
- Login: `e2eadmin`
- Parol: 4-qadam'da yozib olingan
- (agar tenant slug input bo'lsa) Slug: `test-e2e-markaz`

Login bosish. Kutilgan: filadmin dashboard (`/filadmin`) ga muvaffaqiyatli kirish.

- [ ] **Step 8: Negative test — slug duplicate**

Superadmin sahifasidan yana `/superadmin/tenants/new` ga o'tib **bir xil slug** (`test-e2e-markaz`) bilan urinib ko'rish.

Kutilgan: error banner — "Bu slug band, boshqasini tanlang" yoki shunga o'xshash.

- [ ] **Step 9: Negative test — parol < 6 belgi**

Form'ga `12345` parol kiritib submit qilish.

Kutilgan: HTML5 client-side validatsiya yoki server xato — parol yetarli emas.

- [ ] **Step 10: Cleanup (ixtiyoriy)**

Test e2e tenant'ini DB'dan o'chirish (agar kerak bo'lsa, `psql` orqali yoki keyingi cleanup script'i bilan). Yoki hech bo'lmaganda nomini belgilab qo'yish.

---

## Phase 3 — Verification natija

- [ ] **Step 1: Test natijalarini hujjatlash**

Quyidagi format'da hisobot chiqarish:

```
Phase 3 Manual E2E Results:
- Step 1 (superadmin login): PASS / FAIL
- Step 2 (navigate to /superadmin/tenants/new): PASS / FAIL
- Step 3 (form submit): PASS / FAIL
- Step 4 (credentials modal + clipboard): PASS / FAIL
- Step 5 (print preview): PASS / FAIL
- Step 6 (close modal redirect): PASS / FAIL
- Step 7 (new tenant login): PASS / FAIL
- Step 8 (slug duplicate negative): PASS / FAIL
- Step 9 (password too short negative): PASS / FAIL
```

Agar biror qadam FAIL bo'lsa: Phase 1 yoki Phase 2 ga qaytib fix qilinadi va `fix:` commit qo'shiladi (yangi phase emas — fix existing).

**Phase 3 da kod commit yo'q.** Manual verification only.

---

## Self-Review

**Spec coverage** (har spec bandi qaysi task'da yopiladi):

| Spec section | Task |
|---|---|
| §2.1 OnboardTenantDto | Task 1.1 |
| §2.2 onboardTenant service + atomic transaction | Task 1.2 |
| §2.3 POST /tenants/onboard endpoint | Task 1.3 |
| §3.1–3.2 Sahifa joylashuvi va form layout | Task 2.1 + 2.3 |
| §3.3 Slug auto-derive | Task 2.1 (`deriveSlug`) |
| §3.4 Crypto-secure parol generator | Task 2.1 (`generatePassword`) |
| §3.5 Validatsiya | Task 1.1 (server-side DTO) + Task 2.1 (client-side HTML5) |
| §3.6 Submit flow | Task 2.1 (`onSubmit`) |
| §3.7 Credentials modal | Task 2.2 |
| §3.8 Nav update | Task 2.4 |
| §4 Xavfsizlik | Implicit barcha task'larda — bcrypt 12, crypto.getRandomValues, slug regex, atomic tx, role guard |
| §5.1 Backend unit testlar | Task 1.4 (4 test) |
| §5.3 Manual test checklist | Phase 3 |
| §7 Acceptance criteria | Phase 1 + Phase 2 quality gates + Phase 3 manual verification |

**Type consistency:**
- DTO field name: `passwordHash` ishlatilmaydi DTO'da — DTO'da `password` (plaintext input), service ichida `passwordHash` (Prisma field). Bu mos pattern (`users.service.ts:21–24` da bir xil).
- `OnboardResponse` interface frontend'da backend response'iga mos: `{ tenant, admin, branch | null }`.
- Service `onboardTenant` qaytadigan tip va frontend `OnboardResponse` mos.

**Placeholder scan:** Hech qaysi step'da "TBD", "implement later", "add validation" yo'q. Har bir code block to'liq.

**Scope check:** Single subsystem (multi-tenant onboarding). 3 phase mantiqiy bo'lingan: backend → frontend → verification. Plan to'g'ri sklillangan.
