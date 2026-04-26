# Plan 13: KPI Frontend + Dashboard Completion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build KPI award pages for filadmin and manager, replace placeholder dashboards for filadmin and tester, and wire real branch users into the delegations/new recipient selector.

**Architecture:** Five independent frontend changes — two new pages created from scratch, two placeholders replaced with full content, one existing form upgraded to fetch live data. No backend changes. TypeScript type-checking (`npx tsc --noEmit`) is the verification step for each task since these are UI pages with no isolated unit-testable logic.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, `apiRequest` from `@/lib/api`

---

## File Map

| Action | Path |
|--------|------|
| Create | `apps/web/app/(dashboard)/filadmin/kpi/page.tsx` |
| Create | `apps/web/app/(dashboard)/manager/kpi/page.tsx` |
| Replace | `apps/web/app/(dashboard)/filadmin/page.tsx` |
| Replace | `apps/web/app/(dashboard)/tester/page.tsx` |
| Modify | `apps/web/app/(dashboard)/delegations/new/page.tsx` |

---

## Background

- `apiRequest<T>(path, options, token)` lives in `apps/web/lib/api.ts`. It fetches `${BASE_URL}${path}`, throws on non-ok, and returns the full response JSON. The backend has a global `ResponseInterceptor` that wraps every response as `{ success: true, data: T, meta: { timestamp } }`, so `.data` always holds the typed payload.
- `GET /kpi/today` returns a plain `number` (the day's total). With the interceptor it arrives as `{ data: number }`.
- `GET /users/by-branch/:branchId` returns `BranchUser[]` where `BranchUser = { id, name, role, status, phone, login }`. `branchId` comes from `JSON.parse(localStorage.getItem('user') ?? '{}').branchId`.
- Student dashboard components live at `apps/web/app/(dashboard)/student/_components/` — the tester page imports from the same path.

---

## Task 1 — Filadmin KPI Award Page

**Files:**
- Create: `apps/web/app/(dashboard)/filadmin/kpi/page.tsx`

- [ ] **Step 1: Create the file with complete implementation**

Write the full file contents:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

type BranchUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  login: string;
};

const PRESETS = [5, 10, 15, 20, 25, 30, 50];

