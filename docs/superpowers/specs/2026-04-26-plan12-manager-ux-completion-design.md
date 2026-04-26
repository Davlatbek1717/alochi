# Plan 12: Manager UX Completion — Design Spec

**Date:** 2026-04-26
**Status:** Approved

---

## Goal

Complete the Manager role UX: add `GET /status/yellow-students` backend endpoint, wire real API into the manager dashboard (replacing hardcoded mocks), fix 3 bugs in the student detail page, and add `?reason` pre-fill to the delegations/new page.

---

## Context

Plan 11 built `GET /status/red-students`. The manager dashboard (`manager/page.tsx`) still uses hardcoded `RED_STUDENTS` and `YELLOW_STUDENTS` constants. The student detail page (`manager/students/[id]/page.tsx`) has three bugs: hardcoded student name, wrong status color mapping (English keys vs Uzbek API values), and a non-functional "1:1 Sessiya" button. The delegations/new page has no pre-fill support.

---

## Scope

**In scope:**
- `StatusService.getYellowStudents(tenantId)` — new service method
- `GET /status/yellow-students` — new controller endpoint
- `apps/api/src/student-status/status.spec.ts` — 2 new unit tests for `getYellowStudents`
- `apps/web/app/(dashboard)/manager/page.tsx` — replace mocks with real API
- `apps/web/app/(dashboard)/manager/students/[id]/page.tsx` — 3 bug fixes
- `apps/web/app/(dashboard)/delegations/new/page.tsx` — `?reason` query param pre-fill

**Out of scope:**
- `manager/students/page.tsx` list page (dashboard links directly to detail)
- KPI frontend
- Telegram bot handlers
- Face ID

---

## Architecture

### File Map

| Action | Path |
|--------|------|
| Modify | `apps/api/src/student-status/status.service.ts` |
| Modify | `apps/api/src/student-status/status.controller.ts` |
| Modify | `apps/api/src/student-status/status.spec.ts` |
| Modify | `apps/web/app/(dashboard)/manager/page.tsx` |
| Modify | `apps/web/app/(dashboard)/manager/students/[id]/page.tsx` |
| Modify | `apps/web/app/(dashboard)/delegations/new/page.tsx` |

---

## Task 1 — Backend: Yellow Students Endpoint

### StatusService addition

```typescript
async getYellowStudents(tenantId: string) {
  return this.prisma.studentStatus.findMany({
    where: {
      student: { tenantId },
      OR: [
        { englishStatus: 'sariq' },
        { personalStatus: 'sariq' },
        { criticalStatus: 'sariq' },
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

### StatusController addition

```typescript
@Get('yellow-students')
@Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
getYellowStudents(@Request() req: AuthRequest) {
  return this.statusService.getYellowStudents(req.user.tenantId);
}
```

Route order must be: `my` → `red-students` → `yellow-students` → `history/:studentId` → `:studentId`.

---

## Task 2 — Unit Tests: getYellowStudents

Two new test cases in `status.spec.ts`:

1. Returns students whose latest record has at least one `sariq` field
2. Returns empty array when no students have any `sariq` field

Uses the same `mockPrisma` pattern already in the file.

---

## Task 3 — Frontend: Manager Dashboard

**File:** `apps/web/app/(dashboard)/manager/page.tsx`

Remove `RED_STUDENTS` and `YELLOW_STUDENTS` constants. Add state and real API:

```typescript
type StatusStudent = {
  studentId: string;
  student: { id: string; name: string };
  englishStatus: string;
  personalStatus: string;
  criticalStatus: string;
};

