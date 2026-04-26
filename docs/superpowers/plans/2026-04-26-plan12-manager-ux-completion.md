# Plan 12: Manager UX Completion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /status/yellow-students` endpoint, wire real API into the manager dashboard, fix 3 bugs in the student detail page, and add `?reason` pre-fill to the delegations/new page.

**Architecture:** Mirrors the existing `getRedStudents` pattern for yellow students. Manager dashboard fetches all four APIs in one `Promise.all`. Student detail page fetches the student's name from `/users/:id` in parallel with existing calls.

**Tech Stack:** NestJS 10 + Prisma 5 (backend), Next.js 14 App Router + Tailwind (frontend), Jest (tests).

---

## File Map

| Action | Path |
|--------|------|
| Modify | `apps/api/src/student-status/status.service.ts` |
| Modify | `apps/api/src/student-status/status.controller.ts` |
| Modify | `apps/api/src/student-status/status.spec.ts` |
| Modify | `apps/web/app/(dashboard)/manager/page.tsx` |
| Modify | `apps/web/app/(dashboard)/manager/students/[id]/page.tsx` |
| Modify | `apps/web/app/(dashboard)/delegations/new/page.tsx` |

---

## Task 1 — Backend: `getYellowStudents` service method + endpoint

**Files:**
- Modify: `apps/api/src/student-status/status.service.ts`
- Modify: `apps/api/src/student-status/status.controller.ts`
- Modify: `apps/api/src/student-status/status.spec.ts`

- [ ] **Step 1: Write the failing tests**

Open `apps/api/src/student-status/status.spec.ts`. Add a new `describe('getYellowStudents')` block after the `getRedStudents` describe block (after line 139, before the closing `});`):

```typescript
  describe('getYellowStudents', () => {
    it('returns students whose latest record has at least one sariq status', async () => {
      const yellowStudents = [
        {
          id: 's2',
          studentId: 'u2',
          englishStatus: 'sariq',
          personalStatus: 'yashil',
          criticalStatus: 'yashil',
          student: { id: 'u2', name: 'Zulfiya Karimova' },
        },
      ];
      mockPrisma.studentStatus.findMany.mockResolvedValue(yellowStudents);

      const result = await service.getYellowStudents('t1');

      expect(mockPrisma.studentStatus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: { tenantId: 't1' },
            OR: expect.arrayContaining([
              { englishStatus: 'sariq' },
              { personalStatus: 'sariq' },
              { criticalStatus: 'sariq' },
            ]),
          }),
          distinct: ['studentId'],
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].student.name).toBe('Zulfiya Karimova');
    });

    it('returns empty array when no students have sariq status', async () => {
      mockPrisma.studentStatus.findMany.mockResolvedValue([]);
      const result = await service.getYellowStudents('t1');
      expect(result).toHaveLength(0);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/api && npx jest status.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: `TypeError: service.getYellowStudents is not a function` (or similar — method doesn't exist yet).

- [ ] **Step 3: Add `getYellowStudents` to StatusService**

Open `apps/api/src/student-status/status.service.ts`. Add after the `getRedStudents` method (after line 78, before the closing `}`):

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

- [ ] **Step 4: Add `GET /status/yellow-students` to StatusController**

Open `apps/api/src/student-status/status.controller.ts`. Add after the `getRedStudents` handler (after line 53), keeping it before `history/:studentId`:

```typescript
  @Get('yellow-students')
  @Roles(UserRole.mentor, UserRole.manager, UserRole.filadmin)
  getYellowStudents(@Request() req: AuthRequest) {
    return this.statusService.getYellowStudents(req.user.tenantId);
  }
```

Route order after this change: `my` → `red-students` → `yellow-students` → `history/:studentId` → `:studentId`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd apps/api && npx jest status.spec.ts --no-coverage 2>&1 | tail -20
```

Expected: `Tests: 8 passed, 8 total` (6 existing + 2 new).

- [ ] **Step 6: TypeScript check**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (0 errors).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/student-status/status.service.ts \
        apps/api/src/student-status/status.controller.ts \
        apps/api/src/student-status/status.spec.ts
