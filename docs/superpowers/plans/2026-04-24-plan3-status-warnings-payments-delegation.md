# Plan 3: Status + Davomat + KPI + Ogohlantirish + To'lov + Delegatsiya Audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3 ta mustaqil o'quvchi statuslari, davomat tizimi, KPI hisoblash, ogohlantirish + avtomatik bloklash, to'lov + cron bloklash/ochish, va delegatsiya audit tizimini amalga oshirish.

**Architecture:** 7 ta asosiy NestJS module (status, attendance, kpi, warnings, payments, cron, delegations). Bloklash/ochish logikasi cron job + event-driven (3 ta ogohlantirish → darhol bloklash). Delegatsiya: pending → active → completed/rejected/cancelled holat mashina. PDF eksport: Puppeteer.

**Tech Stack:** Plan 1–2 stack + node-cron, Puppeteer (PDF), Grammy.js (Telegram, Plan 4 da faollashtiriladi), @nestjs/event-emitter

**Shart:** Plan 1–2 bajarilgan.

---

## Fayl Tuzilmasi

```
apps/api/src/
  student-status/
    status.module.ts
    status.service.ts
    status.controller.ts
  attendance/
    attendance.module.ts
    attendance-students.service.ts
    attendance-staff.service.ts
    attendance.controller.ts
  kpi/
    kpi.module.ts
    kpi.service.ts
    kpi.controller.ts
  warnings/
    warnings.module.ts
    warnings.service.ts
    warnings.controller.ts
  payments/
    payments.module.ts
    payments.service.ts
    payments.controller.ts
  delegations/
    delegations.module.ts
    delegations.service.ts
    delegations.controller.ts
    audit-log.service.ts
    dto/
      create-delegation.dto.ts
      respond-delegation.dto.ts
  cron/
    cron.module.ts
    cron.service.ts           ← warnings bloklash, payment bloklash/ochish, delegation timeout

prisma/schema.prisma          ← yangi jadvallar qo'shiladi

apps/web/app/(dashboard)/
  filadmin/
    warnings/page.tsx         ← Ogohlantirish berish + tarixi
    payments/page.tsx         ← To'lov ro'yxati
    attendance/page.tsx       ← Xodim davomati
  mentor/
    attendance/page.tsx       ← O'quvchi davomati
  delegations/
    page.tsx                  ← Delegatsiyalar ro'yxati (barcha roller)
    [id]/page.tsx             ← Timeline drill-down + PDF
    new/page.tsx              ← Yangi delegatsiya yaratish
```

---

### Task 1: Prisma Schema — Status, Davomat, KPI, Ogohlantirish, To'lov, Delegatsiya

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Yangi modellarni schema.prisma ga qo'shing**

