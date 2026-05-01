'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  BarChart2,
  CreditCard,
  AlertTriangle,
  Star,
  Tablet,
  Trophy,
  ChevronRight,
  Building2,
  ClipboardList,
  Users,
  CheckCircle,
  Clock,
  Video,
  Megaphone,
  UserCog,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

const NAV_CARDS = [
  {
    href: '/filadmin/attendance',
    icon: <BarChart2 size={22} />,
    title: 'Davomat',
    description: 'Kunlik qatnashuvni belgilash',
    color: 'hover:border-teal-300 hover:bg-teal-50',
  },
  {
    href: '/filadmin/payments',
    icon: <CreditCard size={22} />,
    title: "To'lovlar",
    description: "O'quvchi to'lovlarini boshqarish",
    color: 'hover:border-emerald-300 hover:bg-emerald-50',
  },
  {
    href: '/filadmin/warnings',
    icon: <AlertTriangle size={22} />,
    title: 'Ogohlantirishlar',
    description: 'Intizom muammolarini qayd etish',
    color: 'hover:border-rose-300 hover:bg-rose-50',
  },
  {
    href: '/filadmin/kpi',
    icon: <Star size={22} />,
    title: 'KPI Mukofot',
    description: 'Xodimlarga ball berish',
    color: 'hover:border-amber-300 hover:bg-amber-50',
  },
  {
    href: '/filadmin/devices',
    icon: <Tablet size={22} />,
    title: 'Planshetlar',
    description: 'Kiosk qurilmalarni boshqarish',
    color: 'hover:border-violet-300 hover:bg-violet-50',
  },
  {
    href: '/filadmin/tournaments',
    icon: <Trophy size={22} />,
    title: 'Turnirlar',
    description: 'Musobaqalarni boshqarish',
    color: 'hover:border-amber-300 hover:bg-amber-50',
  },
  {
    href: '/filadmin/tasks',
    icon: <ClipboardList size={22} />,
    title: 'Vazifalar',
    description: 'Topshiriqlarni boshqarish',
    color: 'hover:border-orange-300 hover:bg-orange-50',
  },
  {
    href: '/filadmin/blocked-students',
    icon: <AlertTriangle size={22} />,
    title: 'Bloklanganlar',
    description: 'Bloklangan oʻquvchilar roʻyxati',
    color: 'hover:border-rose-300 hover:bg-rose-50',
  },
  {
    href: '/filadmin/attendance/staff',
    icon: <Clock size={22} />,
    title: 'Xodim davomat tarixi',
    description: 'Davomat tarixi (oxirgi 7 kun)',
    color: 'hover:border-cyan-300 hover:bg-cyan-50',
  },
  {
    href: '/filadmin/video-guides',
    icon: <Video size={22} />,
    title: "Video qo'llanmalar",
    description: 'Foydalanuvchilar uchun videolar',
    color: 'hover:border-blue-300 hover:bg-blue-50',
  },
  {
    href: '/filadmin/promotion-report',
    icon: <Megaphone size={22} />,
    title: 'Reklama hisoboti',
    description: 'Promotion natijalari',
    color: 'hover:border-fuchsia-300 hover:bg-fuchsia-50',
  },
  {
    href: '/filadmin/staff',
    icon: <UserCog size={22} />,
    title: 'Xodimlar',
    description: 'Mentor / menejer / tester boshqaruvi',
    color: 'hover:border-indigo-300 hover:bg-indigo-50',
  },
];

type DashboardStats = {
  attendanceCount: number;
  statusYashil: number;
  statusSariq: number;
  statusQizil: number;
  pendingTasks: number;
};

const INITIAL_STATS: DashboardStats = {
  attendanceCount: 0,
  statusYashil: 0,
  statusSariq: 0,
  statusQizil: 0,
  pendingTasks: 0,
};