const [redStudents, setRedStudents] = useState<StatusStudent[]>([]);
const [yellowStudents, setYellowStudents] = useState<StatusStudent[]>([]);
const [loading, setLoading] = useState(true);
```

`useEffect` fetches all four in parallel:
```typescript
const [xpRes, streakRes, redRes, yellowRes] = await Promise.all([
  apiRequest<XpData>('/gamification/xp', {}, token),
  apiRequest<StreakData>('/gamification/streak', {}, token),
  apiRequest<StatusStudent[]>('/status/red-students', {}, token).catch(() => ({ data: [] })),
  apiRequest<StatusStudent[]>('/status/yellow-students', {}, token).catch(() => ({ data: [] })),
]);
```

Each student row links to `/manager/students/:id`:
```tsx
<Link href={`/manager/students/${s.student.id}`}>
  {s.student.name}
</Link>
```

Section headers show real count: `🔴 Qizil O'quvchilar ({redStudents.length})`.

Loading: 3-row skeleton per section. Error: silently falls back to empty array (non-blocking).

---

## Task 4 — Frontend: Manager Student Detail (3 Bug Fixes)

**File:** `apps/web/app/(dashboard)/manager/students/[id]/page.tsx`

### Fix 1: Fetch student name

Add `studentName` state:
```typescript
const [studentName, setStudentName] = useState('');
```

Add `UserInfo` type (alongside existing types):
```typescript
type UserInfo = { id: string; name: string; role: string };
```

Update `load()` to fetch in parallel and unwrap status catch:
```typescript
const [lessonsRes, statusRes, userRes] = await Promise.all([
  apiRequest<Lesson[]>('/lessons', {}, token),
  apiRequest<StudentStatus>(`/status/${studentId}`, {}, token).catch(() => ({ data: null })),
  apiRequest<UserInfo>(`/users/${studentId}`, {}, token),
]);

setLessons(lessonsRes.data);
setStatus(statusRes.data);
setStudentName(userRes.data.name);
```

Replace hardcoded `"Sardor Rahimov"` with `{studentName}` state variable.

### Fix 2: Status color mapping

Replace the current `statusColor()` function (which maps English values) with:
```typescript
function statusColor(value: string): StatusColor {
  if (value === 'yashil') return 'green';
  if (value === 'sariq') return 'yellow';
  if (value === 'qizil') return 'red';
  return 'red';
}
```

### Fix 3: Wire "1:1 Sessiya" button

Replace `handleStart11()` toast stub with navigation:
```typescript
function handleStart11() {
  const encoded = encodeURIComponent(`1:1 sessiya: ${studentName}`);
  router.push(`/delegations/new?reason=${encoded}`);
}
```

---

## Task 5 — Frontend: Delegations New — Pre-fill Support

**File:** `apps/web/app/(dashboard)/delegations/new/page.tsx`

Add `useSearchParams` and pre-fill reason:
```typescript
import { useSearchParams } from 'next/navigation';

const searchParams = useSearchParams();
const [reason, setReason] = useState(searchParams.get('reason') ?? '');
```

No other changes — the existing form submit logic remains identical.

---

## Error Handling

- `GET /status/red-students` / `GET /status/yellow-students` errors: `.catch(() => ({ data: [] }))` — dashboard shows empty sections, not broken UI
- `GET /users/:studentId` error on detail page: show inline error, do not render page content
- `GET /status/:studentId` error on detail page: silently show no status badges

---

## Testing

- `pnpm --filter api test` — all status.spec.ts tests pass including 2 new `getYellowStudents` tests
- `npx tsc --noEmit` in `apps/api` — 0 errors
- `npx tsc --noEmit` in `apps/web` — 0 errors
- Manual: manager dashboard shows real students from API
- Manual: clicking student → detail page shows real name and correct status colors
- Manual: "1:1 Sessiya" → delegations/new page with reason pre-filled

---

## Out of Scope — Explicit Deferrals

| Item | Reason |
|------|--------|
| `manager/students/page.tsx` list | Dashboard links directly to detail — list page is next plan |
| KPI frontend | Separate plan scope |
| delegations/new hardcoded recipients | Separate issue — recipient should come from `/users/by-branch/:branchId` but that's a larger refactor |