export default function FiladminKpiPage() {
  const [staffUsers, setStaffUsers] = useState<BranchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [score, setScore] = useState(10);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  const [todayTotal, setTodayTotal] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    const branchId: string = user.branchId ?? '';

    async function load() {
      const [usersRes, todayRes] = await Promise.allSettled([
        apiRequest<BranchUser[]>(`/users/by-branch/${branchId}`, {}, token),
        apiRequest<number>('/kpi/today', {}, token),
      ]);

      if (usersRes.status === 'fulfilled') {
        setStaffUsers(usersRes.value.data.filter((u) => u.role !== 'student'));
      } else {
        setUsersError('Xodimlar yuklanmadi');
      }
      setLoadingUsers(false);

      if (todayRes.status === 'fulfilled') {
        setTodayTotal(todayRes.value.data ?? 0);
      }
      setLoadingStats(false);
    }

    load();
  }, []);

  async function handleAward() {
    setSubmitting(true);
    setAwardError(null);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        '/kpi/award',
        {
          method: 'POST',
          body: JSON.stringify({ userId: selectedUserId, score, reason }),
        },
        token,
      );
      setSuccess(true);
      setSelectedUserId('');
      setReason('');
      setTodayTotal((prev) => prev + score);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setAwardError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/filadmin" className="text-sm text-indigo-600 hover:underline">
          &larr; Filadmin
        </Link>
        <h1 className="text-xl font-bold">KPI Mukofot</h1>
      </div>

      {/* Today's total */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-sm font-medium text-gray-500 mb-1">Bugun berilgan jami</p>
        {loadingStats ? (
          <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-indigo-600">{todayTotal} ball</p>
        )}
      </div>

      {/* Award form */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {/* User selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Xodimni tanlang</label>
          {loadingUsers ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : usersError ? (
            <p className="text-sm text-red-500">{usersError}</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y max-h-52 overflow-y-auto">
              {staffUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selectedUserId === u.id
                      ? 'bg-indigo-50 border-l-4 border-indigo-500'
                      : 'hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                  </div>
                  {selectedUserId === u.id && (
                    <span className="text-indigo-500 text-lg">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Score selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Ball</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setScore(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  score === p
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-300 text-gray-700 hover:border-indigo-400'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min={1}
              max={50}
              value={score}
              onChange={(e) =>
                setScore(Math.min(50, Math.max(1, Number(e.target.value))))
              }
              className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
            <span className="text-sm text-gray-400">/ 50 maksimal</span>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sabab</label>
          <textarea
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nima uchun mukofot berilmoqda?"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{reason.length}/200</p>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleAward}
          disabled={!selectedUserId || !reason.trim() || submitting}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
        >
          {submitting ? 'Yuborilmoqda...' : `${score} ball berish`}
        </button>

        {/* Feedback banners */}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
            <span>✓</span>
            <span>Ball muvaffaqiyatli berildi!</span>
          </div>
        )}
        {awardError && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
            {awardError}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors. If errors appear, fix them before proceeding.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/filadmin/kpi/page.tsx
git commit -m "feat: add filadmin KPI award page"
```

---

## Task 2 — Manager KPI Award Page

**Files:**
- Create: `apps/web/app/(dashboard)/manager/kpi/page.tsx`

Same component as the filadmin KPI page with one difference: the back link points to `/manager`.

- [ ] **Step 1: Create the file with complete implementation**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

type BranchUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  login: string;
};

const PRESETS = [5, 10, 15, 20, 25, 30, 50];

export default function ManagerKpiPage() {
  const [staffUsers, setStaffUsers] = useState<BranchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [score, setScore] = useState(10);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  const [todayTotal, setTodayTotal] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    const branchId: string = user.branchId ?? '';

    async function load() {
      const [usersRes, todayRes] = await Promise.allSettled([
        apiRequest<BranchUser[]>(`/users/by-branch/${branchId}`, {}, token),
        apiRequest<number>('/kpi/today', {}, token),
      ]);

      if (usersRes.status === 'fulfilled') {
        setStaffUsers(usersRes.value.data.filter((u) => u.role !== 'student'));
      } else {
        setUsersError('Xodimlar yuklanmadi');
      }
      setLoadingUsers(false);

      if (todayRes.status === 'fulfilled') {
        setTodayTotal(todayRes.value.data ?? 0);
      }
      setLoadingStats(false);
    }

    load();
  }, []);

  async function handleAward() {
    setSubmitting(true);
    setAwardError(null);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        '/kpi/award',
        {
          method: 'POST',
          body: JSON.stringify({ userId: selectedUserId, score, reason }),
        },
        token,
      );
      setSuccess(true);
      setSelectedUserId('');
      setReason('');
      setTodayTotal((prev) => prev + score);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setAwardError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/manager" className="text-sm text-indigo-600 hover:underline">
          &larr; Manager
        </Link>
        <h1 className="text-xl font-bold">KPI Mukofot</h1>
      </div>

      {/* Today's total */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-sm font-medium text-gray-500 mb-1">Bugun berilgan jami</p>
        {loadingStats ? (
          <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
        ) : (
          <p className="text-3xl font-bold text-indigo-600">{todayTotal} ball</p>
        )}
      </div>

      {/* Award form */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {/* User selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Xodimni tanlang</label>
          {loadingUsers ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : usersError ? (
            <p className="text-sm text-red-500">{usersError}</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y max-h-52 overflow-y-auto">
              {staffUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selectedUserId === u.id
                      ? 'bg-indigo-50 border-l-4 border-indigo-500'
                      : 'hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                  </div>
                  {selectedUserId === u.id && (
                    <span className="text-indigo-500 text-lg">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Score selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Ball</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setScore(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  score === p
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-300 text-gray-700 hover:border-indigo-400'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min={1}
              max={50}
              value={score}
              onChange={(e) =>
                setScore(Math.min(50, Math.max(1, Number(e.target.value))))
              }
              className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
            <span className="text-sm text-gray-400">/ 50 maksimal</span>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sabab</label>
          <textarea
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nima uchun mukofot berilmoqda?"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{reason.length}/200</p>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleAward}
          disabled={!selectedUserId || !reason.trim() || submitting}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
        >
          {submitting ? 'Yuborilmoqda...' : `${score} ball berish`}
        </button>

        {/* Feedback banners */}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
            <span>✓</span>
            <span>Ball muvaffaqiyatli berildi!</span>
          </div>
        )}
        {awardError && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
            {awardError}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/manager/kpi/page.tsx
git commit -m "feat: add manager KPI award page"
```

---

## Task 3 — Filadmin Dashboard Navigation Hub

**Files:**
- Modify: `apps/web/app/(dashboard)/filadmin/page.tsx`

Replace the 8-line placeholder with a gradient header + 2×2 card grid.

- [ ] **Step 1: Replace the file contents**

The current file is just a placeholder. Write the full replacement:

```tsx
import Link from 'next/link';

const NAV_CARDS = [
  {
    href: '/filadmin/attendance',
    icon: '📋',
    title: 'Davomat',
    description: 'Kunlik qatnashuvni belgilash',
    bg: 'bg-blue-50',
  },
  {
    href: '/filadmin/payments',
    icon: '💳',
    title: "To'lovlar",
    description: "O'quvchi to'lovlarini boshqarish",
    bg: 'bg-green-50',
  },
  {
    href: '/filadmin/warnings',
    icon: '⚠️',
    title: 'Ogohlantirishlar',
    description: 'Intizom muammolarini qayd etish',
    bg: 'bg-yellow-50',
  },
  {
    href: '/filadmin/kpi',
    icon: '⭐',
    title: 'KPI Mukofot',
    description: 'Xodimlarga ball berish',
    bg: 'bg-purple-50',
  },
];

export default function FiladminDashboard() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <p className="text-white/70 text-sm font-medium">Filial boshqaruvi</p>
        <h1 className="text-2xl font-bold mt-1">Filadmin Paneli</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {NAV_CARDS.map((card) => (
          <Link key={card.href} href={card.href}>
            <div
              className={`${card.bg} rounded-2xl p-5 h-full flex flex-col gap-3 hover:scale-[1.02] transition-transform cursor-pointer`}
            >
              <span className="text-3xl">{card.icon}</span>
              <div>
                <p className="font-semibold text-gray-800">{card.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/filadmin/page.tsx
git commit -m "feat: replace filadmin placeholder with navigation hub"
```

---

## Task 4 — Tester Dashboard Clone

**Files:**
- Modify: `apps/web/app/(dashboard)/tester/page.tsx`

Replace the 8-line placeholder with a full clone of the student dashboard. The only difference from `student/page.tsx` is the lesson CTA href (`/tester/lessons/current` instead of `/student/lessons/current`).

- [ ] **Step 1: Replace the file contents**

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { XpBar } from '../student/_components/XpBar';
import { StreakBadge } from '../student/_components/StreakBadge';
import { DailyQuests } from '../student/_components/DailyQuests';
import { SocialFeed } from '../student/_components/SocialFeed';
import VirtualCity from '../student/_components/VirtualCity';
import { apiRequest } from '@/lib/api';

type Quest = {
  questType: string;
  targetValue: number;
  progress: number;
  completed: boolean;
  xpReward: number;
};

type XpData = {
  totalXp: number;
  level: string;
  nextLevelXp: number;
};

type StreakData = {
  streak: number;
  hasShield: boolean;
};

type CityData = {
  level: number;
  buildings: string[];
  lessonsCompleted: number;
  nextLevelAt: number;
};

type StatusData = {
  englishStatus?: string;
  personalStatus?: string;
  criticalStatus?: string;
};

const STATUS_COLOR: Record<string, string> = {
  yashil: '🟢',
  sariq: '🟡',
  qizil: '🔴',
  '': '⚪',
};

export default function TesterDashboard() {
  const [xpData, setXpData] = useState<XpData>({ totalXp: 0, level: 'Novice', nextLevelXp: 5000 });
  const [quests, setQuests] = useState<Quest[]>([]);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<StatusData | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [xpRes, questsRes, cityRes, streakRes, progressRes, statusRes] = await Promise.all([
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<Quest[]>('/gamification/quests', {}, token),
          apiRequest<CityData>('/gamification/city', {}, token),
          apiRequest<StreakData>('/gamification/streak', {}, token),
          apiRequest<unknown[]>('/progress/my', {}, token),
          apiRequest<StatusData>('/status/my', {}, token).catch(() => ({ data: null as StatusData | null })),
        ]);
        setXpData(xpRes.data);
        setQuests(questsRes.data);
        setCityData(cityRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
        setLessonProgress(progressRes.data.length);
        setStatusData(statusRes.data);
      } catch {
        // keep defaults on error
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto flex items-center justify-center py-20">
        <p className="text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-20">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-4 text-white">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white/70 text-sm">🏙️ Shaharcha</p>
            <p className="text-2xl font-bold mt-1">Dars #{lessonProgress} / 500</p>
          </div>
          <StreakBadge streak={streak} hasShield={hasShield} />
        </div>
        <div className="mt-3">
          <XpBar totalXp={xpData.totalXp} level={xpData.level} nextLevelXp={xpData.nextLevelXp} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Ingliz tili', field: 'englishStatus' as const },
          { label: 'Shaxsiy', field: 'personalStatus' as const },
          { label: 'Tanqidiy', field: 'criticalStatus' as const },
        ].map((s) => (
          <div key={s.field} className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl">
              {STATUS_COLOR[statusData?.[s.field] ?? ''] ?? '⚪'}
            </p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <DailyQuests quests={quests} />

      {cityData && (
        <VirtualCity
          level={cityData.level}
          buildings={cityData.buildings}
          lessonsCompleted={cityData.lessonsCompleted}
          nextLevelAt={cityData.nextLevelAt}
        />
      )}

      <SocialFeed />

      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] left-0 right-0 px-4 max-w-lg mx-auto">
        <Link
          href="/tester/lessons/current"
          className="block w-full bg-indigo-600 text-white py-4 rounded-2xl text-center font-bold shadow-lg"
        >
          ▶️ Bugungi Darsni Boshlash
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/tester/page.tsx
git commit -m "feat: replace tester placeholder with student dashboard clone"
```

---

## Task 5 — Delegations New: Real Recipients

**Files:**
- Modify: `apps/web/app/(dashboard)/delegations/new/page.tsx`

Add `BranchUser` type, fetch real staff on mount, replace the two hardcoded `<option>` values with the live list.

- [ ] **Step 1: Add the `BranchUser` type and new state to `NewDelegationForm`**

Current file top (inside `NewDelegationForm` function, lines 6–14):
```tsx
function NewDelegationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState(searchParams.get('reason') ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
```

Replace the entire file with:

```tsx
'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiRequest } from '@/lib/api';

type BranchUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  login: string;
};

function NewDelegationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState(searchParams.get('reason') ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [staffUsers, setStaffUsers] = useState<BranchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    const branchId: string = user.branchId ?? '';

    apiRequest<BranchUser[]>(`/users/by-branch/${branchId}`, {}, token)
      .then((res) => setStaffUsers(res.data.filter((u) => u.role !== 'student')))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Sabab maydoni majburiy');
      return;
    }
    setError('');
    setSubmitting(true);

    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');

    try {
      await apiRequest('/delegations', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: user.tenantId ?? '',
          branchId: user.tenantId ?? '',
          fromUserId: user.id ?? '',
          toUserId: selectedRecipient,
          delegatedRole: 'manager',
          permissions: ['warnings', 'payments'],
          reason,
          startsAt,
          endsAt,
        }),
      }, token);
      router.push('/delegations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Yangi Delegatsiya</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Oluvchi xodim *</label>
          <select
            value={selectedRecipient}
            onChange={(e) => setSelectedRecipient(e.target.value)}
            disabled={loadingUsers}
            className="w-full border rounded-lg px-3 py-2 disabled:bg-gray-50"
            required
          >
            <option value="">
              {loadingUsers ? 'Yuklanmoqda...' : 'Tanlang...'}
            </option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Boshlanish</label>
            <input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tugash</label>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
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
          disabled={submitting}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium disabled:opacity-60"
        >
          {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
        </button>
      </form>
    </div>
  );
}

export default function NewDelegationPage() {
  return (
    <Suspense fallback={null}>
      <NewDelegationForm />
    </Suspense>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/delegations/new/page.tsx
git commit -m "feat: wire real branch users into delegations/new recipient selector"
```

---

## Final Verification

- [ ] **Run full TypeScript check one more time**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: 0 errors across all 5 changed files.