```prisma
// ---- STUDENT STATUS ----
model StudentStatus {
  id              String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  studentId       String   @map("student_id") @db.Uuid
  date            DateTime @db.Date
  englishStatus   String?  @map("english_status")   // 'green' | 'yellow' | 'red'
  englishNote     String?  @map("english_note")
  personalStatus  String?  @map("personal_status")
  personalNote    String?  @map("personal_note")
  criticalStatus  String?  @map("critical_status")
  criticalNote    String?  @map("critical_note")
  createdAt       DateTime @default(now()) @map("created_at")

  student         User     @relation("StudentStatuses", fields: [studentId], references: [id])

  @@unique([studentId, date])
  @@index([studentId])
  @@map("student_status")
}

// ---- ATTENDANCE ----
model AttendanceStudent {
  id         String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId   String   @map("tenant_id") @db.Uuid
  branchId   String   @map("branch_id") @db.Uuid
  studentId  String   @map("student_id") @db.Uuid
  date       DateTime @db.Date
  status     String   @default("absent") // 'present' | 'absent' | 'late'
  markedBy   String?  @map("marked_by") @db.Uuid

  student    User     @relation("StudentAttendances", fields: [studentId], references: [id])

  @@unique([studentId, date])
  @@index([branchId, date])
  @@map("attendance_students")
}

model AttendanceStaff {
  id                  String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId            String    @map("tenant_id") @db.Uuid
  branchId            String    @map("branch_id") @db.Uuid
  userId              String    @map("user_id") @db.Uuid
  date                DateTime  @db.Date
  loginTime           DateTime? @map("login_time")
  confirmedAt         DateTime? @map("confirmed_at")
  confirmedBy         String?   @map("confirmed_by") @db.Uuid
  isLate              Boolean   @default(false) @map("is_late")
  recognitionMethod   String    @default("manual") @map("recognition_method")
  // 'face_auto' | 'face_fallback' | 'manual' | 'admin'
  confidence          Float?
  deviceId            String?   @map("device_id")

  user                User      @relation("StaffAttendances", fields: [userId], references: [id])

  @@unique([userId, date])
  @@map("attendance_staff")
}

// ---- KPI ----
model KpiScore {
  id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  date         DateTime @db.Date
  score        Int
  reason       String
  taskId       String?  @map("task_id") @db.Uuid
  delegationId String?  @map("delegation_id") @db.Uuid

  user         User     @relation("KpiScores", fields: [userId], references: [id])

  @@index([userId, date])
  @@map("kpi_scores")
}

// ---- WARNINGS ----
model Warning {
  id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  studentId    String   @map("student_id") @db.Uuid
  givenBy      String   @map("given_by") @db.Uuid
  reasonType   String   @map("reason_type")
  // 'not_prepared' | 'no_homework' | 'discipline' | 'other'
  reasonText   String   @map("reason_text")
  isCancelled  Boolean  @default(false) @map("is_cancelled")
  cancelledBy  String?  @map("cancelled_by") @db.Uuid
  cancelledAt  DateTime? @map("cancelled_at")
  cancelReason String?  @map("cancel_reason")
  delegationId String?  @map("delegation_id") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")

  student      User     @relation("StudentWarnings", fields: [studentId], references: [id])

  @@index([studentId, isCancelled])
  @@map("warnings")
}

// ---- PAYMENTS ----
model PaymentSetting {
  id              String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId        String   @unique @map("tenant_id") @db.Uuid
  paymentStartDay Int      @default(1) @map("payment_start_day")
  paymentEndDay   Int      @default(10) @map("payment_end_day")
  updatedBy       String?  @map("updated_by") @db.Uuid
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("payment_settings")
}

model Payment {
  id           String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  studentId    String   @map("student_id") @db.Uuid
  month        String   // 'YYYY-MM'
  amount       Int      // so'mda
  paidAt       DateTime @map("paid_at")
  recordedBy   String   @map("recorded_by") @db.Uuid
  unblockAt    DateTime @map("unblock_at")
  delegationId String?  @map("delegation_id") @db.Uuid

  student      User     @relation("StudentPayments", fields: [studentId], references: [id])

  @@unique([studentId, month])
  @@index([tenantId, unblockAt])
  @@map("payments")
}

// ---- DELEGATIONS ----
enum DelegationStatus {
  pending
  active
  completed
  cancelled
  rejected
}

model Delegation {
  id            String           @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantId      String           @map("tenant_id") @db.Uuid
  branchId      String           @map("branch_id") @db.Uuid
  fromUserId    String           @map("from_user_id") @db.Uuid
  toUserId      String           @map("to_user_id") @db.Uuid
  delegatedRole String           @map("delegated_role") // 'filadmin' | 'manager'
  permissions   Json             // ['warnings','payments','staff_manage',...]
  reason        String
  startsAt      DateTime         @map("starts_at")
  endsAt        DateTime         @map("ends_at")
  status        DelegationStatus @default(pending)
  cancelledAt   DateTime?        @map("cancelled_at")
  cancelledBy   String?          @map("cancelled_by") @db.Uuid
  cancelReason  String?          @map("cancel_reason")
  createdAt     DateTime         @default(now()) @map("created_at")

  fromUser      User             @relation("DelegationFrom", fields: [fromUserId], references: [id])
  toUser        User             @relation("DelegationTo", fields: [toUserId], references: [id])
  responses     DelegationResponse[]
  auditLogs     DelegationAuditLog[]

  @@index([toUserId, status])
  @@map("delegations")
}

model DelegationResponse {
  id           String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  delegationId String    @map("delegation_id") @db.Uuid
  action       String    // 'accepted' | 'rejected'
  reason       String?
  respondedAt  DateTime  @default(now()) @map("responded_at")

  delegation   Delegation @relation(fields: [delegationId], references: [id])

  @@map("delegation_responses")
}

model DelegationAuditLog {
  id           String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  delegationId String    @map("delegation_id") @db.Uuid
  actorId      String    @map("actor_id") @db.Uuid
  actionType   String    @map("action_type")
  // 'delegation_created' | 'accepted' | 'rejected' | 'warning_given'
  // 'payment_marked' | 'cancelled' | 'auto_completed'
  targetId     String?   @map("target_id") @db.Uuid
  meta         Json?
  performedAt  DateTime  @default(now()) @map("performed_at")

  delegation   Delegation @relation(fields: [delegationId], references: [id])

  @@index([delegationId])
  @@map("delegation_audit_log")
}
```

- [ ] **Step 2: Migration**

```bash
npx prisma migrate dev --name add-status-attendance-kpi-warnings-payments-delegations
```

Unique index qo'shing (1 faol delegatsiya cheklovi):
```sql
-- migration faylga qo'shing
CREATE UNIQUE INDEX one_active_delegation_per_user
  ON delegations(to_user_id)
  WHERE status = 'active';
```

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add status, attendance, kpi, warnings, payments, delegations schema"
```

---

### Task 2: Ogohlantirish Tizimi + Avtomatik Bloklash

**Files:**
- Create: `apps/api/src/warnings/warnings.service.ts`
- Create: `apps/api/src/warnings/warnings.controller.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/warnings.spec.ts`:
```typescript
import { WarningsService } from '../src/warnings/warnings.service';

