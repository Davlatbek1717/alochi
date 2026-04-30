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
import { Stat, Skeleton } from '@/components/ui';

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
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { name?: string };
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
        ? apiRequest<Student[]>(`/users/by-branch/${branchId}`, {}, token).catch(() => ({ data: [] as Student[] }))
        : Promise.resolve({ data: [] as Student[] }),
      apiRequest<Task[]>('/tasks/my', {}, token).catch(() => ({ data: [] as Task[] })),
    ]).then(([kpiT, kpiM, studentsRes, tasksRes]) => {
      setKpiToday((kpiT as { data: number }).data ?? 0);
      setKpiMonthly((kpiM as { data: number }).data ?? 0);
      const allStudents = (studentsRes as { data: Student[] }).data ?? [];
      setStudentCount(allStudents.filter((u) => u.role === 'student').length);
      const allTasks = (tasksRes as { data: Task[] }).data ?? [];
      setPendingTasks(allTasks.filter((t) => t.status !== 'done' && t.status !== 'confirmed').length);
    }).finally(() => setLoading(false));
  }, []);

  const dateStr = new Date().toLocaleDateString('uz-UZ', {
    day: 'numeric', month: 'long', weekday: 'long',
  });

  const kpiTarget = 50;
  const kpiPercent = Math.min(100, Math.round((kpiToday / kpiTarget) * 100));
  const circumference = 2 * Math.PI * 26;
  const strokeDashoffset = circumference - (circumference * kpiPercent) / 100;

  const navCards = [
    { href: '/mentor/group', icon: <Users size={22} />, title: 'Guruh', desc: 'Holat belgilash', color: 'hover:border-emerald-300 hover:bg-emerald-50' },
    { href: '/mentor/attendance', icon: <BarChart2 size={22} />, title: 'Davomat', desc: 'Kunlik qatnashish', color: 'hover:border-blue-300 hover:bg-blue-50' },
    { href: '/mentor/tasks', icon: <ClipboardList size={22} />, title: 'Vazifalar', desc: "Mening topshiriqlar", color: 'hover:border-orange-300 hover:bg-orange-50' },
    { href: '/mentor/students', icon: <GraduationCap size={22} />, title: "O'quvchilar", desc: 'Xato tahlili', color: 'hover:border-purple-300 hover:bg-purple-50' },
  ];

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="flex justify-between items-start mb-5 relative z-10">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Xush kelibsiz</p>
            <p className="text-white text-xl font-bold">{mentorName || 'Mentor'}</p>
            <p className="text-[#475569] text-xs mt-1 font-mono">{dateStr}</p>
          </div>
          <button aria-label="Bildirishnomalar" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#94a3b8]">
            <Bell size={18} />
          </button>
        </div>

        {/* KPI Hero */}
        <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-2xl p-4 relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Bugungi KPI</p>
            {loading ? (
              <Skeleton className="h-9 w-16 mb-1" />
            ) : (
              <p className="text-[#f59e0b] text-4xl font-black font-mono leading-none">{kpiToday}</p>
            )}
            <p className="text-[#f59e0b]/60 text-xs mt-1">Oylik: {kpiMonthly} ball</p>
          </div>
          <div className="relative w-16 h-16">
            <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(245,158,11,0.12)" strokeWidth="5" />
              <circle cx="32" cy="32" r="26" fill="none" stroke="#f59e0b" strokeWidth="5"
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
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
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Statistika</p>
          {loading ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#162032] rounded-[18px] p-3">
                  <Skeleton className="h-4 w-4 mb-2" />
                  <Skeleton className="h-7 w-10 mb-1" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <Stat
                icon={<Users size={16} />}
                label="Guruh a'zolari"
                value={studentCount}
                color="text-[#0d9488]"
              />
              <Stat
                icon={<ClipboardList size={16} />}
                label="Kutilayotgan vazifa"
                value={pendingTasks}
                color="text-[#e11d48]"
              />
              <Stat
                icon={<Star size={16} />}
                label="Oylik ball"
                value={kpiMonthly}
                color="text-[#f59e0b]"
              />
            </div>
          )}

          {/* Attendance wide card */}
          <div className="bg-[#162032] rounded-[18px] p-3 mt-2 flex items-center gap-3 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0d9488]/50 rounded-b-[18px]" />
            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
              attendanceMarked ? 'bg-[#0d9488]/15 border border-[#0d9488]/40' : 'bg-[#f59e0b]/10 border border-[#f59e0b]/30'
            }`}>
              {attendanceMarked
                ? <CheckCircle size={18} className="text-[#0d9488]" />
                : <AlertCircle size={18} className="text-[#f59e0b]" />}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold">
                {attendanceMarked ? 'Bugungi davomat belgilandi' : 'Davomat belgilanmagan'}
              </p>
              <p className="text-[#94a3b8] text-xs mt-0.5">
                {attendanceMarked ? "Guruh sahifasidan ko'rish" : "Guruh sahifasiga o'ting"}
              </p>
            </div>
            <button
              onClick={() => router.push('/mentor/group')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                attendanceMarked ? 'bg-white/5 border border-white/10 text-[#94a3b8]' : 'bg-[#0d9488] text-white'
              }`}
            >
              {attendanceMarked ? "Ko'rish" : 'Belgilash'}
            </button>
          </div>
        </div>

        {/* Nav cards */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Tezkor navigatsiya</p>
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
                  <p className="text-[#0f172a] text-sm font-bold truncate">{card.title}</p>
                  <p className="text-[#64748b] text-xs mt-0.5 truncate">{card.desc}</p>
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