export default function FiladminDashboard() {
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let branchId = '';
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        branchId?: string;
      };
      branchId = u.branchId ?? '';
    } catch {
      /* ignore */
    }

    Promise.all([
      apiRequest<{ yashil: number; sariq: number; qizil: number }>(
        '/status/summary',
        {},
        token,
      ).catch(() => ({ data: { yashil: 0, sariq: 0, qizil: 0 } })),
      branchId
        ? apiRequest<{ count: number }>(
            `/attendance/staff/today/${branchId}`,
            {},
            token,
          ).catch(() => ({ data: { count: 0 } }))
        : Promise.resolve({ data: { count: 0 } }),
      branchId
        ? apiRequest<unknown[]>(
            `/tasks/by-branch/${branchId}?status=pending`,
            {},
            token,
          ).catch(() => ({ data: [] as unknown[] }))
        : Promise.resolve({ data: [] as unknown[] }),
    ]).then(([statusRes, attendanceRes, tasksRes]) => {
      setStats({
        attendanceCount: attendanceRes.data?.count ?? 0,
        statusYashil: statusRes.data?.yashil ?? 0,
        statusSariq: statusRes.data?.sariq ?? 0,
        statusQizil: statusRes.data?.qizil ?? 0,
        pendingTasks: Array.isArray(tasksRes.data) ? tasksRes.data.length : 0,
      });
    });
  }, []);

  const totalStatus = stats.statusYashil + stats.statusSariq + stats.statusQizil;
  const pct = (n: number) => (totalStatus > 0 ? Math.round((n / totalStatus) * 100) : 0);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-8 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 border border-[#0d9488]/30 flex items-center justify-center">
              <Building2 size={20} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Filial boshqaruvi</p>
              <p className="text-white text-lg font-bold">Filadmin Paneli</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-5">
        {/* Realtime stat cards */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Bugungi holat</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-[18px] p-4 border-[1.5px] border-[#ede9e1]">
              <Users size={18} className="text-[#0d9488] mb-2" />
              <p className="text-2xl font-black text-[#0f172a] font-mono">{stats.attendanceCount}</p>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mt-1">Davomat (bugun)</p>
            </div>
            <div className="bg-white rounded-[18px] p-4 border-[1.5px] border-[#ede9e1]">
              <Clock size={18} className="text-[#f59e0b] mb-2" />
              <p className="text-2xl font-black text-[#0f172a] font-mono">{stats.pendingTasks}</p>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mt-1">Kutilayotgan vazifa</p>
            </div>
          </div>
          {/* Status pie (simple bar visualization — Recharts pie added later) */}
          <div className="bg-white rounded-[18px] p-4 border-[1.5px] border-[#ede9e1] mt-3">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle size={16} className="text-[#0f172a]" />
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Holat taqsimoti</p>
            </div>
            {totalStatus === 0 ? (
              <p className="text-sm text-[#94a3b8]">Hali ma&apos;lumot yo&apos;q</p>
            ) : (
              <>
                <div className="flex h-2 rounded-full overflow-hidden bg-[#f7f4ef]">
                  <div className="bg-emerald-500" style={{ width: `${pct(stats.statusYashil)}%` }} />
                  <div className="bg-amber-500" style={{ width: `${pct(stats.statusSariq)}%` }} />
                  <div className="bg-rose-500" style={{ width: `${pct(stats.statusQizil)}%` }} />
                </div>
                <div className="flex justify-between text-xs mt-2 text-[#64748b]">
                  <span>Yashil: {stats.statusYashil}</span>
                  <span>Sariq: {stats.statusSariq}</span>
                  <span>Qizil: {stats.statusQizil}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Tezkor navigatsiya</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {NAV_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`bg-white rounded-[18px] p-4 flex items-center gap-3 border-[1.5px] border-[#ede9e1] transition-all hover:scale-[1.02] text-left ${card.color}`}
              >
                <div className="w-11 h-11 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#0f172a] shrink-0">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0f172a] text-sm font-bold truncate">{card.title}</p>
                  <p className="text-[#64748b] text-xs mt-0.5 truncate">{card.description}</p>
                </div>
                <ChevronRight size={16} className="text-[#94a3b8] shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
