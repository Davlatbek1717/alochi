'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import { Users, CreditCard, ClipboardList, Send, AlertCircle, AlertTriangle, TrendingUp, Trophy, Calendar, Award } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, Stat, useToast } from '@/components/ui';
import { formatDateWeekday } from '@/lib/date-uz';
import VideoCheckinsPanel from '@/app/(dashboard)/_components/VideoCheckinsPanel';

type StatusStudent = {
  studentId: string;
  student: { id: string; name: string };
  englishStatus: string;
  personalStatus: string;
  criticalStatus: string;
};

type HighPerformer = {
  id: string;
  name: string;
  lessonsCompleted: number;
  totalLessons: number;
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function ManagerDashboard() {
  const toast = useToast();
  const [redStudents, setRedStudents] = useState<StatusStudent[]>([]);
  const [yellowStudents, setYellowStudents] = useState<StatusStudent[]>([]);
  const [highPerformers, setHighPerformers] = useState<HighPerformer[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerName, setManagerName] = useState('');
  const [branchIdForPanel, setBranchIdForPanel] = useState('');

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { name?: string; branchId?: string };
    setManagerName(user.name ?? '');
    if (user.branchId) setBranchIdForPanel(user.branchId);

    Promise.allSettled([
      apiRequest<StatusStudent[]>('/status/red-students', {}, token),
      apiRequest<StatusStudent[]>('/status/yellow-students', {}, token),
      apiRequest<HighPerformer[]>('/status/high-performers', {}, token),
    ]).then(([redRes, yellowRes, highRes]) => {
      if (redRes.status === 'fulfilled') setRedStudents(redRes.value.data ?? []);
      else toast.error("Qizil o'quvchilar yuklanmadi");
      if (yellowRes.status === 'fulfilled') setYellowStudents(yellowRes.value.data ?? []);
      else toast.error("Sariq o'quvchilar yuklanmadi");
      if (highRes.status === 'fulfilled') setHighPerformers(highRes.value.data ?? []);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh student status lists whenever the manager returns to this tab so
  // status changes made by mentors are visible without a full page reload.
  useFocusRevalidate(load);

  // Real-time: revalidate immediately when a socket push signals that status
  // or KPI data has changed while the manager is actively viewing this page.
  useRevalidateOnEvent(['status:updated', 'kpi:updated'], load);

  const navCards = [
    { href: '/manager/students',    icon: <Users size={20} />,        title: "O'quvchilar", desc: 'Status boshqaruv',  color: 'hover:border-violet-300 hover:bg-violet-50' },
    { href: '/manager/payments',    icon: <CreditCard size={20} />,   title: "To'lovlar",   desc: 'Qarzdorlar hisobi', color: 'hover:border-emerald-300 hover:bg-emerald-50' },
    { href: '/manager/tasks',       icon: <ClipboardList size={20} />,title: 'Vazifalar',   desc: "Mening topshiriqlarim", color: 'hover:border-orange-300 hover:bg-orange-50' },
    { href: '/delegations',         icon: <Send size={20} />,         title: 'Vakolatlar',  desc: "Menga berilgan vakolatlar", color: 'hover:border-blue-300 hover:bg-blue-50' },
    { href: '/manager/rewards',     icon: <Trophy size={20} />,       title: "Sovg'a/Kitob", desc: 'Ragʼbatlantirish',   color: 'hover:border-amber-300 hover:bg-amber-50' },
    { href: '/manager/sessions',    icon: <Calendar size={20} />,     title: '1:1 Sessiyalar', desc: 'Individual sessiyalarni rejalashtirish va kuzatish', color: 'hover:border-cyan-300 hover:bg-cyan-50' },
    { href: '/manager/certificates',icon: <Award size={20} />,        title: 'Sertifikat',   desc: "O'quvchilar sertifikatlari", color: 'hover:border-amber-300 hover:bg-amber-50' },
  ];

  const alertCount = redStudents.length + yellowStudents.length;

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="flex justify-between items-start mb-5 relative z-10">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Manager Panel</p>
            <p className="text-white text-xl font-bold">{managerName || 'Manager'}</p>
            <p className="text-[#475569] text-xs mt-1 font-mono">
              {formatDateWeekday(new Date())}
            </p>
          </div>
        </div>

        {/* Alert badge */}
        <div className={`rounded-2xl p-4 relative z-10 flex items-center gap-4 ${alertCount > 0 ? 'bg-[#e11d48]/10 border border-[#e11d48]/20' : 'bg-[#0d9488]/10 border border-[#0d9488]/20'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${alertCount > 0 ? 'bg-[#e11d48]/15 border border-[#e11d48]/30' : 'bg-[#0d9488]/15 border border-[#0d9488]/30'}`}>
            <AlertCircle size={22} className={alertCount > 0 ? 'text-[#e11d48]' : 'text-[#0d9488]'} />
          </div>
          <div className="flex-1">
            {loading ? (
              <Skeleton theme="light" className="h-4 w-40 mb-1" />
            ) : (
              <p className={`text-sm font-bold ${alertCount > 0 ? 'text-[#e11d48]' : 'text-[#0d9488]'}`}>
                {alertCount > 0 ? `${alertCount} ta diqqatga sazovor o'quvchi` : "Barcha o'quvchilar yaxshi"}
              </p>
            )}
            <p className="text-[#94a3b8] text-xs mt-0.5">
              {redStudents.length} ta qizil · {yellowStudents.length} ta sariq
            </p>
          </div>
          {highPerformers.length > 0 && (
            <div className="flex items-center gap-1 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl px-3 py-1.5">
              <Trophy size={14} className="text-[#f59e0b]" />
              <span className="text-[#f59e0b] text-xs font-bold">{highPerformers.length}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-8 pb-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            <>
              <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-3">
                <Skeleton theme="light" className="h-5 w-5 rounded-lg" />
                <Skeleton theme="light" className="h-8 w-1/2" />
                <Skeleton theme="light" className="h-3 w-3/4" />
              </div>
              <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-3">
                <Skeleton theme="light" className="h-5 w-5 rounded-lg" />
                <Skeleton theme="light" className="h-8 w-1/2" />
                <Skeleton theme="light" className="h-3 w-3/4" />
              </div>
            </>
          ) : (
            <>
              <Stat
                theme="light"
                icon={<AlertCircle size={18} />}
                label="Qizil o'quvchilar"
                value={redStudents.length}
                color="text-rose-400"
              />
              <Stat
                theme="light"
                icon={<Trophy size={18} />}
                label="Yuqori natija"
                value={highPerformers.length}
                color="text-amber-400"
              />
            </>
          )}
        </div>

        {/* Nav cards */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Tezkor navigatsiya</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {navCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`bg-white rounded-[18px] p-4 min-w-0 flex items-center gap-3 border-[1.5px] border-[#ede9e1] transition-all hover:scale-[1.02] text-left ${card.color}`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#0f172a] shrink-0">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0f172a] text-sm font-bold truncate">{card.title}</p>
                  <p className="text-[#64748b] text-xs mt-0.5 truncate">{card.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Red students */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
            Qizil o&apos;quvchilar
            {!loading && <span className="ml-2 text-[#e11d48]">({redStudents.length})</span>}
          </p>
          <div className="space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-[14px] p-3 border-[1.5px] border-[#ede9e1] flex items-center gap-3">
                  <Skeleton theme="light" className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton theme="light" className="h-4 w-1/2" />
                    <Skeleton theme="light" className="h-3 w-1/3" />
                  </div>
                </div>
              ))
            ) : redStudents.length === 0 ? (
              <div className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] overflow-hidden">
                <EmptyState icon={<AlertCircle size={24} />} title="Hech kim yo'q" theme="light" />
              </div>
            ) : (
              redStudents.map((s) => (
                <Link key={s.studentId} href={`/manager/students/${s.student.id}`}
                  className="bg-white rounded-[14px] px-4 py-3 border-[1.5px] border-rose-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 text-sm font-black shrink-0">
                    {getInitials(s.student.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0f172a] text-sm font-semibold truncate">{s.student.name}</p>
                    <p className="text-[#94a3b8] text-[11px] truncate">
                      {[s.englishStatus, s.personalStatus, s.criticalStatus].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <TrendingUp size={14} className="text-rose-400 shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Yellow students */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
            Sariq o&apos;quvchilar
            {!loading && <span className="ml-2 text-[#f59e0b]">({yellowStudents.length})</span>}
          </p>
          <div className="space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-[14px] p-3 border-[1.5px] border-[#ede9e1] flex items-center gap-3">
                  <Skeleton theme="light" className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton theme="light" className="h-4 w-1/2" />
                    <Skeleton theme="light" className="h-3 w-1/3" />
                  </div>
                </div>
              ))
            ) : yellowStudents.length === 0 ? (
              <div className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] overflow-hidden">
                <EmptyState icon={<AlertTriangle size={24} />} title="Hech kim yo'q" theme="light" />
              </div>
            ) : (
              yellowStudents.map((s) => (
                <Link key={s.studentId} href={`/manager/students/${s.student.id}`}
                  className="bg-white rounded-[14px] px-4 py-3 border-[1.5px] border-amber-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-black shrink-0">
                    {getInitials(s.student.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0f172a] text-sm font-semibold truncate">{s.student.name}</p>
                    <p className="text-[#94a3b8] text-[11px] truncate">
                      {[s.englishStatus, s.personalStatus, s.criticalStatus].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <TrendingUp size={14} className="text-amber-400 shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* High performers */}
        {highPerformers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
              200%+ o&apos;quvchilar <span className="ml-2 text-emerald-600">({highPerformers.length})</span>
            </p>
            <div className="space-y-2">
              {highPerformers.map((s) => (
                <Link key={s.id} href={`/manager/students/${s.id}`}
                  className="bg-white rounded-[14px] px-4 py-3 border-[1.5px] border-emerald-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 text-sm font-black shrink-0">
                    {getInitials(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0f172a] text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-[#94a3b8] text-[11px]">{s.lessonsCompleted}/{s.totalLessons} dars</p>
                  </div>
                  <Trophy size={14} className="text-[#f59e0b] shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Video check-in panel */}
        {branchIdForPanel && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Kunlik video</p>
            <VideoCheckinsPanel
              branchId={branchIdForPanel}
              studentBasePath="/manager/students"
            />
          </div>
        )}
      </div>
    </div>
  );
}