git commit -m "feat: add getYellowStudents endpoint + unit tests"
```

---

## Task 2 — Frontend: Manager Dashboard — Real API

**Files:**
- Modify: `apps/web/app/(dashboard)/manager/page.tsx`

- [ ] **Step 1: Replace the file with the real-API version**

The current file has hardcoded `RED_STUDENTS` and `YELLOW_STUDENTS` constants. Replace the entire file content:

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { XpBar } from '../student/_components/XpBar';
import { StreakBadge } from '../student/_components/StreakBadge';

type XpData = {
  totalXp: number;
  level: string;
  nextLevelXp: number;
};

type StreakData = {
  streak: number;
  hasShield: boolean;
};

type StatusStudent = {
  studentId: string;
  student: { id: string; name: string };
  englishStatus: string;
  personalStatus: string;
  criticalStatus: string;
};

export default function ManagerDashboard() {
  const [xpData, setXpData] = useState<XpData>({ totalXp: 0, level: 'Novice', nextLevelXp: 5000 });
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [redStudents, setRedStudents] = useState<StatusStudent[]>([]);
  const [yellowStudents, setYellowStudents] = useState<StatusStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [xpRes, streakRes, redRes, yellowRes] = await Promise.all([
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<StreakData>('/gamification/streak', {}, token),
          apiRequest<StatusStudent[]>('/status/red-students', {}, token).catch(() => ({ data: [] as StatusStudent[] })),
          apiRequest<StatusStudent[]>('/status/yellow-students', {}, token).catch(() => ({ data: [] as StatusStudent[] })),
        ]);
        setXpData(xpRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
        setRedStudents(redRes.data);
        setYellowStudents(yellowRes.data);
      } catch {
        // keep defaults on error
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  function StudentRow({ s, color }: { s: StatusStudent; color: 'red' | 'yellow' }) {
    return (
      <div className="p-4 flex items-center justify-between">
        <div>
          <p className="font-medium">{s.student.name}</p>
          <p className="text-sm text-gray-500">
            {[s.englishStatus, s.personalStatus, s.criticalStatus]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Link
          href={`/manager/students/${s.student.id}`}
          className={`px-3 py-1 rounded-lg text-sm text-white ${
            color === 'red' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-yellow-600 hover:bg-yellow-700'
          }`}
        >
          Ko&apos;rish
        </Link>
      </div>
    );
  }

  function SkeletonRows() {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 flex items-center justify-between animate-pulse">
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-100 rounded" />
            </div>
            <div className="h-8 w-16 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manager Paneli</h1>

      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-4 text-white">
        <div className="flex justify-between items-start mb-3">
          <StreakBadge streak={streak} hasShield={hasShield} />
        </div>
        <XpBar totalXp={xpData.totalXp} level={xpData.level} nextLevelXp={xpData.nextLevelXp} />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <h2 className="font-semibold text-red-700">
            🔴 Qizil O&apos;quvchilar ({loading ? '…' : redStudents.length})
          </h2>
        </div>
        <div className="divide-y">
          {loading ? (
            <SkeletonRows />
          ) : redStudents.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">Qizil o&apos;quvchilar yo&apos;q</p>
          ) : (
            redStudents.map((s) => <StudentRow key={s.studentId} s={s} color="red" />)
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
          <h2 className="font-semibold text-yellow-700">
            🟡 Sariq O&apos;quvchilar ({loading ? '…' : yellowStudents.length})
          </h2>
        </div>
        <div className="divide-y">
          {loading ? (
            <SkeletonRows />
          ) : yellowStudents.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">Sariq o&apos;quvchilar yo&apos;q</p>
          ) : (
            yellowStudents.map((s) => <StudentRow key={s.studentId} s={s} color="yellow" />)
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (0 errors).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/manager/page.tsx
git commit -m "feat: connect manager dashboard to real red/yellow students API"
```

---

## Task 3 — Frontend: Manager Student Detail — 3 Bug Fixes

**Files:**
- Modify: `apps/web/app/(dashboard)/manager/students/[id]/page.tsx`

- [ ] **Step 1: Replace the file with the fixed version**

The current file has 3 bugs: hardcoded student name, wrong status color keys, non-functional "1:1 Sessiya" button. Replace the entire file:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  orderNumber: number;
  nRepetitions: number;
  type: string;
}

interface StudentStatus {
  englishStatus: string;
  personalStatus: string;
  criticalStatus: string;
}

interface UserInfo {
  id: string;
  name: string;
  role: string;
}

type StatusColor = 'green' | 'yellow' | 'red';

function statusColor(value: string): StatusColor {
  if (value === 'yashil') return 'green';
  if (value === 'sariq') return 'yellow';
  if (value === 'qizil') return 'red';
  return 'red';
}

const STATUS_CLASSES: Record<StatusColor, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<StatusColor, string> = {
  green: 'Yashil',
  yellow: 'Sariq',
  red: 'Qizil',
};

