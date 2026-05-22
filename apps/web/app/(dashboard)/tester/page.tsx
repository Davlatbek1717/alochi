'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  ClipboardList,
  CheckCircle,
  ChevronRight,
  Target,
  CalendarDays,
  FlaskConical,
  Wrench,
  Clock,
  PlayCircle,
  Hourglass,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken } from '@/lib/jwt';
import { formatDateWeekday } from '@/lib/date-uz';
import { tashkentToday } from '@/lib/tashkent-date';
import { Skeleton, useToast } from '@/components/ui';

type Task = { id: string; status: string; title: string; createdAt: string; senderName?: string };
type Student = { id: string; name: string; role: string };
type AttendanceRow = { studentId: string; status: string };
type ActiveExam = {
  id: string;
  studentId: string;
  status: string;
  grantedAt: string;
  student: { id: string; name: string };
  lesson: { id: string; title: string; orderNumber: number } | null;
  exam: { id: string; title: string } | null;
};

const KPI_TARGET_DAILY = 30;
const KPI_TARGET_MONTHLY = 600;

export default function TesterDashboard() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [kpiToday, setKpiToday] = useState(0);
  const [kpiMonthly, setKpiMonthly] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [presentToday, setPresentToday] = useState(0);
  const [pendingExams, setPendingExams] = useState<ActiveExam[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [testerName, setTesterName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const branchId = getBranchIdFromToken();
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { name?: string };
    setTesterName(user.name ?? '');

    const today = tashkentToday();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // A5: use allSettled so individual failures show error banner, not swallowed silently
    Promise.allSettled([
      apiRequest<number>('/kpi/daily', {}, token),
      apiRequest<number>(`/kpi/monthly?year=${year}&month=${month}`, {}, token),
      branchId
        ? apiRequest<Student[]>(`/users?branchId=${branchId}&role=student`, {}, token)
        : Promise.resolve({ data: [] as Student[] }),
      branchId
        ? apiRequest<AttendanceRow[]>(`/attendance/students/${branchId}/${today}`, {}, token)
        : Promise.resolve({ data: [] as AttendanceRow[] }),
      apiRequest<ActiveExam[]>('/exams/branch/active', {}, token),
      apiRequest<Task[]>('/tasks/my', {}, token),
    ])
      .then(([kpiT, kpiM, studentsRes, attRes, examsRes, tasksRes]) => {
        let anyFailed = false;

        if (kpiT.status === 'fulfilled') {
          setKpiToday((kpiT.value as { data: number }).data ?? 0);
        } else { anyFailed = true; }

        if (kpiM.status === 'fulfilled') {
          setKpiMonthly((kpiM.value as { data: number }).data ?? 0);
        } else { anyFailed = true; }

        if (studentsRes.status === 'fulfilled') {
          setStudentCount((studentsRes.value.data ?? []).length);
        } else { anyFailed = true; }

        if (attRes.status === 'fulfilled') {
          setPresentToday(
            (attRes.value.data ?? []).filter((a) => a.status === 'present' || a.status === 'late').length,
          );
        } else { anyFailed = true; }

        if (examsRes.status === 'fulfilled') {
          setPendingExams(examsRes.value.data ?? []);
        } else { anyFailed = true; }

        if (tasksRes.status === 'fulfilled') {
          const incoming = (tasksRes.value.data ?? []).filter(
            (t) => t.status !== 'done' && t.status !== 'confirmed',
          );
          setPendingTasks(incoming);
        } else { anyFailed = true; }

        if (anyFailed) {
          setLoadError(true);
          toastError("Ba'zi ma'lumotlar yuklanmadi — qayta urinib ko'ring");
        }
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateStr = formatDateWeekday(new Date());
  const kpiPercent = Math.min(100, Math.round((kpiToday / KPI_TARGET_DAILY) * 100));
  const monthlyPercent = Math.min(100, Math.round((kpiMonthly / KPI_TARGET_MONTHLY) * 100));
  const circumference = 2 * Math.PI * 32;
  const strokeDashoffset = circumference - (circumference * kpiPercent) / 100;

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Xayrli tong';
    if (hour < 18) return 'Xayrli kun';
    return 'Xayrli kech';
  }, []);

  // Tester is dedicated supervisory staff — the dashboard surfaces
  // exam-queue throughput, branch attendance, KPI progress, and
  // outstanding tasks. The first card (exam queue) is always primary
  // because that's the tester's lead daily task; everything else is
  // a quick-tap from the same grid.
  const navCards = [
    {
      href: '/tester/exam-queue',
      icon: <FlaskConical size={20} />,
      title: 'Imtihon navbati',
      desc: pendingExams.length > 0
        ? `${pendingExams.length} ta navbatda`
        : 'Bugungi imtihon ro\'yxati',
      tint: 'text-amber-700 bg-amber-50 border-amber-200',
      hoverBorder: 'hover:border-amber-300',
      badge: pendingExams.length > 0 ? pendingExams.length : undefined,
    },
    {
      href: '/tester/lessons/current',
      icon: <PlayCircle size={20} />,
      title: 'Sinov darsi',
      desc: 'Talabalardan oldin sinab ko\'rish',
      tint: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      hoverBorder: 'hover:border-emerald-300',
    },
    {
      href: '/tester/tasks',
      icon: <ClipboardList size={20} />,
      title: 'Vazifalar',
      desc: pendingTasks.length > 0
        ? `${pendingTasks.length} ta kutilmoqda`
        : 'Mening topshiriqlarim',
      tint: 'text-blue-700 bg-blue-50 border-blue-200',
      hoverBorder: 'hover:border-blue-300',
      badge: pendingTasks.length > 0 ? pendingTasks.length : undefined,
    },
    {
      href: '/tester/tech-issues',
      icon: <Wrench size={20} />,
      title: 'Texnik muammo',
      desc: 'Bug-report yuborish',
      tint: 'text-rose-700 bg-rose-50 border-rose-200',
      hoverBorder: 'hover:border-rose-300',
    },
  ];

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-12">
      {/* Header — staff amber accent on dark navy */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 space-y-4">
          {/* Greeting */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[#94a3b8] text-[11px] font-bold uppercase tracking-widest">
                {greeting} · Tester
              </p>
              <p className="text-white text-xl font-extrabold truncate">
                {testerName || 'Tester'}
              </p>
              <p className="text-[#475569] text-[11px] mt-0.5 font-bold inline-flex items-center gap-1.5">
                <CalendarDays size={11} /> {dateStr}
              </p>
            </div>
          </div>

          {/* KPI hero card — same shape as mentor for visual parity */}
          <div className="bg-[#162032] border border-white/5 rounded-3xl p-4 flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                style={{ transform: 'rotate(-90deg)' }}
              >
                <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(245,158,11,0.12)" strokeWidth="6" />
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 600ms ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {loading ? (
                  <span className="text-[#f59e0b] text-xs font-bold">...</span>
                ) : (
                  <>
                    <span className="text-[#f59e0b] text-xl font-extrabold leading-none font-mono">
                      {kpiToday}
                    </span>
                    <span className="text-[#f59e0b]/60 text-[9px] font-bold uppercase tracking-wider">
                      ball
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Target size={12} className="text-[#f59e0b]" />
                <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">
                  Bugungi maqsad
                </p>
              </div>
              <p className="text-white text-base font-extrabold">
                {kpiToday} / {KPI_TARGET_DAILY}{' '}
                <span className="text-[#94a3b8] font-bold text-xs">({kpiPercent}%)</span>
              </p>
              <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] rounded-full transition-all duration-500"
                  style={{ width: `${kpiPercent}%` }}
                />
              </div>
              <p className="text-[#94a3b8] text-[10px] mt-1 font-bold">
                Oylik: {kpiMonthly} / {KPI_TARGET_MONTHLY} ball ({monthlyPercent}%)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-6 space-y-5">
        {/* A5: partial load error banner */}
        {loadError && !loading && (
          <div className="bg-rose-50 border-[1.5px] border-rose-200 rounded-2xl px-4 py-3">
            <p className="text-rose-700 text-sm font-bold">
              Ba&apos;zi ma&apos;lumotlar yuklanmadi. Sahifani yangilang yoki qayta urinib ko&apos;ring.
            </p>
          </div>
        )}

        {/* Today snapshot — exam queue lead, then 3 stat tiles */}
        <section>
          <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
            Bugungi holat
          </p>

          {/* Big exam-queue card with live count */}
          <button
            type="button"
            onClick={() => router.push('/tester/exam-queue')}
            className={`w-full text-left rounded-2xl border-[1.5px] p-4 flex items-center gap-3 transition-colors ${
              pendingExams.length > 0
                ? 'bg-amber-50 border-amber-200 hover:border-amber-300'
                : 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                pendingExams.length > 0
                  ? 'bg-amber-500 text-white motion-safe:animate-pulse'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {pendingExams.length > 0 ? (
                <Hourglass size={20} />
              ) : (
                <CheckCircle size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-extrabold ${
                  pendingExams.length > 0 ? 'text-amber-900' : 'text-emerald-800'
                }`}
              >
                {pendingExams.length > 0
                  ? `${pendingExams.length} ta o'quvchi navbatda`
                  : 'Navbat bo\'sh'}
              </p>
              <p
                className={`text-[11px] font-bold mt-0.5 ${
                  pendingExams.length > 0 ? 'text-amber-800/70' : 'text-emerald-700/70'
                }`}
              >
                {pendingExams.length > 0
                  ? "Imtihon navbati sahifasiga o'ting"
                  : "Hech kim imtihon kutilmayapti"}
              </p>
            </div>
            <ChevronRight
              size={18}
              className={pendingExams.length > 0 ? 'text-amber-800/50' : 'text-emerald-700/50'}
            />
          </button>

          {/* 3-tile compact stat grid */}
          {loading ? (
            <div className="grid grid-cols-3 gap-1 sm:gap-2 mt-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} theme="light" className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 sm:gap-2 mt-2">
              <SnapshotTile
                icon={<Users size={16} />}
                value={studentCount}
                label="O'quvchilar"
                tint="text-blue-700"
                bg="bg-blue-50 border-blue-100"
              />
              <SnapshotTile
                icon={<CheckCircle size={16} />}
                value={presentToday}
                label="Bugun keldi"
                tint="text-emerald-700"
                bg="bg-emerald-50 border-emerald-100"
              />
              <SnapshotTile
                icon={<Clock size={16} />}
                value={pendingExams.length}
                label="Navbatda"
                tint="text-amber-700"
                bg="bg-amber-50 border-amber-100"
              />
            </div>
          )}
        </section>

        {/* Pending exam queue preview — first 3 names so the tester
            knows who's up next without leaving the dashboard. */}
        {!loading && pendingExams.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
                Keyingi imtihon topshiruvchilar
              </p>
              <Link
                href="/tester/exam-queue"
                className="text-[11px] font-bold text-[#f59e0b] hover:underline min-h-[36px] inline-flex items-center px-2 -mr-2"
              >
                Barchasi →
              </Link>
            </div>
            <ul className="space-y-2">
              {pendingExams.slice(0, 3).map((p) => {
                const subjectTitle = p.exam?.title ?? p.lesson?.title ?? 'Imtihon';
                const subjectKind = p.exam ? 'Katalog' : 'Dars';
                return (
                  <li
                    key={p.id}
                    className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-4 py-3 flex items-center gap-3"
                  >
                    <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 font-black text-xs shrink-0">
                      {p.student.name
                        .split(' ')
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-extrabold text-[#0f172a] truncate">
                        {p.student.name}
                      </p>
                      <p className="text-[11px] text-[#64748b] font-bold truncate">
                        <span className="text-amber-700">{subjectKind}</span> · {subjectTitle}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Quick action grid */}
        <section>
          <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
            Tezkor harakatlar
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {navCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`relative bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 flex flex-col gap-2 transition-colors ${card.hoverBorder}`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border-[1.5px] ${card.tint}`}
                >
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-extrabold text-sm text-[#0f172a]">{card.title}</p>
                  <p className="text-[11px] font-bold text-[#64748b] truncate mt-0.5">
                    {card.desc}
                  </p>
                </div>
                {card.badge !== undefined && (
                  <span className="absolute top-3 right-3 bg-rose-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                    {card.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* Outstanding tasks — last 3 incoming, link to full list */}
        {!loading && pendingTasks.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5 px-1">
              <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
                Yangi vazifalar
              </p>
              <Link
                href="/tester/tasks"
                className="text-[11px] font-bold text-[#f59e0b] hover:underline min-h-[36px] inline-flex items-center px-2 -mr-2"
              >
                Barchasi →
              </Link>
            </div>
            <ul className="space-y-2">
              {pendingTasks.slice(0, 3).map((t) => (
                <li
                  key={t.id}
                  className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                    <ClipboardList size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold text-[#0f172a] truncate">{t.title}</p>
                    <p className="text-[11px] text-[#64748b] font-bold truncate">
                      {t.senderName ? `${t.senderName} · ` : ''}
                      {new Date(t.createdAt).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                    Yangi
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Empty all-clear hint — both queue and tasks empty */}
        {!loading && pendingExams.length === 0 && pendingTasks.length === 0 && (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={22} className="text-emerald-600" />
            </div>
            <p className="text-sm font-extrabold text-[#0f172a]">Hammasi tayyor</p>
            <p className="text-[11px] font-bold text-[#64748b] mt-1">
              Imtihon navbatida hech kim yo&apos;q va yangi vazifalar yo&apos;q
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SnapshotTileProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  tint: string;
  bg: string;
}

function SnapshotTile({ icon, value, label, tint, bg }: SnapshotTileProps) {
  return (
    <div className={`rounded-2xl border-[1.5px] ${bg} p-3 flex flex-col gap-1.5 min-w-0`}>
      <div className={`w-7 h-7 rounded-lg bg-white/70 flex items-center justify-center ${tint}`}>
        {icon}
      </div>
      <p className="text-xl font-extrabold text-[#0f172a] font-mono leading-none">{value}</p>
      <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider truncate">
        {label}
      </p>
    </div>
  );
}

