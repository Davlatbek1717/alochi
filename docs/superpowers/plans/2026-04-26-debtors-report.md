# Debtors Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a monthly payment debtors report for filadmin (record + view), manager (read-only), and superadmin (branch summary cards + drill-down) with a filterable/sortable table and month picker.

**Architecture:** New `GET /payments/summary` backend endpoint returns per-branch payment aggregates for superadmin. Two shared React components (`MonthPicker`, `DebtorsTable`) handle all three frontend roles. Existing `GET /payments/branch/:branchId?month=` is reused by filadmin and manager pages; superadmin detail page uses the same endpoint after adding `superadmin` to its role guard.

**Tech Stack:** NestJS + Prisma (backend), Next.js 14 App Router + Tailwind (frontend), Jest (backend tests only — no frontend test setup exists in this repo).

---

## Background

### ResponseInterceptor
Every API response is wrapped by a global NestJS interceptor:
```ts
{ success: true, data: T, meta: { timestamp: string } }
```
So `apiRequest<T>(...)` always returns `{ data: T }`. Access payload via `.data`.

### JWT payload in localStorage
All pages read user info from `localStorage.getItem('user')` — always wrap in try/catch:
```ts
let branchId = '';
try {
  const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
  branchId = user.branchId ?? '';
} catch { /* branchId stays empty */ }
```

### Existing payment endpoints
- `POST /payments` — filadmin only, records a payment
- `GET /payments/branch/:branchId?month=YYYY-MM` — filadmin + manager; returns `BranchStudent[]`
- `GET /payments/student/:studentId` — filadmin + manager; not used in this feature

### Prisma models
- `Branch`: `{ id, tenantId, name }` (table: `branches`)
- `User`: has `branchId`, `tenantId`, `role`, `status`
- `Payment`: `{ id, tenantId, studentId, month, amount, paidAt, unblockAt }`

---

## File Structure

**Backend — modify:**
- `apps/api/src/payments/payments.service.ts` — add `getBranchSummary` method, add `BranchPaymentSummary` interface
- `apps/api/src/payments/payments.controller.ts` — add `GET /payments/summary` route; add `superadmin` to `GET /payments/branch/:branchId` roles
- `apps/api/src/payments/payments.spec.ts` — add `branch` to mockPrisma; add `getBranchSummary` tests

**Frontend — create:**
- `apps/web/app/(dashboard)/_components/MonthPicker.tsx` — `<input type="month">` with max=currentMonth
- `apps/web/app/(dashboard)/_components/DebtorsTable.tsx` — filterable+sortable table, inline pay form
- `apps/web/app/(dashboard)/manager/payments/page.tsx` — read-only payments view for manager
- `apps/web/app/(dashboard)/superadmin/payments/page.tsx` — branch summary cards for superadmin
- `apps/web/app/(dashboard)/superadmin/payments/[branchId]/page.tsx` — branch detail table for superadmin

**Frontend — modify:**
- `apps/web/app/(dashboard)/filadmin/payments/page.tsx` — replace mock data with real API + MonthPicker + DebtorsTable
- `apps/web/app/(dashboard)/_components/BottomNav.tsx` — add payments tabs for manager and superadmin
- `apps/web/app/(dashboard)/superadmin/page.tsx` — add payments navigation card

---

## Task 1: Backend — getBranchSummary endpoint

**Files:**
- Modify: `apps/api/src/payments/payments.spec.ts`
- Modify: `apps/api/src/payments/payments.service.ts`
- Modify: `apps/api/src/payments/payments.controller.ts`

- [ ] **Step 1: Add `branch` to mockPrisma and write failing tests**

Open `apps/api/src/payments/payments.spec.ts`. Replace the `mockPrisma` constant (lines 5–17) and add the `getBranchSummary` describe block at the end, before the closing `});`:

```ts
const mockPrisma = {
  payment: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
  },
  paymentSetting: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  branch: {
    findMany: jest.fn(),
  },
};
```

Add this describe block at the end of the outer `describe('PaymentsService', ...)` (before its closing `}`):