export default function StudentProfilePage() {
  const { id: studentId } = useParams<{ id: string }>();
  const router = useRouter();

  const [studentName, setStudentName] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function load() {
      try {
        const [lessonsRes, statusRes, userRes] = await Promise.all([
          apiRequest<Lesson[]>('/lessons', {}, token),
          apiRequest<StudentStatus>(`/status/${studentId}`, {}, token).catch(() => ({ data: null })),
          apiRequest<UserInfo>(`/users/${studentId}`, {}, token),
        ]);

        setLessons(lessonsRes.data);
        setStatus(statusRes.data);
        setStudentName(userRes.data.name);

        const initial: Record<string, number> = {};
        for (const l of lessonsRes.data) {
          initial[l.id] = l.nRepetitions;
        }
        setOverrides(initial);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [studentId]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave(lessonId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setSaving((prev) => ({ ...prev, [lessonId]: true }));
    try {
      await apiRequest(
        `/student-config/${studentId}/${lessonId}/n-override`,
        {
          method: 'POST',
          body: JSON.stringify({ nRepetitions: overrides[lessonId] }),
        },
        token,
      );
      showToast('Saqlandi!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving((prev) => ({ ...prev, [lessonId]: false }));
    }
  }

  function handleStart11() {
    const encoded = encodeURIComponent(`1:1 sessiya: ${studentName}`);
    router.push(`/delegations/new?reason=${encoded}`);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <Link
        href="/manager"
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
      >
        &larr; Orqaga
      </Link>

      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
            {loading ? (
              <span className="inline-block h-6 w-36 bg-gray-200 rounded animate-pulse" />
            ) : (
              studentName || 'Nomaʼlum oʼquvchi'
            )}
          </h1>
          <p className="text-sm text-gray-500">O&apos;quvchi profili</p>
        </div>
        <button
          onClick={handleStart11}
          disabled={!studentName}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          1:1 Sessiya boshlash
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">Holat</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Yuklanmoqda...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : status ? (
          <div className="flex flex-wrap gap-3">
            {(
              [
                { label: 'Ingliz tili', value: status.englishStatus },
                { label: 'Shaxsiy', value: status.personalStatus },
                { label: 'Tanqidiy', value: status.criticalStatus },
              ] as { label: string; value: string }[]
            ).map(({ label, value }) => {
              const color = statusColor(value);
              return (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASSES[color]}`}
                >
                  {label}: {STATUS_LABELS[color]}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Status belgilanmagan</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold">Dars takrorlash soni (N override)</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-gray-400">Yuklanmoqda...</div>
        ) : error ? (
          <div className="p-5 text-sm text-red-500">{error}</div>
        ) : (
          <div className="divide-y">
            {lessons
              .slice()
              .sort((a, b) => a.orderNumber - b.orderNumber)
              .map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{lesson.title}</p>
                    <p className="text-xs text-gray-400">
                      Standart: {lesson.nRepetitions} marta &bull; {lesson.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={overrides[lesson.id] ?? lesson.nRepetitions}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          [lesson.id]: Math.min(20, Math.max(1, Number(e.target.value))),
                        }))
                      }
                      className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      onClick={() => handleSave(lesson.id)}
                      disabled={saving[lesson.id]}
                      className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {saving[lesson.id] ? '...' : 'Saqlash'}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (0 errors).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(dashboard)/manager/students/[id]/page.tsx"
git commit -m "fix: manager student detail — real name, correct status colors, wire 1:1 sessiya button"
```

---

## Task 4 — Frontend: Delegations New — `?reason` Pre-fill

**Files:**
- Modify: `apps/web/app/(dashboard)/delegations/new/page.tsx`

- [ ] **Step 1: Add `useSearchParams` import and pre-fill reason state**

Open `apps/web/app/(dashboard)/delegations/new/page.tsx`. The current file starts with:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';
```

Replace with:

```tsx
'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';
```

Then replace the current state declarations at the top of the component:

```tsx
  const router = useRouter();
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
```

With:

```tsx
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState(searchParams.get('reason') ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
```

No other changes to the file.

- [ ] **Step 2: TypeScript check**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (0 errors).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(dashboard)/delegations/new/page.tsx"
git commit -m "feat: pre-fill reason in delegations/new from ?reason query param"
```

---

## Final Verification

- [ ] **Run all API tests**

```bash
cd apps/api && pnpm test 2>&1 | tail -15
```

Expected: all tests pass, including the 2 new `getYellowStudents` tests.

- [ ] **Run full TypeScript check — API**

```bash
cd apps/api && npx tsc --noEmit 2>&1
```

Expected: no output.

- [ ] **Run full TypeScript check — Web**

```bash
cd apps/web && npx tsc --noEmit 2>&1
```

Expected: no output.