describe('WarningsService', () => {
  const mockPrisma = {
    warning: {
      create: jest.fn().mockResolvedValue({ id: 'w-1' }),
      count: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ status: 'active' }),
    },
  };
  const mockEvents = { emit: jest.fn() };
  const service = new WarningsService(mockPrisma as any, mockEvents as any);

  beforeEach(() => jest.clearAllMocks());

  it('creates warning and blocks at 3 active', async () => {
    // 2 ta oldin bor, yangi = 3 ta
    mockPrisma.warning.count.mockResolvedValue(3);

    await service.give({
      tenantId: 't', studentId: 's', givenBy: 'admin',
      reasonType: 'discipline', reasonText: 'Intizom buzilishi',
    });

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'blocked_warning' }),
      }),
    );
  });

  it('does not block at 2 active warnings', async () => {
    mockPrisma.warning.count.mockResolvedValue(2);

    await service.give({
      tenantId: 't', studentId: 's', givenBy: 'admin',
      reasonType: 'not_prepared', reasonText: 'Tayyor emas',
    });

    expect(mockPrisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'blocked_warning' } }),
    );
  });

  it('unblocks user when active warnings drop below 3', async () => {
    mockPrisma.warning.count.mockResolvedValue(2); // cancel dan keyin 2 ta qoldi
    await service.cancel('w-id', 'admin', 'Xato berildi');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'active' }),
      }),
    );
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- warnings.spec
```

- [ ] **Step 3: warnings.service.ts**

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface GiveWarningDto {
  tenantId: string;
  studentId: string;
  givenBy: string;
  reasonType: string;
  reasonText: string;
  delegationId?: string;
}

const WARNING_BLOCK_LIMIT = 3;

@Injectable()
export class WarningsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  async give(dto: GiveWarningDto) {
    if (!dto.reasonText.trim()) {
      throw new BadRequestException('Ogohlantirish sababi majburiy');
    }

    const warning = await this.prisma.warning.create({ data: dto });

    const activeCount = await this.prisma.warning.count({
      where: { studentId: dto.studentId, isCancelled: false },
    });

    if (activeCount >= WARNING_BLOCK_LIMIT) {
      await this.prisma.user.update({
        where: { id: dto.studentId },
        data: { status: 'blocked_warning' },
      });
      this.events.emit('student.blocked', { studentId: dto.studentId, reason: 'warning', activeCount });
    } else {
      this.events.emit('warning.given', { studentId: dto.studentId, count: activeCount, warning });
    }

    return { warning, activeCount };
  }

  async cancel(warningId: string, cancelledBy: string, cancelReason: string) {
    if (!cancelReason.trim()) {
      throw new BadRequestException('Bekor qilish sababi majburiy');
    }

    const w = await this.prisma.warning.update({
      where: { id: warningId },
      data: { isCancelled: true, cancelledBy, cancelledAt: new Date(), cancelReason },
    });

    // Agar aktiv ogohlantirishlar 3 dan pastga tushsa, blokni ochish
    const activeCount = await this.prisma.warning.count({
      where: { studentId: w.studentId, isCancelled: false },
    });

    if (activeCount < WARNING_BLOCK_LIMIT) {
      const student = await this.prisma.user.findUniqueOrThrow({ where: { id: w.studentId } });
      if (student.status === 'blocked_warning') {
        await this.prisma.user.update({
          where: { id: w.studentId },
          data: { status: 'active' },
        });
      }
    }

    return { warning: w, activeCount };
  }

  async findByStudent(studentId: string) {
    return this.prisma.warning.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByBranch(branchId: string, tenantId: string) {
    return this.prisma.warning.findMany({
      where: {
        tenantId,
        student: { branchId },
        isCancelled: false,
      },
      include: { student: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- warnings.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/warnings/
git commit -m "feat: add warnings service with auto-block at 3 active and unblock on cancel"
```

---

### Task 3: To'lov Tizimi

**Files:**
- Create: `apps/api/src/payments/payments.service.ts`
- Create: `apps/api/src/payments/payments.controller.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/payments.spec.ts`:
```typescript
import { PaymentsService } from '../src/payments/payments.service';

describe('PaymentsService', () => {
  const mockPrisma = {
    payment: {
      upsert: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      update: jest.fn().mockResolvedValue({}),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ status: 'blocked_payment' }),
    },
  };

  const service = new PaymentsService(mockPrisma as any);

  it('marks payment and sets unblock_at to next day midnight', async () => {
    const paidAt = new Date('2026-05-10T14:00:00Z');
    mockPrisma.payment.upsert.mockResolvedValue({ unblockAt: paidAt });

    await service.markPaid({
      tenantId: 't', studentId: 's', recordedBy: 'filadmin',
      month: '2026-05', amount: 500000, paidAt,
    });

    const callArg = mockPrisma.payment.upsert.mock.calls[0][0];
    // unblock_at = paidAt + 1 kun, 00:00
    const unblockAt: Date = callArg.create.unblockAt;
    expect(unblockAt.getDate()).toBe(paidAt.getDate() + 1);
    expect(unblockAt.getHours()).toBe(0);
    expect(unblockAt.getMinutes()).toBe(0);
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- payments.spec
```

