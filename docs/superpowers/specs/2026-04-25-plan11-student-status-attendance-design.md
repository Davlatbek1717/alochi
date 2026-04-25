# Plan 11: Student Status & Attendance — Design Spec

**Date:** 2026-04-25  
**Status:** Approved

---

## Goal

Complete the Student Status and Attendance modules: fill backend gaps (`red-students` endpoint, history endpoint), add missing unit tests, and build two frontend pages (mentor attendance marking, filadmin staff attendance view) plus connect real student status API on the student dashboard.

---

## Context

Both `student-status` and `attendance` NestJS modules already exist and are registered in `app.module.ts`. The Prisma schema has `StudentStatus`, `AttendanceStudent`, and `AttendanceStaff` models. TODO.md is outdated — these modules are partially or fully implemented.

**Actual gaps:**
- `GET /status/red-students` — service method + controller endpoint missing
- `GET /status/history/:studentId` — service has `getHistory()` but not exposed in controller
- No unit tests for `student-status` or `attendance` modules
- Frontend: `mentor/attendance/page.tsx` — missing entirely
- Frontend: `filadmin/attendance/page.tsx` — missing entirely
- Frontend: `student/page.tsx` status dots — hardcoded `⚪`, not connected to `GET /status/my`

---

## Scope

**In scope:**
- `StatusService.getRedStudents(tenantId)` — new service method
- `GET /status/red-students` + `GET /status/history/:studentId` — new controller endpoints
- `apps/api/src/student-status/status.spec.ts` — unit tests
- `apps/api/src/attendance/attendance.spec.ts` — unit tests
- `apps/web/app/(dashboard)/student/page.tsx` — connect `GET /status/my`
- `apps/web/app/(dashboard)/mentor/attendance/page.tsx` — new page
- `apps/web/app/(dashboard)/filadmin/attendance/page.tsx` — new page

**Out of scope:**
- Face ID attendance (separate plan)
- Telegram bot handlers
- `prisma db push` / migrations (schema already has the models)
- Manager students detail page

---

## Architecture

### File Map

| Action | Path |
|--------|------|
| Modify | `apps/api/src/student-status/status.service.ts` |
| Modify | `apps/api/src/student-status/status.controller.ts` |
| Create | `apps/api/src/student-status/status.spec.ts` |
| Create | `apps/api/src/attendance/attendance.spec.ts` |
| Modify | `apps/web/app/(dashboard)/student/page.tsx` |
| Create | `apps/web/app/(dashboard)/mentor/attendance/page.tsx` |
| Create | `apps/web/app/(dashboard)/filadmin/attendance/page.tsx` |

---

## Task 1 — Backend: Status Gaps

### StatusService additions

```typescript
// apps/api/src/student-status/status.service.ts

async getRedStudents(tenantId: string) {
  // Subquery: for each student, get their latest status date
  // Then filter where any of the three status fields = 'qizil'
  return this.prisma.studentStatus.findMany({
    where: {
      student: { tenantId },
      OR: [
        { englishStatus: 'qizil' },
        { personalStatus: 'qizil' },
        { criticalStatus: 'qizil' },
      ],
    },
    orderBy: { date: 'desc' },
    distinct: ['studentId'],
    include: {
      student: { select: { id: true, name: true } },
    },
  });
}
```

`distinct: ['studentId']` combined with `orderBy: { date: 'desc' }` ensures only the most recent status record per student is returned.

### StatusController additions

```typescript
@Get('red-students')
@Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
getRedStudents(@Request() req: AuthRequest) {
  return this.statusService.getRedStudents(req.user.tenantId);
}

@Get('history/:studentId')
@Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
getHistory(@Param('studentId') studentId: string) {
  return this.statusService.getHistory(studentId);
}
```

Both endpoints require JWT auth + role guard (already applied at controller level).

---

## Task 2 — Unit Tests: student-status.spec.ts

Four test cases covering the full service surface:

1. `setStatus` — upsert creates a new record, returns saved data
2. `getLatest` — returns the most recent record for a student (ordered by date desc)
3. `getHistory` — returns array up to `limit` records
4. `getRedStudents` — returns only students whose latest record has at least one `qizil` field; students with all `yashil`/`sariq` are excluded

Mock pattern (consistent with existing specs in the codebase):
```typescript
const mockPrisma = {
  studentStatus: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};
```

---

## Task 3 — Unit Tests: attendance.spec.ts

Four test cases:

1. `markBulk` — calls `upsert` N times (Promise.all), returns array of results
2. `getDailyList` — queries by `branchId` + `date`, returns records with student names
3. `checkIn` — `isLate` is `true` when UTC hour > 9, `false` when hour < 9
4. `confirm` — calls `update` with `confirmedAt` (Date) and `confirmedBy` (string)

Two service classes tested separately:
- `AttendanceStudentsService` — tasks 1 & 2
- `AttendanceStaffService` — tasks 3 & 4

---

## Task 4 — Frontend: Student Status Display

**File:** `apps/web/app/(dashboard)/student/page.tsx`

Add `GET /status/my` to the existing `Promise.all` in `fetchData()`:

```typescript
const STATUS_COLOR: Record<string, string> = {
  yashil: '🟢',
  sariq: '🟡',
  qizil: '🔴',
  '': '⚪',
};

// In Promise.all:
apiRequest<{ englishStatus?: string; personalStatus?: string; criticalStatus?: string }>(
  '/status/my'
).catch(() => null)  // non-blocking — if status not set yet, show ⚪
```

Replace hardcoded `⚪` in the 3-dot status grid:
```tsx
{['englishStatus', 'personalStatus', 'criticalStatus'].map((key) => (
  <span key={key}>
    {STATUS_COLOR[statusData?.[key as keyof typeof statusData] ?? ''] ?? '⚪'}
  </span>
))}
```

If API returns `null` (status not set yet for this student) → all dots remain `⚪`.

---

## Task 5 — Frontend: Mentor Attendance Page

**File:** `apps/web/app/(dashboard)/mentor/attendance/page.tsx`

### Data flow

1. Local `getGroupIdFromToken()` helper (define in this file — same pattern as `mentor/group/page.tsx`):
```typescript
function getGroupIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.groupId === 'string' ? payload.groupId : null;
  } catch {
    return null;
  }
}
```
2. `GET /users/group/:groupId` → student list
3. Local state: `Record<studentId, 'present' | 'absent' | 'late'>` — all initialized to `'present'`
4. Submit: `POST /attendance/students/bulk` with `{ date, records: [{ studentId, status }] }`

### UI

```
Header: "Davomat — [bugun sana]"

[ Loading skeleton × 5 rows ]   (while fetching students)

─────────────────────────────────────
  Ali Valiyev    [✅ Keldi] [❌ Kelmadi] [⏰ Kechikdi]
  Zulfiya Karimova  [✅ Keldi] [❌ Kelmadi] [⏰ Kechikdi]
  ...
─────────────────────────────────────

             [Saqlash]
```

- Active button: filled color (green/red/yellow), inactive: `bg-gray-100 text-gray-500`
- "Saqlash" disabled while saving; shows spinner
- On success: inline "✓ Saqlandi" message (no page reload)
- On error: inline error text with "Qayta urinish"

### Date

Today's date passed as `new Date().toISOString().split('T')[0]` in the POST body.

---

## Task 6 — Frontend: Filadmin Attendance Page

**File:** `apps/web/app/(dashboard)/filadmin/attendance/page.tsx`

### Data flow

1. `branchId` from JWT payload (`payload.branchId`)
2. Selected date state: `useState(today)` — `<input type="date">` to change
3. `GET /attendance/staff/:branchId/:date` on mount + on date change
4. `POST /attendance/staff/confirm/:userId` on "Tasdiqlash" button click

### UI

```
Header: "Xodimlar Davomati"

[📅 date picker — default: bugun]

┌──────────┬──────────────┬────────┬───────────┬────────────────┐
│ Xodim    │ Kirish vaqti │ Usul   │ Kechikdi  │ Tasdiqlangan   │
├──────────┼──────────────┼────────┼───────────┼────────────────┤
│ Jasur    │ 08:47        │ 📷 FID │  —        │ ✓ 09:15        │
│ Malika   │ 09:23        │ ✍️ Q.la│ 🔴        │ [✓ Tasdiqlash] │
│ Bobur    │  —           │  —     │  —        │ Kelmagan       │
└──────────┴──────────────┴────────┴───────────┴────────────────┘
```

- **Usul mapping:** `face_id` → `📷 Face ID`, `manual` → `✍️ Qo'lda`
- **Kechikdi:** `isLate === true` → `🔴`, otherwise `—`
- **Tasdiqlangan:** `confirmedAt` bor → `✓ HH:mm`; yo'q → "Tasdiqlash" tugmasi
- **Kelmagan:** `loginTime` yo'q → barcha ustunlar `—`, oxirgisi "Kelmagan"
- Loading: table skeleton (5 rows)
- Error: inline xabar + "Qayta urinish"

---

## Status Values

Valid values for `englishStatus`, `personalStatus`, `criticalStatus`:
- `'yashil'` — yaxshi
- `'sariq'` — e'tibor kerak
- `'qizil'` — kritik
- `null` / `undefined` — belgilanmagan → `⚪` ko'rsatiladi

---

## Error Handling

- All `apiRequest` calls: `try/catch` → non-blocking inline error
- `GET /status/my` 404 or error: silently falls back to `⚪` (student may have no status yet)
- `POST /attendance/students/bulk` error: show retry button, do not clear local state
- `groupId` missing from JWT: show "Guruh topilmadi" with contact admin message
- `branchId` missing from JWT: same pattern

---

## Testing

- `npx tsc --noEmit` in `apps/api` — 0 errors
- `npx tsc --noEmit` in `apps/web` — 0 errors  
- Run `pnpm --filter api test` — all new specs pass
- Manual: login as `student` → status dots update from API
- Manual: login as `mentor` → mark attendance → verify saved in DB
- Manual: login as `filadmin` → change date → table refreshes

---

## Out of Scope — Explicit Deferrals

| Item | Reason |
|------|--------|
| Face ID attendance confirmation UI | Requires Face ID backend (separate plan) |
| `confidence` score display | Face ID plan scope |
| Telegram status/attendance commands | Telegram handlers plan |
| Manager `red-students` frontend | `GET /status/red-students` now built — frontend wire-up in next plan |
| `prisma db push` | Schema already has all models — no migration needed |
