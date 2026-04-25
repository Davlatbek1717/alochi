# Plan 10: Navigation & UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop sidebar with a role-based mobile bottom tab bar, add iOS safe-area support throughout, and connect student/mentor/manager pages to real API endpoints.

**Architecture:** A new `BottomNav` client component reads the role from the JWT in localStorage and renders role-specific tabs. The dashboard layout drops the `<aside>` sidebar in favour of a compact header plus BottomNav fixed at the bottom. Three pages swap hardcoded mock data for `apiRequest` calls.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, React (`usePathname`, `useRouter`, `useEffect`, `useState`, `useCallback`)

---

## File Map

| Action | Path |
|--------|------|
| Create | `apps/web/app/(dashboard)/_components/BottomNav.tsx` |
| Modify | `apps/web/app/(dashboard)/layout.tsx` |
| Modify | `apps/web/app/layout.tsx` |
| Modify | `apps/web/app/globals.css` |
| Modify | `apps/web/app/(dashboard)/student/page.tsx` |
| Modify | `apps/web/app/(dashboard)/mentor/group/page.tsx` |
| Modify | `apps/web/app/(dashboard)/manager/page.tsx` |

---

### Task 1: iOS viewport meta tags + global CSS touch fixes

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Replace the entire root layout**

Replace `apps/web/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alochi",
  description: "Alochi Learning Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Add iOS CSS fixes to globals.css**

Append these lines at the end of `apps/web/app/globals.css`:

```css
* {
  -webkit-tap-highlight-color: transparent;
}

input,
textarea,
select {
  font-size: 16px;
}
```

- [ ] **Step 3: Verify TypeScript**

Run in `apps/web`:
```bash
npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "feat: add iOS viewport meta tags and touch CSS fixes"
```

---

### Task 2: BottomNav component

**Files:**
- Create: `apps/web/app/(dashboard)/_components/BottomNav.tsx`

- [ ] **Step 1: Create the BottomNav component**

Create `apps/web/app/(dashboard)/_components/BottomNav.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const NAV_TABS: Record<string, { href: string; icon: string; label: string }[]> = {
  student: [
    { href: '/student',         icon: '🏠', label: 'Bosh'      },
    { href: '/student/lessons', icon: '📚', label: 'Darslar'   },
    { href: '/student/friends', icon: '👥', label: "Do'stlar"  },
    { href: '/student/duel',    icon: '⚔️', label: 'Duel'      },
    { href: '/student/profile', icon: '👤', label: 'Profil'    },
  ],
  mentor: [
    { href: '/mentor',            icon: '🏠', label: 'Bosh'    },
    { href: '/mentor/group',      icon: '👨‍🎓', label: 'Guruh'  },
    { href: '/mentor/attendance', icon: '📊', label: 'Davomat' },
  ],
  tester: [
    { href: '/mentor',            icon: '🏠', label: 'Bosh'    },
    { href: '/mentor/group',      icon: '👨‍🎓', label: 'Guruh'  },
    { href: '/mentor/attendance', icon: '📊', label: 'Davomat' },
  ],
  manager: [
    { href: '/manager',             icon: '🏠', label: 'Bosh'        },
    { href: '/manager/students',    icon: '👥', label: "O'quvchilar" },
    { href: '/manager/delegations', icon: '📋', label: 'Delegatsiya' },
  ],
  filadmin: [
    { href: '/filadmin',            icon: '🏠', label: 'Bosh'           },
    { href: '/filadmin/attendance', icon: '✅', label: 'Davomat'        },
    { href: '/filadmin/payments',   icon: '💰', label: "To'lovlar"      },
    { href: '/filadmin/warnings',   icon: '⚠️', label: 'Ogohlantirish' },
  ],
  superadmin: [
    { href: '/superadmin',          icon: '🏠', label: 'Bosh'             },
    { href: '/superadmin/branches', icon: '🏢', label: 'Filiallar'        },
    { href: '/superadmin/users',    icon: '👤', label: 'Foydalanuvchilar' },
  ],
};

