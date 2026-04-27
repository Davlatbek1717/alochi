# Mentor Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mentor dashboard'ni to'liq ishlaydigan sahifaga aylantirish, sinf sahifasidagi `groupId` bugini tuzatish, va o'quvchi xato tahlili sahifasini yaratish.

**Architecture:** `branchId` (JWT'dan mavjud) orqali o'quvchilar ro'yxati olinadi — alohida group endpoint kerak emas. Dashboard parallel API chaqiruvlar bilan KPI, o'quvchilar soni, vazifalar va davomat holatini ko'rsatadi. Student detail sahifasi `/ai/analyze-errors` dan xato tahlilini oladi.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, `lucide-react`, `apiRequest` helper (`apps/web/lib/api.ts`)

---

## Muhim kontekst

- JWT payload: `{ sub, role, tenantId, branchId }` — `groupId` **yo'q**
- `mentor/group/page.tsx` hozir buzilgan: `getGroupIdFromToken()` `null` qaytaradi
- O'quvchilarni olish: `GET /users/by-branch/:branchId` → `role === 'student'` filtri
- KPI endpointlar: `GET /kpi/today` (raqam qaytaradi), `GET /kpi/monthly?year=2026&month=4`
- Error analysis: `GET /ai/analyze-errors?studentId={id}` — mentor roli ruxsat berilgan
- `GET /users/:id` — mentor uchun ruxsat **yo'q** (faqat manager+)

---

## Fayl tuzilishi

| Fayl | Amal | Vazifa |
|------|------|--------|
| `apps/web/app/(dashboard)/mentor/page.tsx` | O'zgartirish | Dashboard — KPI ring, stat kartochkalar, nav |
| `apps/web/app/(dashboard)/mentor/group/page.tsx` | Tuzatish | `groupId` → `branchId`, branchId bug fix, "Xato tahlili" havolasi |
| `apps/web/app/(dashboard)/mentor/students/[id]/page.tsx` | Yaratish | Student xato tahlili sahifasi |
| `apps/web/package.json` | O'zgartirish | `lucide-react` dependency qo'shish |

---

## Task 1: lucide-react o'rnatish

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Paketni o'rnatish**

```bash
cd apps/web && npm install lucide-react
```

Expected output: `added 1 package` yoki o'xshash.

- [ ] **Step 2: Import to'g'ri ishlashini tekshirish**

```bash
cd apps/web && node -e "require('lucide-react'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "feat: add lucide-react to web app"
```

---

## Task 2: mentor/group/page.tsx tuzatish

**Files:**
- Modify: `apps/web/app/(dashboard)/mentor/group/page.tsx`

**Muammo**: Mavjud kod `getGroupIdFromToken()` ishlatadi — lekin JWT'da `groupId` yo'q, faqat `branchId` bor. `saveAll` ichida ham `branchId: user.tenantId` xatosi bor.

- [ ] **Step 1: Butun faylni yangi versiyasi bilan almashtirish**

`apps/web/app/(dashboard)/mentor/group/page.tsx` faylini quyidagi kod bilan to'liq almashtiring:

```tsx
'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

type Status = 'green' | 'yellow' | 'red';

const STATUS_COLORS: Record<Status, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

const STATUS_UZ: Record<Status, string> = {
  green: 'yashil',
  yellow: 'sariq',
  red: 'qizil',
};

type LocalStudent = {
  id: string;
  name: string;
  status: Status;
  note: string;
  attendance: boolean;
};

type ApiStudent = {
  id: string;
  name: string;
  role: string;
};

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as {
      branchId?: string;
    };
    return payload.branchId ?? null;
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
      const branchId = getBranchIdFromToken();
      if (!branchId) throw new Error('Filial topilmadi');
      const res = await apiRequest<ApiStudent[]>(
        `/users/by-branch/${branchId}`,
        {},
        token,
      );
      const studentList = res.data
        .filter((u) => u.role === 'student')
        .map((s) => ({
          ...s,
          status: 'green' as Status,
          note: '',
          attendance: true,
        }));
      setStudents(studentList);
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
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status, note: status === 'green' ? '' : s.note } : s,
      ),
    );
  }

  function updateNote(id: string, note: string) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, note } : s)));
  }

  function toggleAttendance(id: string) {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, attendance: !s.attendance } : s)),
    );
  }

  async function saveAll() {
    setSaveError('');
    const token = localStorage.getItem('accessToken') ?? '';
    const userRaw = localStorage.getItem('user') ?? '{}';
    const user = JSON.parse(userRaw) as {
      id?: string;
      tenantId?: string;
      branchId?: string;
    };
    const branchId = getBranchIdFromToken() ?? user.branchId ?? '';
    const today = new Date().toISOString().split('T')[0];

    try {
      await apiRequest(
        '/attendance/students/bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            records: students.map((s) => ({
              studentId: s.id,
              status: s.attendance ? 'present' : 'absent',
              markedBy: user.id ?? '',
              tenantId: user.tenantId ?? '',
              branchId,
              date: today,
            })),
          }),
        },
        token,
      );

      await Promise.all(
        students.map((s) =>
          apiRequest(
            '/status',
            {
              method: 'POST',
              body: JSON.stringify({
                studentId: s.id,
                date: today,
                personalStatus: STATUS_UZ[s.status],
                personalNote: s.note || undefined,
              }),
            },
            token,
          ),
        ),
      );

      localStorage.setItem(`attendance_marked_${today}`, '1');
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
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 h-16 animate-pulse" />
        ))}
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
          <div
            key={student.id}
            className="bg-white rounded-xl p-4 shadow-sm space-y-2"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => toggleAttendance(student.id)}
                className={`w-10 h-10 rounded-full border-2 font-bold text-sm shrink-0 ${
                  student.attendance
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 text-gray-400'
                }`}
              >
                {student.attendance ? '✓' : '✗'}
              </button>

              <div className="flex-1">
                <p className="font-medium">{student.name}</p>
                <Link
                  href={`/mentor/students/${student.id}`}
                  className="text-xs text-indigo-600 font-medium"
                >
                  Xato tahlili →
                </Link>
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

            {student.status !== 'green' && (
              <input
                type="text"
                placeholder="Izoh (ixtiyoriy)..."
                value={student.note}
                onChange={(e) => updateNote(student.id, e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript tekshirish**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "mentor/group" | head -10
```

Expected: hech qanday xato yo'q.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/mentor/group/page.tsx
git commit -m "fix: mentor group page — use branchId, fix saveAll branchId bug, add error analysis link"
```

---

## Task 3: Mentor Dashboard (`mentor/page.tsx`)

**Files:**
- Modify: `apps/web/app/(dashboard)/mentor/page.tsx`

**API chaqiruvlar:**
- `GET /kpi/today` → `number` (bugungi KPI)
- `GET /kpi/monthly?year=YYYY&month=M` → `number` (oylik KPI)
- `GET /users/by-branch/:branchId` → `{id, name, role}[]` → `role === 'student'` filtri
- `GET /tasks/my` → `Task[]` → pending soni: `status !== 'done' && status !== 'confirmed'`
- Davomat: `localStorage.getItem('attendance_marked_' + today) === '1'`

- [ ] **Step 1: mentor/page.tsx ni to'liq almashtirish**

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Users,
  ClipboardList,
  Star,
  BarChart2,
  GraduationCap,
  CheckCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Task = { id: string; status: string };
type Student = { id: string; name: string; role: string };

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    return payload.branchId ?? null;
  } catch {
    return null;
  }
}

export default function MentorDashboard() {
  const router = useRouter();
  const [kpiToday, setKpiToday] = useState<number>(0);
  const [kpiMonthly, setKpiMonthly] = useState<number>(0);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [pendingTasks, setPendingTasks] = useState<number>(0);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [mentorName, setMentorName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const branchId = getBranchIdFromToken();
    const userRaw = localStorage.getItem('user') ?? '{}';
    const user = JSON.parse(userRaw) as { name?: string };
    setMentorName(user.name ?? '');

    const today = new Date().toISOString().split('T')[0];
    setAttendanceMarked(localStorage.getItem(`attendance_marked_${today}`) === '1');

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    Promise.all([
      apiRequest<number>('/kpi/today', {}, token).catch(() => ({ data: 0 })),
      apiRequest<number>(`/kpi/monthly?year=${year}&month=${month}`, {}, token).catch(() => ({ data: 0 })),
      branchId
        ? apiRequest<Student[]>(`/users/by-branch/${branchId}`, {}, token).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
      apiRequest<Task[]>('/tasks/my', {}, token).catch(() => ({ data: [] })),
    ]).then(([kpiT, kpiM, studentsRes, tasksRes]) => {
      setKpiToday((kpiT as { data: number }).data ?? 0);
      setKpiMonthly((kpiM as { data: number }).data ?? 0);
      const allStudents = (studentsRes as { data: Student[] }).data ?? [];
      setStudentCount(allStudents.filter((u) => u.role === 'student').length);
      const allTasks = (tasksRes as { data: Task[] }).data ?? [];
      setPendingTasks(
        allTasks.filter(
          (t) => t.status !== 'done' && t.status !== 'confirmed',
        ).length,
      );
    }).finally(() => setLoading(false));
  }, []);

  const today = new Date();
  const dateStr = today.toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  });

  const kpiTarget = 50;
  const kpiPercent = Math.min(100, Math.round((kpiToday / kpiTarget) * 100));
  const circumference = 2 * Math.PI * 26;
  const strokeDashoffset = circumference - (circumference * kpiPercent) / 100;

  const navCards = [
    {
      href: '/mentor/group',
      icon: <Users size={22} />,
      title: 'Guruh',
      desc: 'Holat belgilash',
      color: 'hover:border-emerald-300 hover:bg-emerald-50',
    },
    {
      href: '/mentor/attendance',
      icon: <BarChart2 size={22} />,
      title: 'Davomat',
      desc: 'Kunlik qatnashish',
      color: 'hover:border-blue-300 hover:bg-blue-50',
    },
    {
      href: '/mentor/tasks',
      icon: <ClipboardList size={22} />,
      title: 'Vazifalar',
      desc: "Mening topshiriqlar",
      color: 'hover:border-orange-300 hover:bg-orange-50',
    },
    {
      href: '/mentor/students',
      icon: <GraduationCap size={22} />,
      title: "O'quvchilar",
      desc: 'Xato tahlili',
      color: 'hover:border-purple-300 hover:bg-purple-50',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-0 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />

        <div className="flex justify-between items-start mb-5 relative z-10">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">
              Xush kelibsiz
            </p>
            <p className="text-white text-xl font-bold">
              {mentorName || 'Mentor'}
            </p>
            <p className="text-[#475569] text-xs mt-1 font-mono">{dateStr}</p>
          </div>
          <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#94a3b8]">
            <Bell size={18} />
          </button>
        </div>

        {/* KPI Hero */}
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-2xl p-4 mb-[-20px] relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">
              Bugungi KPI
            </p>
            {loading ? (
              <div className="h-9 w-16 bg-white/10 rounded animate-pulse" />
            ) : (
              <p className="text-[#f59e0b] text-4xl font-black font-mono leading-none">
                {kpiToday}
              </p>
            )}
            <p className="text-[#f59e0b]/60 text-xs mt-1">
              Oylik: {kpiMonthly} ball
            </p>
          </div>

          <div className="relative w-16 h-16">
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              style={{ transform: 'rotate(-90deg)' }}
            >
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="rgba(245,158,11,0.12)"
                strokeWidth="5"
              />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="5"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-[#f59e0b] text-xs font-bold font-mono">
              {kpiPercent}%
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-8 pb-6 space-y-5">
        {/* Stat cards */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
            Statistika
          </p>
          <div className="grid grid-cols-3 gap-2">
            {/* Students */}
            <div className="bg-[#162032] rounded-[18px] p-3 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d9488]/50 rounded-b-[18px]" />
              <Users size={16} className="text-[#0d9488] mb-2" />
              {loading ? (
                <div className="h-7 w-10 bg-white/10 rounded animate-pulse" />
              ) : (
                <p className="text-white text-2xl font-black font-mono leading-none">
                  {studentCount}
                </p>
              )}
              <p className="text-[#94a3b8] text-[10px] mt-1 leading-tight">
                Guruh<br />a&apos;zolari
              </p>
            </div>

            {/* Pending tasks */}
            <div className="bg-[#162032] rounded-[18px] p-3 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#e11d48]/50 rounded-b-[18px]" />
              <ClipboardList size={16} className="text-[#e11d48] mb-2" />
              {loading ? (
                <div className="h-7 w-10 bg-white/10 rounded animate-pulse" />
              ) : (
                <p className="text-white text-2xl font-black font-mono leading-none">
                  {pendingTasks}
                </p>
              )}
              <p className="text-[#94a3b8] text-[10px] mt-1 leading-tight">
                Kutilayotgan<br />vazifa
              </p>
            </div>

            {/* Monthly KPI */}
            <div className="bg-[#162032] rounded-[18px] p-3 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#f59e0b]/50 rounded-b-[18px]" />
              <Star size={16} className="text-[#f59e0b] mb-2" />
              {loading ? (
                <div className="h-7 w-10 bg-white/10 rounded animate-pulse" />
              ) : (
                <p className="text-white text-2xl font-black font-mono leading-none">
                  {kpiMonthly}
                </p>
              )}
              <p className="text-[#94a3b8] text-[10px] mt-1 leading-tight">
                Oylik<br />ball
              </p>
            </div>

            {/* Attendance wide */}
            <div className="bg-[#162032] rounded-[18px] p-3 col-span-3 flex items-center gap-3 relative overflow-hidden">
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d9488]/50 rounded-b-[18px]" />
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  attendanceMarked
                    ? 'bg-[#0d9488]/15 border border-[#0d9488]/40'
                    : 'bg-[#f59e0b]/10 border border-[#f59e0b]/30'
                }`}
              >
                {attendanceMarked ? (
                  <CheckCircle size={18} className="text-[#0d9488]" />
                ) : (
                  <AlertCircle size={18} className="text-[#f59e0b]" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold">
                  {attendanceMarked
                    ? 'Bugungi davomat belgilandi'
                    : 'Davomat belgilanmagan'}
                </p>
                <p className="text-[#94a3b8] text-xs mt-0.5">
                  {attendanceMarked ? 'Guruh sahifasidan ko\'rish' : 'Guruh sahifasiga o\'ting'}
                </p>
              </div>
              <button
                onClick={() => router.push('/mentor/group')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                  attendanceMarked
                    ? 'bg-white/5 border border-white/10 text-[#94a3b8]'
                    : 'bg-[#0d9488] text-white'
                }`}
              >
                {attendanceMarked ? "Ko'rish" : 'Belgilash'}
              </button>
            </div>
          </div>
        </div>

        {/* Nav cards */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
            Tezkor navigatsiya
          </p>
          <div className="grid grid-cols-2 gap-3">
            {navCards.map((card) => (
              <button
                key={card.href}
                onClick={() => router.push(card.href)}
                className={`bg-white rounded-[18px] p-4 flex items-center gap-3 border-[1.5px] border-[#ede9e1] transition-all text-left ${card.color}`}
              >
                <div className="w-11 h-11 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#0f172a] shrink-0">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0f172a] text-sm font-bold truncate">
                    {card.title}
                  </p>
                  <p className="text-[#64748b] text-xs mt-0.5 truncate">
                    {card.desc}
                  </p>
                </div>
                <ChevronRight size={16} className="text-[#94a3b8] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript tekshirish**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "mentor/page" | head -10
```

Expected: hech qanday xato.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/mentor/page.tsx
git commit -m "feat: mentor dashboard — KPI ring, stat cards, nav cards"
```

---

## Task 4: Student detail sahifasi (`mentor/students/[id]/page.tsx`)

**Files:**
- Create: `apps/web/app/(dashboard)/mentor/students/[id]/page.tsx`

**Logic:**
- `branchId` JWT'dan olinadi
- `GET /users/by-branch/:branchId` → student nomi topiladi (id bo'yicha)
- `GET /ai/analyze-errors?studentId={id}` → `{ weakAreas: string[]; recommendation: string }`
- `weakAreas` bo'sh bo'lsa → "Hali yetarli ma'lumot yo'q" ko'rsatiladi

- [ ] **Step 1: Katalog va faylni yaratish**

```bash
mkdir -p "apps/web/app/(dashboard)/mentor/students/[id]"
```

Keyin `apps/web/app/(dashboard)/mentor/students/[id]/page.tsx` faylini yarating:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type AnalysisResult = {
  weakAreas: string[];
  recommendation: string;
};

type Student = { id: string; name: string; role: string };

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as {
      branchId?: string;
    };
    return payload.branchId ?? null;
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [studentName, setStudentName] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const branchId = getBranchIdFromToken();

    const fetchStudentName = branchId
      ? apiRequest<Student[]>(`/users/by-branch/${branchId}`, {}, token)
          .then((res) => {
            const found = res.data.find((u) => u.id === studentId);
            if (found) setStudentName(found.name);
          })
          .catch(() => {})
      : Promise.resolve();

    const fetchAnalysis = apiRequest<AnalysisResult>(
      `/ai/analyze-errors?studentId=${studentId}`,
      {},
      token,
    )
      .then((res) => setAnalysis(res.data))
      .catch(() => setError("Tahlil ma'lumotlarini yuklab bo'lmadi"))
      .finally(() => setLoadingAnalysis(false));

    Promise.all([fetchStudentName, fetchAnalysis]);
  }, [studentId]);

  const severityColor = (index: number) => {
    if (index === 0) return { dot: 'bg-[#e11d48] shadow-[0_0_6px_rgba(225,29,72,0.4)]', bar: 'bg-[#e11d48]' };
    if (index === 1) return { dot: 'bg-[#e11d48] shadow-[0_0_6px_rgba(225,29,72,0.3)]', bar: 'bg-[#e11d48]' };
    if (index === 2) return { dot: 'bg-[#f59e0b] shadow-[0_0_6px_rgba(245,158,11,0.4)]', bar: 'bg-[#f59e0b]' };
    return { dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]', bar: 'bg-emerald-500' };
  };

  const barWidth = (index: number, total: number) => {
    if (total === 0) return '0%';
    const widths = [80, 60, 40, 20];
    return `${widths[index] ?? Math.max(10, 80 - index * 15)}%`;
  };

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 left-0 w-44 h-44 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
            transform: 'translate(-30%, -30%)',
          }}
        />

        <button
          onClick={() => router.push('/mentor/group')}
          className="flex items-center gap-2 text-[#94a3b8] text-sm font-medium mb-5 relative z-10"
        >
          <ArrowLeft size={16} />
          Guruhga qaytish
        </button>

        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-xl font-black shrink-0">
            {studentName ? getInitials(studentName) : '?'}
          </div>
          <div>
            <p className="text-white text-lg font-bold">
              {studentName || 'Yuklanmoqda...'}
            </p>
            <div className="flex gap-2 mt-1">
              <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-white/7 border border-white/10 text-[#94a3b8]">
                o&apos;quvchi
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* AI Analysis Card */}
        <div className="bg-gradient-to-br from-[#1e1b4b] to-[#1e293b] rounded-[18px] p-4 border border-purple-900/30 relative overflow-hidden">
          <div
            className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-20"
            style={{
              background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
              transform: 'translate(30%, -30%)',
            }}
          />
          <div className="flex items-center gap-2 mb-3 relative z-10">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">
              AI Tahlil
            </span>
          </div>

          {loadingAnalysis ? (
            <div className="space-y-2 relative z-10">
              <div className="h-4 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-4 bg-white/10 rounded animate-pulse w-4/5" />
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 relative z-10">
              <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-amber-300/80 text-sm">
                {error}
              </p>
            </div>
          ) : analysis?.recommendation ? (
            <p className="text-white/85 text-sm leading-relaxed relative z-10">
              {analysis.recommendation}
            </p>
          ) : (
            <p className="text-[#94a3b8] text-sm relative z-10">
              Hali yetarli ma&apos;lumot yo&apos;q (kamida 5 ta xato kerak).
            </p>
          )}
        </div>

        {/* Weak Areas */}
        {!loadingAnalysis && analysis && analysis.weakAreas.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
              Kuchsiz mavzular
            </p>
            <div className="space-y-2">
              {analysis.weakAreas.map((topic, index) => {
                const colors = severityColor(index);
                const width = barWidth(index, analysis.weakAreas.length);
                return (
                  <div key={topic}>
                    <div className="bg-white rounded-[14px] px-4 py-3 flex items-center gap-3 border-[1.5px] border-[#ede9e1]">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`}
                      />
                      <p className="flex-1 text-[#0f172a] text-sm font-semibold">
                        {topic}
                      </p>
                      <span className="text-xs font-mono font-semibold text-[#64748b] bg-[#f7f4ef] px-2 py-0.5 rounded-full">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="px-4 -mt-1">
                      <div className="h-1 bg-[#ede9e1] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors.bar}`}
                          style={{ width }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No data state */}
        {!loadingAnalysis && !error && analysis?.weakAreas.length === 0 && (
          <div className="bg-white rounded-[18px] p-8 text-center border-[1.5px] border-[#ede9e1]">
            <p className="text-4xl mb-3">📊</p>
            <p className="text-[#0f172a] font-semibold">Hali yetarli ma&apos;lumot yo&apos;q</p>
            <p className="text-[#64748b] text-sm mt-1">
              O&apos;quvchi kamida 5 ta savol javob berganda tahlil paydo bo&apos;ladi.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript tekshirish**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "mentor/students" | head -10
```

Expected: hech qanday xato.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(dashboard)/mentor/students"
git commit -m "feat: mentor student error analysis page"
```

---

## Task 5: To'liq TypeScript build tekshirish

**Files:** Hech narsa o'zgarmaydi — faqat tekshirish.

- [ ] **Step 1: To'liq build**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. Agar xatolar bo'lsa — tuzating (hech qachon `// @ts-ignore` qo'shmang).

- [ ] **Step 2: ESLint**

```bash
cd apps/web && npx next lint 2>&1 | tail -10
```

Expected: `✔ No ESLint warnings or errors` yoki faqat warnings (errors bo'lmasin).

- [ ] **Step 3: Final commit**

```bash
git add -A
git status
git commit -m "chore: mentor frontend complete — dashboard, group fix, student detail"
```

---

## Qo'lda test qilish

1. Mentor hisobi bilan login qiling
2. `/mentor` → Dashboard ko'rinadi: KPI ring, 3 stat kartochka, davomat, 4 nav kartochka
3. "Guruh" kartochkasiga bosing → `/mentor/group` — o'quvchilar ro'yxati, har birida "Xato tahlili →" havolasi bor
4. "Saqlash" bosing → localStorage'da `attendance_marked_YYYY-MM-DD` kaliti o'rnatiladi
5. `/mentor` ga qaytish → Davomat kartochkasi "✅ Belgilandi" ko'rsatadi
6. "Xato tahlili →" → `/mentor/students/{id}` — AI tahlil + kuchsiz mavzular
7. `branchId` yo'q mentor: Dashboard "0 o'quvchi" ko'rsatadi (crash yo'q)
