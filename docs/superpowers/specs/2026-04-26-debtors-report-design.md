# Qarzdorlar Hisoboti (Debtors Report) — Design Spec

## Overview

A payment debtors report feature across three roles: filadmin, manager, and superadmin. Filadmin and manager see their branch's payment status for any selected month with a filterable, sortable table. Superadmin sees branch-level summary cards for any selected month, with drill-down into individual branches.

---

## Roles and Access

| Role | Page | Capabilities |
|------|------|-------------|
| `filadmin` | `/filadmin/payments` | View + record payments, filter/sort table, month picker |
| `manager` | `/manager/payments` | View only (read-only table), filter/sort, month picker |
| `superadmin` | `/superadmin/payments` | Branch summary cards + month picker; click card → branch detail |

---

## Backend Changes

### New Endpoint: `GET /payments/summary`

**Role guard:** `superadmin` only

**Query param:** `?month=YYYY-MM` (required)

**Logic:**
1. Fetch all branches for the tenant (from JWT `tenantId`)
2. For each branch, count students and their payment status for the given month
3. Return summary per branch

**Response shape:**
```ts
BranchPaymentSummary[]

interface BranchPaymentSummary {
  branchId: string;
  branchName: string;
  total: number;           // all students in branch
  paid: number;            // students with hasPaid === true
  unpaid: number;          // students with hasPaid === false && status !== 'blocked_payment'
  blocked: number;         // students with status === 'blocked_payment'
  totalCollected: number;  // sum of payment.amount for paid students this month
}
```

**Implementation approach:** Single DB query using `groupBy` or aggregation on the existing `getBranchPaymentStatus` service method called per branch, executed in parallel.

**File to modify:** `apps/api/src/payments/payments.controller.ts`, `apps/api/src/payments/payments.service.ts`

---

## Frontend

### Shared Component: `<DebtorsTable>`

**File:** `apps/web/app/(dashboard)/_components/DebtorsTable.tsx`

**Props:**
```ts
interface DebtorsTableProps {
  students: BranchStudent[];  // from GET /payments/branch/:id?month=
  readOnly: boolean;
  onMarkPaid?: (studentId: string, amount: number) => Promise<void>;
  loading: boolean;
}

interface BranchStudent {
  id: string;
  name: string;
  status: string;        // 'active' | 'blocked_payment' | 'inactive'
  hasPaid: boolean;
  payment: { amount: number; paidAt: string } | null;
}
```

**Features:**
- **Status filter tabs:** "Barchasi" | "To'lamagan" | "Bloklangan"
  - "To'lamagan" = `hasPaid === false && status !== 'blocked_payment'`
  - "Bloklangan" = `status === 'blocked_payment'`
- **Amount sort:** Click column header to sort ascending/descending by `payment.amount`; null amounts sort last
- **Read-only mode:** `readOnly={true}` hides "To'landi" button column
- **Skeleton loader:** 5 placeholder rows while loading
- **Empty state:** "Qarzdorlar topilmadi" when filtered list is empty

**Row layout:**
```
| O'quvchi ismi | Holat badge | To'lov miqdori | To'langan sana | [To'landi tugmasi] |
```

---

### Shared Component: `<MonthPicker>`

**File:** `apps/web/app/(dashboard)/_components/MonthPicker.tsx`

**Props:**
```ts
interface MonthPickerProps {
  value: string;         // "YYYY-MM"
  onChange: (month: string) => void;
  max?: string;          // default: current month
}
```

Uses `<input type="month">`. Default value: current month (`new Date().toISOString().slice(0, 7)`).

---

### Page: `/filadmin/payments` (enhance existing)

**File:** `apps/web/app/(dashboard)/filadmin/payments/page.tsx` — replace mock data with real API + add month picker + use `<DebtorsTable>`

**Data flow:**
1. `branchId` from `localStorage.getItem('user')` (try/catch)
2. `month` from local state, default current month
3. `GET /payments/branch/:branchId?month=` on mount and on month change
4. `POST /payments` on "To'landi" → refetch

---

### Page: `/manager/payments` (new)

**File:** `apps/web/app/(dashboard)/manager/payments/page.tsx`

**Data flow:** Same as filadmin but `readOnly={true}`, no POST. Back link → `/manager`.

**Navigation:** Add "💰 To'lovlar" to manager bottom nav.

---

### Page: `/superadmin/payments` (new)

**File:** `apps/web/app/(dashboard)/superadmin/payments/page.tsx`

**Data flow:**
1. `GET /payments/summary?month=` on mount and month change
2. Render `BranchSummaryCard` grid (2 cols on mobile, 3 on desktop)
3. Card click → `/superadmin/payments/[branchId]?month=`

**Branch card layout:**
```
┌───────────────────────────────┐
│ Toshkent filiali              │
│ 45 o'quvchi                   │
│ ✅ 32 to'lagan  ❌ 13 qarzdor  │
│ 🔒 8 bloklangan               │
│ Yig'ilgan: 3 200 000 so'm     │
└───────────────────────────────┘
```

---

### Page: `/superadmin/payments/[branchId]` (new)

**File:** `apps/web/app/(dashboard)/superadmin/payments/[branchId]/page.tsx`

**Data flow:** `GET /payments/branch/:branchId?month=` → `<DebtorsTable readOnly={true} />`

Back link → `/superadmin/payments?month=` (preserves month selection)

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| API fetch fails | Red error message + "Qayta urinish" button |
| `localStorage` parse fails | try/catch, `branchId = ''`, show "Filial biriktirilmagan" |
| Empty branch (0 students) | Card shown with "O'quvchilar yo'q" |
| `summary` endpoint fails | Error message, no cards rendered |
| Month re-fetch in progress | Table/cards at `opacity-50` while loading |

---

## Navigation Changes

- **Manager bottom nav:** Add `{ href: '/manager/payments', icon: '💰', label: "To'lovlar" }`
- **Superadmin nav:** Add payments link (superadmin nav structure to be verified)
- **Filadmin:** Already has "💰 To'lovlar" nav item — no change needed

---

## Out of Scope

- PDF/Excel export (future phase)
- Email/SMS notifications for debtors (separate sub-project B)
- Bulk payment recording
- Payment amount configuration UI (`PaymentSetting` update)