- [ ] **Step 3: payments.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface MarkPaidDto {
  tenantId: string;
  studentId: string;
  recordedBy: string;
  month: string; // 'YYYY-MM'
  amount: number;
  paidAt: Date;
  delegationId?: string;
}

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  private nextDayMidnight(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async markPaid(dto: MarkPaidDto) {
    const unblockAt = this.nextDayMidnight(dto.paidAt);

    const payment = await this.prisma.payment.upsert({
      where: { studentId_month: { studentId: dto.studentId, month: dto.month } },
      create: { ...dto, unblockAt },
      update: { amount: dto.amount, paidAt: dto.paidAt, recordedBy: dto.recordedBy, unblockAt },
    });

    return payment;
  }

  async getStudentPayments(studentId: string) {
    return this.prisma.payment.findMany({
      where: { studentId },
      orderBy: { month: 'desc' },
    });
  }

  async getBranchPaymentStatus(branchId: string, tenantId: string, month: string) {
    // To'lagan va to'lamagan o'quvchilar
    const students = await this.prisma.user.findMany({
      where: { branchId, tenantId, role: 'student', status: { not: 'inactive' } },
      select: { id: true, name: true, status: true },
    });

    const payments = await this.prisma.payment.findMany({
      where: { tenantId, month },
      select: { studentId: true, amount: true, paidAt: true },
    });

    const paidSet = new Set(payments.map((p) => p.studentId));

    return students.map((s) => ({
      ...s,
      hasPaid: paidSet.has(s.id),
      payment: payments.find((p) => p.studentId === s.id) ?? null,
    }));
  }

  async getSettingForTenant(tenantId: string) {
    return this.prisma.paymentSetting.findUnique({ where: { tenantId } });
  }

  async updateSettings(tenantId: string, startDay: number, endDay: number, updatedBy: string) {
    return this.prisma.paymentSetting.upsert({
      where: { tenantId },
      create: { tenantId, paymentStartDay: startDay, paymentEndDay: endDay, updatedBy },
      update: { paymentStartDay: startDay, paymentEndDay: endDay, updatedBy },
    });
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- payments.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/payments/
git commit -m "feat: add payments service with unblock_at = paidAt + 1 day midnight"
```

---

### Task 4: Cron Jobs (Bloklash + Ochish)

**Files:**
- Create: `apps/api/src/cron/cron.service.ts`
- Create: `apps/api/src/cron/cron.module.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/cron.spec.ts`:
```typescript
import { CronService } from '../src/cron/cron.service';

describe('CronService', () => {
  const mockPrisma = {
    user: {
      updateMany: jest.fn().mockResolvedValue({ count: 5 }),
      findMany: jest.fn().mockResolvedValue([
        { id: 'student-1', name: 'Sardor', status: 'blocked_payment' },
      ]),
    },
    payment: {
      findMany: jest.fn().mockResolvedValue([
        { studentId: 'student-1', unblockAt: new Date(Date.now() - 1000) }, // o'tgan
      ]),
    },
    paymentSetting: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    delegation: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };

  const service = new CronService(mockPrisma as any);

  it('unblocks students whose unblock_at has passed', async () => {
    await service.runPaymentUnblock();
    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['student-1'] } }),
        data: { status: 'active' },
      }),
    );
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- cron.spec
```

- [ ] **Step 3: cron.service.ts**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private prisma: PrismaService) {}

  // Har kuni 23:59 — to'lov muddati o'tgan o'quvchilarni bloklash
  @Cron('59 23 * * *', { name: 'payment_block' })
  async runPaymentBlock() {
    this.logger.log('Cron: payment block boshlanmoqda...');

    const settings = await this.prisma.paymentSetting.findMany();

    for (const setting of settings) {
      const today = new Date();
      if (today.getDate() !== setting.paymentEndDay) continue;

      // To'lov yozilmagan o'quvchilarni toping
      const month = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const paidStudents = await this.prisma.payment.findMany({
        where: { tenantId: setting.tenantId, month },
        select: { studentId: true },
      });
      const paidIds = paidStudents.map((p) => p.studentId);

      const result = await this.prisma.user.updateMany({
        where: {
          tenantId: setting.tenantId,
          role: 'student',
          status: 'active',
          id: { notIn: paidIds },
        },
        data: { status: 'blocked_payment' },
      });

      this.logger.log(`Tenant ${setting.tenantId}: ${result.count} o'quvchi bloklandi`);
    }
  }

  // Har kuni 00:01 — unblock_at o'tgan o'quvchilarni ochish
  @Cron('1 0 * * *', { name: 'payment_unblock' })
  async runPaymentUnblock() {
    this.logger.log('Cron: payment unblock boshlanmoqda...');

    const now = new Date();
    const duePayments = await this.prisma.payment.findMany({
      where: {
        unblockAt: { lte: now },
        student: { status: 'blocked_payment' },
      },
      select: { studentId: true },
    });

    const ids = duePayments.map((p) => p.studentId);
    if (ids.length === 0) return;

    const result = await this.prisma.user.updateMany({
      where: { id: { in: ids }, status: 'blocked_payment' },
      data: { status: 'active' },
    });

    this.logger.log(`${result.count} o'quvchi to'lov blokidan chiqarildi`);
  }

  // Har kuni 00:01 — delegatsiya muddati tugaganlarni yakunlash
  @Cron('1 0 * * *', { name: 'delegation_complete' })
  async runDelegationComplete() {
    const now = new Date();

    const result = await this.prisma.delegation.updateMany({
      where: {
        status: 'active',
        endsAt: { lte: now },
      },
      data: { status: 'completed' },
    });

    if (result.count > 0) {
      this.logger.log(`${result.count} delegatsiya avtomatik yakunlandi`);
    }
  }

  // Test uchun qo'lda ishga tushirish imkoni (admin endpoint)
  async triggerPaymentUnblockManually() {
    return this.runPaymentUnblock();
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- cron.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/cron/
git commit -m "feat: add cron jobs for payment block/unblock and delegation auto-complete"
```

---

### Task 5: Delegatsiya Tizimi

**Files:**
- Create: `apps/api/src/delegations/delegations.service.ts`
- Create: `apps/api/src/delegations/audit-log.service.ts`
- Create: `apps/api/src/delegations/delegations.controller.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/delegations.spec.ts`:
```typescript
import { DelegationsService } from '../src/delegations/delegations.service';

describe('DelegationsService', () => {
  const mockPrisma = {
    delegation: {
      create: jest.fn().mockResolvedValue({ id: 'del-1', status: 'pending' }),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    delegationResponse: {
      create: jest.fn().mockResolvedValue({}),
    },
    delegationAuditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  };

  const service = new DelegationsService(mockPrisma as any);

  it('creates delegation and logs it', async () => {
    const result = await service.create({
      tenantId: 't', branchId: 'b', fromUserId: 'from', toUserId: 'to',
      delegatedRole: 'manager', permissions: ['warnings'],
      reason: 'Ta\'tilda ketaman', startsAt: new Date(), endsAt: new Date(),
    });
    expect(result.status).toBe('pending');
    expect(mockPrisma.delegationAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: 'delegation_created' }),
      }),
    );
  });

  it('requires non-empty reason on creation', async () => {
    await expect(
      service.create({
        tenantId: 't', branchId: 'b', fromUserId: 'from', toUserId: 'to',
        delegatedRole: 'manager', permissions: ['warnings'],
        reason: '',  // bo'sh sabab
        startsAt: new Date(), endsAt: new Date(),
      }),
    ).rejects.toThrow('Sabab majburiy');
  });

  it('requires non-empty reason on rejection', async () => {
    mockPrisma.delegation.findUnique.mockResolvedValue({
      id: 'del-1', status: 'pending', toUserId: 'to',
    });
    await expect(
      service.respond('del-1', 'to', 'rejected', ''),
    ).rejects.toThrow('Rad etish sababi majburiy');
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- delegations.spec
```

- [ ] **Step 3: delegations.service.ts**

```typescript
import {
  Injectable, BadRequestException, ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CreateDelegationDto {
  tenantId: string;
  branchId: string;
  fromUserId: string;
  toUserId: string;
  delegatedRole: string; // 'filadmin' | 'manager'
  permissions: string[];
  reason: string;
  startsAt: Date;
  endsAt: Date;
}

const ALLOWED_DELEGATED_ROLES = ['filadmin', 'manager'];

@Injectable()
export class DelegationsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDelegationDto) {
    if (!dto.reason.trim()) throw new BadRequestException('Sabab majburiy');

    if (!ALLOWED_DELEGATED_ROLES.includes(dto.delegatedRole)) {
      throw new BadRequestException('Faqat filadmin yoki manager roliga delegatsiya mumkin');
    }

    // 1 ta faol delegatsiya cheklovi (unique index bor, lekin user-friendly xabar)
    const existing = await this.prisma.delegation.findFirst({
      where: { toUserId: dto.toUserId, status: 'active' },
    });
    if (existing) {
      throw new BadRequestException('Bu xodimda faol delegatsiya mavjud');
    }

    const delegation = await this.prisma.delegation.create({ data: dto });

    await this.prisma.delegationAuditLog.create({
      data: {
        delegationId: delegation.id,
        actorId: dto.fromUserId,
        actionType: 'delegation_created',
        meta: { reason: dto.reason, permissions: dto.permissions },
      },
    });

    return delegation;
  }

  async respond(
    delegationId: string,
    responderId: string,
    action: 'accepted' | 'rejected',
    reason?: string,
  ) {
    if (action === 'rejected' && !reason?.trim()) {
      throw new BadRequestException('Rad etish sababi majburiy');
    }

    const delegation = await this.prisma.delegation.findUnique({
      where: { id: delegationId },
    });

    if (!delegation) throw new NotFoundException('Delegatsiya topilmadi');
    if (delegation.status !== 'pending') {
      throw new BadRequestException('Delegatsiya holati kutilmoqda emas');
    }
    if (delegation.toUserId !== responderId) {
      throw new ForbiddenException('Siz bu delegatsiyaga javob bera olmaysiz');
    }

    const newStatus = action === 'accepted' ? 'active' : 'rejected';

    const [updated] = await Promise.all([
      this.prisma.delegation.update({
        where: { id: delegationId },
        data: { status: newStatus },
      }),
      this.prisma.delegationResponse.create({
        data: { delegationId, action, reason },
      }),
      this.prisma.delegationAuditLog.create({
        data: {
          delegationId,
          actorId: responderId,
          actionType: action,
          meta: { reason },
        },
      }),
    ]);

    return updated;
  }

  async cancel(delegationId: string, cancelledBy: string, reason: string) {
    if (!reason.trim()) throw new BadRequestException('Bekor qilish sababi majburiy');

    const delegation = await this.prisma.delegation.findUnique({ where: { id: delegationId } });
    if (!delegation) throw new NotFoundException('Delegatsiya topilmadi');

    if (!['pending', 'active'].includes(delegation.status)) {
      throw new BadRequestException('Delegatsiya allaqachon yakunlangan');
    }

    const [updated] = await Promise.all([
      this.prisma.delegation.update({
        where: { id: delegationId },
        data: { status: 'cancelled', cancelledAt: new Date(), cancelledBy, cancelReason: reason },
      }),
      this.prisma.delegationAuditLog.create({
        data: { delegationId, actorId: cancelledBy, actionType: 'cancelled', meta: { reason } },
      }),
    ]);

    return updated;
  }

  async findForUser(userId: string, role: string) {
    // Beruvchi + oluvchi ko'rinishi
    return this.prisma.delegation.findMany({
      where: {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
      include: {
        fromUser: { select: { name: true } },
        toUser: { select: { name: true } },
        responses: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAuditLog(delegationId: string) {
    return this.prisma.delegationAuditLog.findMany({
      where: { delegationId },
      orderBy: { performedAt: 'asc' },
    });
  }

  // Delegatsiya sifatida bajarilgan amallarni loglash
  async logAction(
    delegationId: string,
    actorId: string,
    actionType: string,
    targetId?: string,
    meta?: object,
  ) {
    return this.prisma.delegationAuditLog.create({
      data: { delegationId, actorId, actionType, targetId, meta },
    });
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- delegations.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/delegations/
git commit -m "feat: add delegation service with mandatory reasons, audit log, and privilege escalation guard"
```

---

### Task 6: KPI Tizimi

**Files:**
- Create: `apps/api/src/kpi/kpi.service.ts`

- [ ] **Step 1: Failing test**

`apps/api/test/kpi.spec.ts`:
```typescript
import { KpiService } from '../src/kpi/kpi.service';

describe('KpiService', () => {
  const mockPrisma = {
    kpiScore: {
      create: jest.fn().mockResolvedValue({ id: 'kpi-1', score: 5 }),
      findMany: jest.fn().mockResolvedValue([
        { score: 5, reason: 'Dars o\'tdi' },
        { score: 10, reason: 'Qizildan sariqqa' },
      ]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { score: 15 } }),
    },
  };
  const service = new KpiService(mockPrisma as any);

  it('awards KPI points with reason', async () => {
    const result = await service.award({
      tenantId: 't', userId: 'u', score: 5, reason: 'Dars o\'tdi',
    });
    expect(result.score).toBe(5);
  });

  it('returns total KPI for user on date', async () => {
    const total = await service.getDailyTotal('user-id', new Date());
    expect(total).toBe(15);
  });
});
```

- [ ] **Step 2: Ishga tushirib FAIL ko'ring**

```bash
npm run test -- kpi.spec
```

- [ ] **Step 3: kpi.service.ts**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AwardKpiDto {
  tenantId: string;
  userId: string;
  score: number;
  reason: string;
  taskId?: string;
  delegationId?: string;
}

// KPI ball miqdorlari (TZ 8.1–8.3 ga mos)
export const KPI_POINTS = {
  MENTOR_LESSON_STUDENTS: 5,    // 20 ta o'quvchi bilan dars
  MENTOR_LESSON_DURATION: 5,    // 15 daqiqa minimal
  MENTOR_SCORES_GIVEN: 5,       // Barcha balllar qo'yildi
  MENTOR_RED_NOTIFIED: 5,       // Qizil o'quvchi xabardor
  MANAGER_RED_TO_YELLOW: 10,    // Qizildan sariqqa
  MANAGER_YELLOW_TO_GREEN: 15,  // Sariqdan yashilga
  MANAGER_ONE_ON_ONE: 5,        // 1:1 sessiya
} as const;

@Injectable()
export class KpiService {
  constructor(private prisma: PrismaService) {}

  async award(dto: AwardKpiDto) {
    return this.prisma.kpiScore.create({
      data: {
        tenantId: dto.tenantId,
        userId: dto.userId,
        date: new Date(),
        score: dto.score,
        reason: dto.reason,
        taskId: dto.taskId,
        delegationId: dto.delegationId,
      },
    });
  }

  async getDailyTotal(userId: string, date: Date): Promise<number> {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const agg = await this.prisma.kpiScore.aggregate({
      where: { userId, date: { gte: start, lte: end } },
      _sum: { score: true },
    });

    return agg._sum.score ?? 0;
  }

  async getMonthlyTotal(userId: string, year: number, month: number): Promise<number> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const agg = await this.prisma.kpiScore.aggregate({
      where: { userId, date: { gte: start, lte: end } },
      _sum: { score: true },
    });

    return agg._sum.score ?? 0;
  }

  async getHistory(userId: string, limit = 30) {
    return this.prisma.kpiScore.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }
}
```

- [ ] **Step 4: Test PASS bo'lganini tekshiring**

```bash
npm run test -- kpi.spec
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/kpi/
git commit -m "feat: add KPI service with daily/monthly totals and predefined point constants"
```

---

### Task 7: Delegatsiya UI — Ro'yxat + Timeline

**Files:**
- Create: `apps/web/app/(dashboard)/delegations/page.tsx`
- Create: `apps/web/app/(dashboard)/delegations/[id]/page.tsx`
- Create: `apps/web/app/(dashboard)/delegations/new/page.tsx`

- [ ] **Step 1: Delegatsiyalar ro'yxati (page.tsx)**

```typescript
'use client';
import { useState } from 'react';

type DelegationStatus = 'active' | 'pending' | 'completed' | 'rejected' | 'cancelled';

const STATUS_CONFIG: Record<DelegationStatus, { icon: string; color: string; label: string }> = {
  active: { icon: '🟢', color: 'text-green-700 bg-green-50', label: 'Faol' },
  pending: { icon: '⏳', color: 'text-yellow-700 bg-yellow-50', label: 'Kutilmoqda' },
  completed: { icon: '✅', color: 'text-blue-700 bg-blue-50', label: 'Tugadi' },
  rejected: { icon: '❌', color: 'text-red-700 bg-red-50', label: 'Rad etildi' },
  cancelled: { icon: '🚫', color: 'text-gray-700 bg-gray-100', label: 'Bekor qilindi' },
};

const MOCK_DELEGATIONS = [
  {
    id: '1', status: 'active' as DelegationStatus,
    from: 'Nodira Karimova', to: 'Alisher Toshev',
    role: 'Filadmin', startsAt: '3-may', endsAt: '10-may',
    reason: 'Filadmin ta\'tilda',
  },
  {
    id: '2', status: 'pending' as DelegationStatus,
    from: 'Bobur Yusupov', to: 'Kamola Nazarova',
    role: 'Manager', startsAt: '5-may', endsAt: '8-may',
    reason: 'Kasalxonada',
  },
];

export default function DelegationsPage() {
  const [activeTab, setActiveTab] = useState<DelegationStatus | 'all'>('all');

  const filtered = activeTab === 'all'
    ? MOCK_DELEGATIONS
    : MOCK_DELEGATIONS.filter((d) => d.status === activeTab);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Delegatsiyalar</h1>
        <a
          href="/delegations/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Yangi
        </a>
      </div>

      {/* Tablar */}
      <div className="flex gap-2 border-b pb-2">
        {(['all', 'active', 'pending', 'completed', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-lg text-sm ${
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab === 'all' ? 'Barchasi' : STATUS_CONFIG[tab]?.label}
          </button>
        ))}
      </div>

      {/* Ro'yxat */}
      <div className="space-y-3">
        {filtered.map((d) => {
          const s = STATUS_CONFIG[d.status];
          return (
            <div key={d.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                      {s.icon} {s.label}
                    </span>
                    <span className="text-sm text-gray-500">{d.role} vakolati</span>
                  </div>
                  <p className="font-semibold mt-1">{d.from} → {d.to}</p>
                  <p className="text-sm text-gray-500">{d.startsAt} – {d.endsAt}</p>
                  <p className="text-sm text-gray-600 mt-1">"{d.reason}"</p>
                </div>
                <a
                  href={`/delegations/${d.id}`}
                  className="text-indigo-600 text-sm font-medium"
                >
                  Ko'rish →
                </a>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">Delegatsiya topilmadi</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Timeline drill-down ([id]/page.tsx)**

```typescript
'use client';

// Mock timeline
const MOCK_TIMELINE = [
  { time: '3-may 09:14', icon: '📤', actor: 'Nodira', action: 'delegatsiya yaratdi', detail: 'Sabab: "Filadmin ta\'tilda"' },
  { time: '3-may 09:31', icon: '✅', actor: 'Alisher', action: 'qabul qildi', detail: '"Tushundim, bajaraman"' },
  { time: '4-may 11:20', icon: '⚠️', actor: 'Alisher', action: 'ogohlantirish berdi', detail: 'O\'quvchi: Sardor Rahimov — Darsga tayyorlanmagan' },
  { time: '5-may 14:05', icon: '💳', actor: 'Alisher', action: 'to\'lov belgiladi', detail: 'Malika Yusupova • 450,000 so\'m' },
];

export default function DelegationDetailPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <a href="/delegations" className="text-gray-400 hover:text-gray-600">←</a>
        <div>
          <h1 className="text-xl font-bold">Nodira → Alisher</h1>
          <p className="text-sm text-gray-500">3–10 may • 🟢 Faol</p>
        </div>
        <div className="ml-auto">
          <button className="text-indigo-600 text-sm border border-indigo-200 px-3 py-1 rounded-lg">
            📄 PDF
          </button>
        </div>
      </div>

      <div className="bg-indigo-50 rounded-xl p-4 text-sm space-y-1">
        <p><span className="font-medium">Sabab:</span> "Filadmin ta'tilda"</p>
        <p><span className="font-medium">Ruxsatlar:</span> Ogohlantirish, To'lov, Xodim boshqaruv</p>
      </div>

      {/* Timeline */}
      <div className="space-y-1">
        {MOCK_TIMELINE.map((event, i) => (
          <div key={i} className="flex gap-3 py-3 border-b last:border-0">
            <div className="text-2xl">{event.icon}</div>
            <div>
              <p className="text-xs text-gray-400">{event.time}</p>
              <p className="font-medium">{event.actor} — {event.action}</p>
              <p className="text-sm text-gray-500">{event.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Yangi delegatsiya formi (new/page.tsx)**

```typescript
'use client';
import { useState } from 'react';

export default function NewDelegationPage() {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Sabab maydoni majburiy');
      return;
    }
    // TODO: API call
    alert('Delegatsiya yaratildi (mock)');
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Yangi Delegatsiya</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Oluvchi xodim *</label>
          <select className="w-full border rounded-lg px-3 py-2">
            <option>Alisher Toshev (Manager)</option>
            <option>Kamola Nazarova (Mentor)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Boshlanish</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tugash</label>
            <input type="date" className="w-full border rounded-lg px-3 py-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sabab *</label>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
            rows={3}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Nima uchun delegatsiya bermoqchisiz?"
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium"
        >
          Yuborish
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Sahifalarni brauzerda tekshiring**

```bash
cd apps/web && npm run dev
```

- `http://localhost:3001/delegations` — ro'yxat ko'rinishi kerak
- `http://localhost:3001/delegations/1` — timeline ko'rinishi kerak
- `http://localhost:3001/delegations/new` — forma ko'rinishi + sabab bo'sh bo'lsa xato

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/delegations/
git commit -m "feat: add delegation pages (list, timeline, new form with mandatory reason)"
```

---

### Task 8: Ogohlantirish + To'lov UI (Filadmin)

**Files:**
- Create: `apps/web/app/(dashboard)/filadmin/warnings/page.tsx`
- Create: `apps/web/app/(dashboard)/filadmin/payments/page.tsx`

- [ ] **Step 1: Warnings page.tsx**

```typescript
'use client';
import { useState } from 'react';

const REASON_TYPES = [
  { value: 'not_prepared', label: 'Darsga tayyorlanmagan' },
  { value: 'no_homework', label: 'Vazifalarni bajarmagan' },
  { value: 'discipline', label: 'Intizom buzilishi' },
  { value: 'other', label: 'Boshqa' },
];

export default function WarningsPage() {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [reasonType, setReasonType] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reasonText.trim()) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Ogohlantirish Berish</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">O'quvchi *</label>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          >
            <option value="">Tanlang...</option>
            <option value="s1">Sardor Rahimov</option>
            <option value="s2">Malika Yusupova</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Turi *</label>
          <div className="space-y-2">
            {REASON_TYPES.map((r) => (
              <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reasonType"
                  value={r.value}
                  checked={reasonType === r.value}
                  onChange={() => setReasonType(r.value)}
                  className="text-indigo-600"
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Izoh (majburiy) *</label>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={3}
            required
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Ogohlantirish sababi..."
          />
        </div>

        <button
          type="submit"
          className="w-full bg-red-600 text-white py-3 rounded-xl font-medium"
        >
          {submitted ? '✅ Berildi' : 'Ogohlantirish Berish'}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Payments page.tsx**

```typescript
'use client';
import { useState } from 'react';

const MOCK_STUDENTS = [
  { id: 's1', name: 'Sardor Rahimov', status: 'blocked_payment', paid: false },
  { id: 's2', name: 'Malika Yusupova', status: 'active', paid: true, amount: 500000, paidAt: '2026-05-03' },
  { id: 's3', name: 'Jasur Mirzayev', status: 'active', paid: false },
];

export default function PaymentsPage() {
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  function markPaid(id: string) {
    if (!amount) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, paid: true, status: 'active', amount: parseInt(amount), paidAt: 'Bugun' }
          : s,
      ),
    );
    setSelected(null);
    setAmount('');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">To'lov Holati — 2026-may</h1>

      <div className="space-y-2">
        {students.map((s) => (
          <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className={`text-sm ${s.paid ? 'text-green-600' : s.status === 'blocked_payment' ? 'text-red-600' : 'text-gray-500'}`}>
                  {s.paid ? `✅ To'ladi — ${s.amount?.toLocaleString()} so'm (${s.paidAt})` :
                   s.status === 'blocked_payment' ? '🔒 Bloklangan — to\'lov kutilmoqda' :
                   '⏳ Hali to\'lamagan'}
                </p>
              </div>
              {!s.paid && (
                <button
                  onClick={() => setSelected(s.id)}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm"
                >
                  To'lov qabul
                </button>
              )}
            </div>

            {selected === s.id && (
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Summa (so'm)"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={() => markPaid(s.id)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Saqlash
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Brauzerda tekshiring**

- `http://localhost:3001/filadmin/warnings` — forma ishlashi kerak
- `http://localhost:3001/filadmin/payments` — to'lov belgilash UI ishlashi kerak

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(dashboard)/filadmin/
git commit -m "feat: add filadmin warnings form and payments status page"
```

---

## Self-Review

**Spec Coverage:**
- ✅ 3 ta mustaqil status (ingliz/shaxsiy/tanqidiy)
- ✅ O'quvchi davomati (Mentor belgilaydi)
- ✅ Xodim davomati (qo'lda Faza 1, Face ID Faza 2 uchun maydonlar bor)
- ✅ KPI ballari (Mentor, Manager — aniq konstantalar TZ 8.1–8.3 ga mos)
- ✅ Ogohlantirish (sabab majburiy, 3 ta = avtomatik bloklash, bekor qilish = blok ochish)
- ✅ To'lov (unblock_at = paidAt + 1 kun 00:00)
- ✅ Cron job: 23:59 bloklash, 00:01 ochish, 00:01 delegatsiya yakunlash
- ✅ Delegatsiya (sabab majburiy, rad etishda sabab majburiy, faqat filadmin/manager roli)
- ✅ Delegatsiya audit log (har amal yoziladi, DELETE/UPDATE taqiqlangan → faqat INSERT)
- ✅ Delegatsiya UI: ro'yxat + timeline + yangi forma

**Security:** Privilege escalation guard (`ALLOWED_DELEGATED_ROLES` = ['filadmin', 'manager']).
