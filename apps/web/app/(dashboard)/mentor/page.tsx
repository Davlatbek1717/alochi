'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ClipboardList,
  Star,
  BarChart2,
  GraduationCap,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Target,
  CalendarDays,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken, getGroupIdFromToken } from '@/lib/jwt';
import { tashkentToday } from '@/lib/tashkent-date';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import { formatDateWeekday } from '@/lib/date-uz';
import { Skeleton } from '@/components/ui';
import VideoCheckinsPanel from '@/app/(dashboard)/_components/VideoCheckinsPanel';

type Task = { id: string; status: string };
type Student = { id: string; name: string; role: string };

const KPI_TARGET_DAILY = 50;
const KPI_TARGET_MONTHLY = 1000;

export default function MentorDashboard() {
  const router = useRouter();
  const [kpiToday, setKpiToday] = useState<number>(0);
  const [kpiMonthly, setKpiMonthly] = useState<number>(0);
  const [studentCount, setStudentCount] = useState<number>(0);
  const [pendingTasks, setPendingTasks] = useState<number>(0);
  const [confirmedTasks, setConfirmedTasks] = useState<number>(0);
  const [attendanceMarked, setAttendanceMarked] = useState(false);
  const [mentorName, setMentorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [branchIdForPanel, setBranchIdForPanel] = useState('');
  const [groupError, setGroupError] = useState('');

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const groupId = getGroupIdFromToken();
    const branchId = getBranchIdFromToken();
    if (branchId) setBranchIdForPanel(branchId);
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { name?: string };
    setMentorName(user.name ?? '');

    const today = tashkentToday();
    setAttendanceMarked(localStorage.getItem(`attendance_marked_${today}`) === '1');

    if (!groupId) {
      setGroupError('Guruh biriktirilmagan — superadmin orqali sizga guruh tayinlanishi kerak.');
      setLoading(false);
      return;
    }
    setGroupError('');

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const studentsPromise: Promise<{ data: Student[] }> = apiRequest<Student[]>(
      `/users/group/${groupId}`,
      {},
      token,
    ).catch(() => ({ data: [] as Student[] }));

    Promise.all([
      apiRequest<number>('/kpi/daily', {}, token).catch(() => ({ data: 0 })),
      apiRequest<number>(`/kpi/monthly?year=${year}&month=${month}`, {}, token).catch(() => ({ data: 0 })),
      studentsPromise,
      apiRequest<Task[]>('/tasks/my', {}, token).catch(() => ({ data: [] as Task[] })),
      apiRequest<Task[]>('/tasks/sent', {}, token).catch(() => ({ data: [] as Task[] })),
    ]).then(([kpiT, kpiM, studentsRes, tasksRes, sentRes]) => {
      setKpiToday((kpiT as { data: number }).data ?? 0);
      setKpiMonthly((kpiM as { data: number }).data ?? 0);
      const allStudents = (studentsRes as { data: Student[] }).data ?? [];
      setStudentCount(allStudents.filter((u) => u.role === 'student').length);
      const allTasks = (tasksRes as { data: Task[] }).data ?? [];
      setPendingTasks(allTasks.filter((t) => t.status !== 'done' && t.status !== 'confirmed').length);
      const sentTasks = (sentRes as { data: Task[] }).data ?? [];
      setConfirmedTasks(sentTasks.filter((t) => t.status === 'done' || t.status === 'confirmed').length);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);
  useRevalidateOnEvent(['kpi:updated', 'status:updated'], load);

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

  const navCards = [
    {
      href: '/mentor/group',
      icon: <Users size={20} />,
      title: 'Guruh',
      desc: "Holat va davomat belgilash",
      tint: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      hoverBorder: 'hover:border-emerald-300',
    },
    {
      href: '/mentor/attendance',
      icon: <BarChart2 size={20} />,
      title: 'Davomat tarixi',
      desc: 'Kunlar bo&apos;yicha statistika',
      tint: 'text-blue-700 bg-blue-50 border-blue-200',
      hoverBorder: 'hover:border-blue-300',
    },
    {
      href: '/mentor/tasks',
      icon: <ClipboardList size={20} />,
      title: 'Vazifalar',
      desc: pendingTasks > 0
        ? `${pendingTasks} ta kutilmoqda`
        : 'Mening topshiriqlarim',
      tint: 'text-amber-700 bg-amber-50 border-amber-200',
      hoverBorder: 'hover:border-amber-300',
      badge: pendingTasks > 0 ? pendingTasks : undefined,
    },
    {
      href: '/mentor/students',
      icon: <GraduationCap size={20} />,
      title: "O'quvchilar",
      desc: 'AI xato tahlili',
      tint: 'text-violet-700 bg-violet-50 border-violet-200',
      hoverBorder: 'hover:border-violet-300',
    },
  ];

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-4">
      {/* Header — staff amber accent on dark navy */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-15 pointer-events-none"
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
                {greeting}
              </p>
              <p className="text-white text-xl font-extrabold truncate">
                {mentorName || 'Mentor'}
              </p>
              <p className="text-[#475569] text-[11px] mt-0.5 font-bold inline-flex items-center gap-1.5">
                <CalendarDays size={11} /> {dateStr}
              </p>
            </div>
          </div>

          {/* KPI hero card — bigger ring + monthly progress */}
          <div className="bg-[#162032] border border-white/5 rounded-3xl p-4 flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                style={{ transform: 'rotate(-90deg)' }}
              >
                <circle
                  cx="40"
                  cy="40"
                  r="32"
                  fill="none"
                  stroke="rgba(245,158,11,0.12)"
                  strokeWidth="6"
                />
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
                <span className="text-[#94a3b8] font-bold text-xs">
                  ({kpiPercent}%)
                </span>
              </p>
              <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] rounded-full transition-all duration-500"
                  style={{ width: `${monthlyPercent}%` }}
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
        {/* Group assignment error */}
        {groupError && (
          <section className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <p className="text-rose-800 text-sm font-bold">{groupError}</p>
          </section>
        )}
        {/* Today snapshot — attendance + group + tasks */}
        <section>
          <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
            Bugungi holat
          </p>

          {/* Big attendance card with live action */}
          <button
            type="button"
            onClick={() => router.push('/mentor/group')}
            className={`w-full text-left rounded-2xl border-[1.5px] p-4 flex items-center gap-3 transition-colors ${
              attendanceMarked
                ? 'bg-emerald-50 border-emerald-200 hover:border-emerald-300'
                : 'bg-amber-50 border-amber-200 hover:border-amber-300'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                attendanceMarked
                  ? 'bg-emerald-500 text-white'
                  : 'bg-amber-500 text-white motion-safe:animate-pulse'
              }`}
            >
              {attendanceMarked ? (
                <CheckCircle size={20} />
              ) : (
                <AlertCircle size={20} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-extrabold ${
                  attendanceMarked ? 'text-emerald-800' : 'text-amber-900'
                }`}
              >
                {attendanceMarked
                  ? 'Bugungi davomat belgilandi'
                  : 'Davomat hali belgilanmagan'}
              </p>
              <p
                className={`text-[11px] font-bold mt-0.5 ${
                  attendanceMarked ? 'text-emerald-700/70' : 'text-amber-800/70'
                }`}
              >
                {attendanceMarked
                  ? "Guruh sahifasidan ko'rish va o'zgartirish"
                  : "Guruh sahifasiga o'ting va belgilang"}
              </p>
            </div>
            <ChevronRight
              size={18}
              className={
                attendanceMarked ? 'text-emerald-700/50' : 'text-amber-800/50'
              }
            />
          </button>

          {/* 3-tile compact stat grid */}
          {loading ? (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} theme="light" className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <SnapshotTile
                icon={<Users size={16} />}
                value={studentCount}
                label="O'quvchi"
                tint="text-emerald-700 bg-emerald-50 border-emerald-200"
              />
              <SnapshotTile
                icon={<ClipboardList size={16} />}
                value={pendingTasks}
                label="Kutilmoqda"
                tint={
                  pendingTasks > 0
                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                    : 'text-slate-700 bg-white border-[#ede9e1]'
                }
              />
              <SnapshotTile
                icon={<TrendingUp size={16} />}
                value={confirmedTasks}
                label="Bajarilgan"
                tint="text-blue-700 bg-blue-50 border-blue-200"
              />
            </div>
          )}
        </section>

        {/* Nav cards — refreshed with badges and tinted icons */}
        <section>
          <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
            Boshqaruv
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {navCards.map((card) => (
              <button
                key={card.href}
                onClick={() => router.push(card.href)}
                className={`bg-white rounded-2xl p-3.5 flex items-center gap-3 border-[1.5px] border-[#ede9e1] transition-colors text-left ${card.hoverBorder} hover:bg-[#fffaf0] active:scale-[0.99]`}
              >
                <div
                  className={`relative w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${card.tint}`}
                >
                  {card.icon}
                  {card.badge !== undefined && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white">
                      {card.badge}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0f172a] text-sm font-extrabold truncate">
                    {card.title}
                  </p>
                  <p className="text-[11px] font-semibold text-[#64748b] mt-0.5 truncate">
                    {card.desc}
                  </p>
                </div>
                <ChevronRight size={16} className="text-[#94a3b8] shrink-0" />
              </button>
            ))}
          </div>
        </section>

        {/* Quick KPI tip — only when KPI is below half target */}
        {!loading && kpiPercent < 50 && (
          <section className="bg-amber-50 border-[1.5px] border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-700 flex items-center justify-center shrink-0">
              <Star size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-amber-900">
                Bugun KPI bo&apos;yicha orqada
              </p>
              <p className="text-[11px] font-bold text-amber-800/80 mt-0.5 leading-snug">
                Davomatni belgilang, vazifalarni tasdiqlang va o&apos;quvchilar bilan
                ishlang — har bir amal ball qo&apos;shadi.
              </p>
            </div>
          </section>
        )}

        {/* Video check-in panel */}
        {branchIdForPanel && (
          <section>
            <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
              Kunlik video
            </p>
            <VideoCheckinsPanel
              branchId={branchIdForPanel}
              studentBasePath="/mentor/students"
            />
          </section>
        )}
      </div>
    </div>
  );
}

function SnapshotTile({
  icon,
  value,
  label,
  tint,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tint: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${tint}`}
    >
      <div className="opacity-80 mb-1">{icon}</div>
      <p className="text-2xl font-extrabold leading-none font-mono tabular-nums">
        {value}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-wider mt-1 opacity-90">
        {label}
      </p>
    </div>
  );
}