```ts
  describe('getBranchSummary', () => {
    it('returns per-branch totals for paid, unpaid, and blocked students', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([
        { id: 'b1', name: 'Toshkent' },
        { id: 'b2', name: 'Samarqand' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 's1', branchId: 'b1', status: 'active' },
        { id: 's2', branchId: 'b1', status: 'blocked_payment' },
        { id: 's3', branchId: 'b1', status: 'active' },
        { id: 's4', branchId: 'b2', status: 'active' },
      ]);
      mockPrisma.payment.findMany.mockResolvedValue([
        { studentId: 's1', amount: 500000 },
        { studentId: 's4', amount: 600000 },
      ]);

      const result = await service.getBranchSummary('t1', '2026-04');

      expect(result).toHaveLength(2);

      const b1 = result.find((r) => r.branchId === 'b1')!;
      expect(b1.branchName).toBe('Toshkent');
      expect(b1.total).toBe(3);
      expect(b1.paid).toBe(1);
      expect(b1.blocked).toBe(1);
      expect(b1.unpaid).toBe(1);
      expect(b1.totalCollected).toBe(500000);

      const b2 = result.find((r) => r.branchId === 'b2')!;
      expect(b2.paid).toBe(1);
      expect(b2.totalCollected).toBe(600000);
    });

    it('returns zero counts for a branch with no students', async () => {
      mockPrisma.branch.findMany.mockResolvedValue([{ id: 'b1', name: 'Empty Branch' }]);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.payment.findMany.mockResolvedValue([]);

      const result = await service.getBranchSummary('t1', '2026-04');

      expect(result[0].total).toBe(0);
      expect(result[0].paid).toBe(0);
      expect(result[0].totalCollected).toBe(0);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api && npx jest payments.spec --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `service.getBranchSummary is not a function`

- [ ] **Step 3: Implement `getBranchSummary` in service**

Add the interface and method to `apps/api/src/payments/payments.service.ts`. Add the interface after `MarkPaidDto` (after line 12), and add the method after `updateSettings`:

```ts
interface BranchPaymentSummary {
  branchId: string;
  branchName: string;
  total: number;
  paid: number;
  unpaid: number;
  blocked: number;
  totalCollected: number;
}
```

```ts
  async getBranchSummary(tenantId: string, month: string): Promise<BranchPaymentSummary[]> {
    const branches = await this.prisma.branch.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });

    const students = await this.prisma.user.findMany({
      where: { tenantId, role: 'student', status: { not: 'inactive' } },
      select: { id: true, branchId: true, status: true },
    });

    const payments = await this.prisma.payment.findMany({
      where: { tenantId, month },
      select: { studentId: true, amount: true },
    });

    const paymentMap = new Map(payments.map((p) => [p.studentId, p.amount]));

    return branches.map((branch) => {
      const branchStudents = students.filter((s) => s.branchId === branch.id);
      const paidStudents = branchStudents.filter((s) => paymentMap.has(s.id));
      const blockedStudents = branchStudents.filter((s) => s.status === 'blocked_payment');
      const unpaidStudents = branchStudents.filter(
        (s) => !paymentMap.has(s.id) && s.status !== 'blocked_payment',
      );
      const totalCollected = paidStudents.reduce(
        (sum, s) => sum + (paymentMap.get(s.id) ?? 0),
        0,
      );

      return {
        branchId: branch.id,
        branchName: branch.name,
        total: branchStudents.length,
        paid: paidStudents.length,
        unpaid: unpaidStudents.length,
        blocked: blockedStudents.length,
        totalCollected,
      };
    });
  }
```

- [ ] **Step 4: Add controller routes**

In `apps/api/src/payments/payments.controller.ts`:

1. Update the `@Roles` decorator on `getBranchStatus` to also allow `superadmin`:

```ts
  @Get('branch/:branchId')
  @Roles(UserRole.filadmin, UserRole.manager, UserRole.superadmin)
  getBranchStatus(
    @Param('branchId') branchId: string,
    @Query('month') month: string,
    @Request() req: any,
  ) {
    return this.payments.getBranchPaymentStatus(branchId, req.user.tenantId, month);
  }