function getRoleFromToken(): string {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { role?: string };
    return payload.role ?? '';
  } catch {
    return '';
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState('');

  useEffect(() => {
    setRole(getRoleFromToken());
  }, []);

  const tabs = NAV_TABS[role] ?? [];
  if (tabs.length === 0) return null;

  function handleTabClick(href: string) {
    if (href === '/student/profile') {
      localStorage.clear();
      router.push('/login');
      return;
    }
    router.push(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)] px-2 pt-2 z-50">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== '/' && pathname.startsWith(tab.href + '/'));
          return (
            <button
              key={tab.href}
              onClick={() => handleTabClick(tab.href)}
              className={`relative flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center px-2 rounded-lg transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-600 rounded-full" />
              )}
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/_components/BottomNav.tsx
git commit -m "feat: add role-based BottomNav component with iOS safe area padding"
```

---

### Task 3: Dashboard layout — replace sidebar with BottomNav

**Files:**
- Modify: `apps/web/app/(dashboard)/layout.tsx`

The current layout has a `<aside>` with sidebar nav, user info header, and a logout button. Replace the entire file: remove the aside, add a compact sticky top header, and render `BottomNav` at the bottom. The `<main>` gets `pb-24` to clear the fixed nav bar.

- [ ] **Step 1: Replace the entire dashboard layout**

Replace `apps/web/app/(dashboard)/layout.tsx` with:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from './_components/BottomNav';

interface UserInfo {
  id: string;
  name: string;
  role: string;
  tenantId: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw) as UserInfo);
    } catch {
      // ignore parse errors
    }
  }, [router]);

  function handleLogout() {
    localStorage.clear();
    router.replace('/login');
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 truncate max-w-[70%]">
          {user?.name ?? '...'}
        </p>
        <button
          onClick={handleLogout}
          className="text-xs text-red-500 hover:text-red-700 font-medium"
        >
          Chiqish
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/layout.tsx
git commit -m "feat: replace sidebar with BottomNav in dashboard layout"
```

---

### Task 4: Student page — real API for streak and lessonProgress

**Files:**
- Modify: `apps/web/app/(dashboard)/student/page.tsx`

Currently `streak`, `hasShield`, and `lessonProgress` come from a `STATIC_DATA` constant. Add them to the existing `Promise.all` in `fetchData()`. `statuses` stays as `⚪` placeholder (Student Status module backend not yet built — Plan 3).

Sources:
- `GET /gamification/streak` → `{ streak: number, hasShield: boolean }`
- `GET /progress/my` → `unknown[]` — use `.length` as `lessonProgress`

- [ ] **Step 1: Replace the entire student page**

Replace `apps/web/app/(dashboard)/student/page.tsx` with:

```tsx
'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { XpBar } from './_components/XpBar';
import { StreakBadge } from './_components/StreakBadge';
import { DailyQuests } from './_components/DailyQuests';
import { SocialFeed } from './_components/SocialFeed';
import VirtualCity from './_components/VirtualCity';
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

export default function StudentDashboard() {
  const [xpData, setXpData] = useState<XpData>({ totalXp: 0, level: 'Novice', nextLevelXp: 5000 });
  const [quests, setQuests] = useState<Quest[]>([]);
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [lessonProgress, setLessonProgress] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [xpRes, questsRes, cityRes, streakRes, progressRes] = await Promise.all([
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<Quest[]>('/gamification/quests', {}, token),
          apiRequest<CityData>('/gamification/city', {}, token),
          apiRequest<StreakData>('/gamification/streak', {}, token),
          apiRequest<unknown[]>('/progress/my', {}, token),
        ]);
        setXpData(xpRes.data);
        setQuests(questsRes.data);
        setCityData(cityRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
        setLessonProgress(progressRes.data.length);
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
          { label: 'Ingliz tili', key: 'english' },
          { label: 'Shaxsiy', key: 'personal' },
          { label: 'Tanqidiy', key: 'critical' },
        ].map((s) => (
          <div key={s.key} className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-2xl">⚪</p>
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

      <div className="fixed bottom-20 left-0 right-0 px-4 max-w-lg mx-auto">
        <Link
          href="/student/lessons/current"
          className="block w-full bg-indigo-600 text-white py-4 rounded-2xl text-center font-bold shadow-lg"
        >
          ▶️ Bugungi Darsni Boshlash
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/student/page.tsx
git commit -m "feat: replace STATIC_DATA streak/lessonProgress with real API in student dashboard"
```

---

### Task 5: Mentor group page — replace MOCK_STUDENTS with real API

**Files:**
- Modify: `apps/web/app/(dashboard)/mentor/group/page.tsx`

Currently hardcodes `MOCK_STUDENTS`. Replace with `GET /users/group/:groupId` where `groupId` comes from the JWT payload. Add loading skeleton (3 placeholder rows) and an error state with a retry button. Students initialise with `status: 'green'` and `attendance: true` since the status API (Plan 3) is not built yet.

- [ ] **Step 1: Replace the entire mentor group page**

Replace `apps/web/app/(dashboard)/mentor/group/page.tsx` with:

```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

type Status = 'green' | 'yellow' | 'red';

const STATUS_COLORS: Record<Status, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

type LocalStudent = {
  id: string;
  name: string;
  status: Status;
  attendance: boolean;
};

type ApiStudent = {
  id: string;
  name: string;
};

type AttendanceRecord = {
  studentId: string;
  status: 'present' | 'absent';
  markedBy: string;
  tenantId: string;
  branchId: string;
  date: string;
};

function getGroupIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { groupId?: string };
    return payload.groupId ?? null;
  } catch {
    return null;
  }
}

export default function MentorGroupPage() {
  const [students, setStudents] = useState<LocalStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const groupId = getGroupIdFromToken();
      if (!groupId) throw new Error('Guruh topilmadi');
      const res = await apiRequest<ApiStudent[]>(`/users/group/${groupId}`, {}, token);
      setStudents(
        res.data.map((s) => ({ ...s, status: 'green' as Status, attendance: true })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  function updateStatus(id: string, status: Status) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  function toggleAttendance(id: string) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, attendance: !s.attendance } : s)));
  }

  async function saveAll() {
    setSaveError('');
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as {
      id?: string;
      tenantId?: string;
    };

    const records: AttendanceRecord[] = students.map((s) => ({
      studentId: s.id,
      status: s.attendance ? 'present' : 'absent',
      markedBy: user.id ?? '',
      tenantId: user.tenantId ?? '',
      branchId: user.tenantId ?? '',
      date: new Date().toISOString().split('T')[0],
    }));

    try {
      await apiRequest('/attendance/students/bulk', {
        method: 'POST',
        body: JSON.stringify({ records }),
      }, token);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-20 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 h-16 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Guruh</h1>
        <div className="bg-white rounded-xl p-6 text-center">
          <p className="text-red-500 mb-3">{error}</p>
          <button
            onClick={loadStudents}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Guruh</h1>
        <button
          onClick={saveAll}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          {saved ? '✅ Saqlandi' : 'Saqlash'}
        </button>
      </div>

      {saveError && <p className="text-red-500 text-sm">{saveError}</p>}

      <div className="space-y-2">
        {students.map((student) => (
          <div key={student.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
            <button
              onClick={() => toggleAttendance(student.id)}
              className={`w-10 h-10 rounded-full border-2 font-bold text-sm ${
                student.attendance
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'border-gray-300 text-gray-400'
              }`}
            >
              {student.attendance ? '✓' : '✗'}
            </button>

            <div className="flex-1">
              <p className="font-medium">{student.name}</p>
            </div>

            <div className="flex gap-1">
              {(['green', 'yellow', 'red'] as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(student.id, s)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    student.status === s
                      ? STATUS_COLORS[s] + ' ring-2 ring-offset-1'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s === 'green' ? '🟢' : s === 'yellow' ? '🟡' : '🔴'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/mentor/group/page.tsx
git commit -m "feat: replace MOCK_STUDENTS with real API in mentor group page"
```

---

### Task 6: Manager page — XP/streak widgets

**Files:**
- Modify: `apps/web/app/(dashboard)/manager/page.tsx`

Add a gamification widget card at the top (same pattern as student dashboard) that fetches `GET /gamification/xp` and `GET /gamification/streak`. Keep `RED_STUDENTS` and `YELLOW_STUDENTS` as mocks; replace `RED_STUDENTS.length` in the heading with `?` since `GET /status/red-students` is not built yet.

`XpBar` and `StreakBadge` live at `../student/_components/` — import from there (no duplication).

- [ ] **Step 1: Replace the entire manager page**

Replace `apps/web/app/(dashboard)/manager/page.tsx` with:

```tsx
'use client';
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

const RED_STUDENTS = [
  { id: '1', name: 'Sardor Rahimov', note: '3 kun kelmadi', days: 3 },
  { id: '2', name: 'Anvar Karimov', note: 'Status qizil 5 kun', days: 5 },
];

const YELLOW_STUDENTS = [
  { id: '3', name: 'Dilnoza Ergasheva', note: 'Dars bajarish pastlashdi', days: 2 },
];

export default function ManagerDashboard() {
  const [xpData, setXpData] = useState<XpData>({ totalXp: 0, level: 'Novice', nextLevelXp: 5000 });
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [xpRes, streakRes] = await Promise.all([
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<StreakData>('/gamification/streak', {}, token),
        ]);
        setXpData(xpRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
      } catch {
        // keep defaults on error
      }
    }

    fetchData();
  }, []);

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
          <h2 className="font-semibold text-red-700">🔴 Qizil O&apos;quvchilar (?)</h2>
        </div>
        <div className="divide-y">
          {RED_STUDENTS.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500">{s.note}</p>
              </div>
              <button className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm">
                1:1 Sessiya
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
          <h2 className="font-semibold text-yellow-700">🟡 Sariq O&apos;quvchilar ({YELLOW_STUDENTS.length})</h2>
        </div>
        <div className="divide-y">
          {YELLOW_STUDENTS.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500">{s.note}</p>
              </div>
              <button className="bg-yellow-600 text-white px-3 py-1 rounded-lg text-sm">
                Kuzatish
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/web && npx tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(dashboard)/manager/page.tsx
git commit -m "feat: add XP/streak widgets to manager dashboard, replace red count with ? placeholder"
```