```

2. Add the new summary endpoint after `getBranchStatus`:

```ts
  @Get('summary')
  @Roles(UserRole.superadmin)
  getBranchSummary(
    @Query('month') month: string,
    @Request() req: any,
  ) {
    return this.payments.getBranchSummary(req.user.tenantId, month);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && npx jest payments.spec --no-coverage 2>&1 | tail -20
```

Expected: All tests PASS (the 2 new + existing 4 = 6 total)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/payments/payments.service.ts apps/api/src/payments/payments.controller.ts apps/api/src/payments/payments.spec.ts
git commit -m "feat: add getBranchSummary endpoint and superadmin access to branch payments"
```

---

## Task 2: Shared frontend components

**Files:**
- Create: `apps/web/app/(dashboard)/_components/MonthPicker.tsx`
- Create: `apps/web/app/(dashboard)/_components/DebtorsTable.tsx`

- [ ] **Step 1: Create MonthPicker**

Create `apps/web/app/(dashboard)/_components/MonthPicker.tsx`:

```tsx
interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
}

export default function MonthPicker({ value, onChange }: MonthPickerProps) {
  const max = new Date().toISOString().slice(0, 7);
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-600">Oy:</label>
      <input
        type="month"
        value={value}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />
    </div>
  );
}
```

- [ ] **Step 2: Create DebtorsTable**

Create `apps/web/app/(dashboard)/_components/DebtorsTable.tsx`:

```tsx
'use client';
import { useState } from 'react';

export interface BranchStudent {
  id: string;
  name: string;
  status: string;
  hasPaid: boolean;
  payment: { amount: number; paidAt: string } | null;
}

interface DebtorsTableProps {
  students: BranchStudent[];
  readOnly: boolean;
  onMarkPaid?: (studentId: string, amount: number) => Promise<void>;
  loading: boolean;
}

type FilterTab = 'all' | 'unpaid' | 'blocked';
type SortDir = 'asc' | 'desc' | null;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'unpaid', label: "To'lamagan" },
  { key: 'blocked', label: 'Bloklangan' },
];

export default function DebtorsTable({ students, readOnly, onMarkPaid, loading }: DebtorsTableProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const filtered = students.filter((s) => {
    if (filter === 'unpaid') return !s.hasPaid && s.status !== 'blocked_payment';
    if (filter === 'blocked') return s.status === 'blocked_payment';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortDir) return 0;
    const aAmt = a.payment?.amount ?? -1;
    const bAmt = b.payment?.amount ?? -1;
    return sortDir === 'asc' ? aAmt - bAmt : bAmt - aAmt;
  });

  async function handlePay(studentId: string) {
    const val = parseInt(amountInput);
    if (!Number.isFinite(val) || val <= 0) {
      setPayError("To'g'ri summa kiriting");
      return;
    }
    setPayError('');
    setPaying(true);
    try {
      await onMarkPaid?.(studentId, val);
      setSelectedId(null);
      setAmountInput('');
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "To'lovda xatolik");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="divide-y">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4 animate-pulse">
            <div className="space-y-2">
              <div className="h-4 w-36 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 px-5 py-3 border-b border-gray-100 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))}
          className="ml-auto px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          Summa {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="px-5 py-8 text-sm text-center text-gray-400">Qarzdorlar topilmadi</p>
      ) : (
        <div className="divide-y">
          {sorted.map((s) => (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p
                    className={`text-sm ${
                      s.hasPaid
                        ? 'text-green-600'
                        : s.status === 'blocked_payment'
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {s.hasPaid
                      ? `✅ ${s.payment!.amount.toLocaleString()} so'm · ${s.payment!.paidAt.slice(0, 10)}`
                      : s.status === 'blocked_payment'
                      ? '🔒 Bloklangan'
                      : "⏳ Hali to'lamagan"}
                  </p>
                </div>
                {!readOnly && !s.hasPaid && (
                  <button
                    onClick={() => {
                      setSelectedId(s.id);
                      setAmountInput('');
                      setPayError('');
                    }}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 shrink-0"
                  >
                    To&apos;lov qabul
                  </button>
                )}
              </div>
              {selectedId === s.id && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="Summa (so'm)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handlePay(s.id)}
                      disabled={paying}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      {paying ? '...' : 'Saqlash'}
                    </button>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100"
                    >
                      ✕
                    </button>
                  </div>
                  {payError && <p className="text-red-500 text-sm">{payError}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/_components/MonthPicker.tsx apps/web/app/\(dashboard\)/_components/DebtorsTable.tsx
git commit -m "feat: add MonthPicker and DebtorsTable shared components"
```

---

## Task 3: Filadmin payments page — real API

**Files:**
- Modify (replace): `apps/web/app/(dashboard)/filadmin/payments/page.tsx`

- [ ] **Step 1: Replace filadmin payments page**

Overwrite `apps/web/app/(dashboard)/filadmin/payments/page.tsx` with:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../_components/MonthPicker';
import DebtorsTable, { BranchStudent } from '../../_components/DebtorsTable';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getBranchAndToken(): { branchId: string; token: string } {
  const token = localStorage.getItem('accessToken') ?? '';
  let branchId = '';
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
    branchId = user.branchId ?? '';
  } catch {
    // branchId stays empty
  }
  return { branchId, token };
}

export default function FiladminPaymentsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [students, setStudents] = useState<BranchStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  async function fetchStudents(selectedMonth: string) {
    const { branchId, token } = getBranchAndToken();
    if (!branchId) {
      setError('Filial biriktirilmagan');
      setLoading(false);
      return;
    }
    setFetching(true);
    try {
      const res = await apiRequest<BranchStudent[]>(
        `/payments/branch/${branchId}?month=${selectedMonth}`,
        {},
        token,
      );
      setStudents(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchStudents(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchStudents(m);
  }

  async function handleMarkPaid(studentId: string, amount: number) {
    const { token } = getBranchAndToken();
    let tenantId = '';
    let recordedBy = '';
    try {
      const user = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        tenantId?: string;
        id?: string;
      };
      tenantId = user.tenantId ?? '';
      recordedBy = user.id ?? '';
    } catch {
      // keep empty
    }
    await apiRequest(
      '/payments',
      {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          studentId,
          recordedBy,
          month,
          amount,
          paidAt: new Date().toISOString(),
        }),
      },
      token,
    );
    await fetchStudents(month);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">To&apos;lov Holati</h1>
        <MonthPicker value={month} onChange={handleMonthChange} />
      </div>

      {error ? (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => fetchStudents(month)}
            className="mt-2 text-sm text-indigo-600 hover:underline"
          >
            Qayta urinish
          </button>
        </div>
      ) : (
        <div
          className={`bg-white rounded-xl shadow-sm overflow-hidden transition-opacity ${fetching ? 'opacity-50' : ''}`}
        >
          <DebtorsTable
            students={students}
            readOnly={false}
            onMarkPaid={handleMarkPaid}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/\(dashboard\)/filadmin/payments/page.tsx
git commit -m "feat: connect filadmin payments page to real API with month picker"
```

---

## Task 4: Manager payments page + nav

**Files:**
- Create: `apps/web/app/(dashboard)/manager/payments/page.tsx`
- Modify: `apps/web/app/(dashboard)/_components/BottomNav.tsx`

- [ ] **Step 1: Create manager payments page**

Create `apps/web/app/(dashboard)/manager/payments/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../_components/MonthPicker';
import DebtorsTable, { BranchStudent } from '../../_components/DebtorsTable';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getBranchAndToken(): { branchId: string; token: string } {
  const token = localStorage.getItem('accessToken') ?? '';
  let branchId = '';
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
    branchId = user.branchId ?? '';
  } catch {
    // branchId stays empty
  }
  return { branchId, token };
}

export default function ManagerPaymentsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [students, setStudents] = useState<BranchStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  async function fetchStudents(selectedMonth: string) {
    const { branchId, token } = getBranchAndToken();
    if (!branchId) {
      setError('Filial biriktirilmagan');
      setLoading(false);
      return;
    }
    setFetching(true);
    try {
      const res = await apiRequest<BranchStudent[]>(
        `/payments/branch/${branchId}?month=${selectedMonth}`,
        {},
        token,
      );
      setStudents(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchStudents(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchStudents(m);
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link
        href="/manager"
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
      >
        &larr; Orqaga
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">To&apos;lov Holati</h1>
        <MonthPicker value={month} onChange={handleMonthChange} />
      </div>

      {error ? (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => fetchStudents(month)}
            className="mt-2 text-sm text-indigo-600 hover:underline"
          >
            Qayta urinish
          </button>
        </div>
      ) : (
        <div
          className={`bg-white rounded-xl shadow-sm overflow-hidden transition-opacity ${fetching ? 'opacity-50' : ''}`}
        >
          <DebtorsTable
            students={students}
            readOnly={true}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add manager payments tab to BottomNav**

In `apps/web/app/(dashboard)/_components/BottomNav.tsx`, find the `manager` array (lines 23–27) and add the payments tab:

```ts
  manager: [
    { href: '/manager',             icon: '🏠', label: 'Bosh'        },
    { href: '/manager/students',    icon: '👥', label: "O'quvchilar" },
    { href: '/manager/payments',    icon: '💰', label: "To'lovlar"   },
    { href: '/manager/delegations', icon: '📋', label: 'Delegatsiya' },
  ],
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/manager/payments/page.tsx apps/web/app/\(dashboard\)/_components/BottomNav.tsx
git commit -m "feat: add manager payments read-only page and nav tab"
```

---

## Task 5: Superadmin payments pages + nav

**Files:**
- Create: `apps/web/app/(dashboard)/superadmin/payments/page.tsx`
- Create: `apps/web/app/(dashboard)/superadmin/payments/[branchId]/page.tsx`
- Modify: `apps/web/app/(dashboard)/_components/BottomNav.tsx`
- Modify: `apps/web/app/(dashboard)/superadmin/page.tsx`

- [ ] **Step 1: Create superadmin payments summary page**

Create `apps/web/app/(dashboard)/superadmin/payments/page.tsx`:

```tsx
'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../_components/MonthPicker';

interface BranchPaymentSummary {
  branchId: string;
  branchName: string;
  total: number;
  paid: number;
  unpaid: number;
  blocked: number;
  totalCollected: number;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function BranchCard({ summary, month }: { summary: BranchPaymentSummary; month: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/superadmin/payments/${summary.branchId}?month=${month}`)}
      className="bg-white rounded-xl shadow-sm p-5 text-left hover:shadow-md transition-shadow w-full"
    >
      <h3 className="font-semibold text-gray-900 mb-2">{summary.branchName}</h3>
      {summary.total === 0 ? (
        <p className="text-sm text-gray-400">O&apos;quvchilar yo&apos;q</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-2">{summary.total} o&apos;quvchi</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm mb-3">
            <span className="text-green-600">✅ {summary.paid} to&apos;lagan</span>
            <span className="text-gray-600">❌ {summary.unpaid} qarzdor</span>
            <span className="text-red-600">🔒 {summary.blocked} bloklangan</span>
          </div>
          <p className="text-sm font-medium text-indigo-600">
            Yig&apos;ilgan: {summary.totalCollected.toLocaleString()} so&apos;m
          </p>
        </>
      )}
    </button>
  );
}

function SuperadminPaymentsContent() {
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get('month') ?? currentMonth());
  const [summaries, setSummaries] = useState<BranchPaymentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  async function fetchSummary(selectedMonth: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setFetching(true);
    try {
      const res = await apiRequest<BranchPaymentSummary[]>(
        `/payments/summary?month=${selectedMonth}`,
        {},
        token,
      );
      setSummaries(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchSummary(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchSummary(m);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">To&apos;lov Hisoboti</h1>
        <MonthPicker value={month} onChange={handleMonthChange} />
      </div>

      {error ? (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => fetchSummary(month)}
            className="mt-2 text-sm text-indigo-600 hover:underline"
          >
            Qayta urinish
          </button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-5 animate-pulse">
              <div className="h-5 w-32 bg-gray-200 rounded mb-3" />
              <div className="h-4 w-20 bg-gray-100 rounded mb-2" />
              <div className="h-4 w-40 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <p className="text-gray-400 text-sm">Filiallar topilmadi</p>
      ) : (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity ${fetching ? 'opacity-50' : ''}`}
        >
          {summaries.map((s) => (
            <BranchCard key={s.branchId} summary={s} month={month} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuperadminPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <SuperadminPaymentsContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Create superadmin branch detail page**

Create directory `apps/web/app/(dashboard)/superadmin/payments/[branchId]/` and file `page.tsx`:

```tsx
'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../../_components/MonthPicker';
import DebtorsTable, { BranchStudent } from '../../../_components/DebtorsTable';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function BranchDetailContent() {
  const { branchId } = useParams<{ branchId: string }>();
  const searchParams = useSearchParams();
  const [month, setMonth] = useState(searchParams.get('month') ?? currentMonth());
  const [students, setStudents] = useState<BranchStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  async function fetchStudents(selectedMonth: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setFetching(true);
    try {
      const res = await apiRequest<BranchStudent[]>(
        `/payments/branch/${branchId}?month=${selectedMonth}`,
        {},
        token,
      );
      setStudents(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchStudents(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchStudents(m);
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <Link
        href={`/superadmin/payments?month=${month}`}
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
      >
        &larr; Orqaga
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Filial To&apos;lovlari</h1>
        <MonthPicker value={month} onChange={handleMonthChange} />
      </div>

      {error ? (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <p className="text-red-500 text-sm">{error}</p>
          <button
            onClick={() => fetchStudents(month)}
            className="mt-2 text-sm text-indigo-600 hover:underline"
          >
            Qayta urinish
          </button>
        </div>
      ) : (
        <div
          className={`bg-white rounded-xl shadow-sm overflow-hidden transition-opacity ${fetching ? 'opacity-50' : ''}`}
        >
          <DebtorsTable students={students} readOnly={true} loading={loading} />
        </div>
      )}
    </div>
  );
}

export default function SuperadminBranchPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <BranchDetailContent />
    </Suspense>
  );
}
```

- [ ] **Step 3: Add superadmin payments tab to BottomNav**

In `apps/web/app/(dashboard)/_components/BottomNav.tsx`, find the `superadmin` array (lines 34–38) and add the payments tab:

```ts
  superadmin: [
    { href: '/superadmin',          icon: '🏠', label: 'Bosh'             },
    { href: '/superadmin/payments', icon: '💰', label: "To'lovlar"        },
    { href: '/superadmin/branches', icon: '🏢', label: 'Filiallar'        },
    { href: '/superadmin/users',    icon: '👤', label: 'Foydalanuvchilar' },
  ],
```

- [ ] **Step 4: Add payments card to superadmin dashboard**

In `apps/web/app/(dashboard)/superadmin/page.tsx`, add a payments card after the lessons card (after line 17, before the second `<div className="bg-white...`):

```tsx
        <Link
          href="/superadmin/payments"
          className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border border-transparent hover:border-indigo-200"
        >
          <div className="text-3xl mb-2">💰</div>
          <h2 className="font-semibold text-gray-900">To&apos;lovlar</h2>
          <p className="text-sm text-gray-500 mt-1">Qarzdorlar hisoboti, filial statistikasi</p>
        </Link>
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/superadmin/payments/ apps/web/app/\(dashboard\)/_components/BottomNav.tsx apps/web/app/\(dashboard\)/superadmin/page.tsx
git commit -m "feat: add superadmin payments summary and branch detail pages"
```

---

## Verification

After all tasks:

```bash
cd apps/api && npx jest payments.spec --no-coverage
```

Expected output:
```
PASS src/payments/payments.spec.ts
  PaymentsService
    markPaid ✓ (2 tests)
    getStudentPayments ✓ (1 test)
    getBranchPaymentStatus ✓ (1 test)
    updateSettings ✓ (1 test)
    getBranchSummary ✓ (2 tests)

Tests: 7 passed, 7 total
```

Manual smoke test:
- Filadmin: `/filadmin/payments` → shows real students, month picker works, "To'lov qabul" records payment
- Manager: `/manager/payments` → shows students, no payment button visible
- Superadmin: `/superadmin/payments` → branch cards with statistics; click card → branch detail table
