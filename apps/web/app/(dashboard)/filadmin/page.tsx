'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
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
  Send,
  Search,
  Plus,
  Sparkles,
  UserX,
  GraduationCap,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import VideoCheckinsPanel from '@/app/(dashboard)/_components/VideoCheckinsPanel';

type Card = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

type Group = {
  id: string;
  label: string;
  iconBg: string;
  iconColor: string;
  cards: Card[];
};

// ── Navigation grouped into four clusters ─────────────────────────────────
// Was a flat 13-card grid that took "scan everything" to find anything.
// Categorise by what the filadmin is *doing* (students, staff, finance, infra)
// so each cluster fits in roughly one screen and is colour-coded for scan.
const NAV_GROUPS: Group[] = [
  {
    id: 'students',
    label: "O'quvchilar va intizom",
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    cards: [
      { href: '/filadmin/attendance',        icon: <BarChart2 size={20} />,    title: 'Davomat',           description: 'Kunlik qatnashuvni belgilash' },
      { href: '/filadmin/warnings',          icon: <AlertTriangle size={20} />, title: 'Ogohlantirishlar', description: 'Intizom muammolarini qayd etish' },
      { href: '/filadmin/blocked-students',  icon: <UserX size={20} />,         title: 'Bloklanganlar',     description: "Bloklangan o'quvchilar ro'yxati" },
      { href: '/filadmin/study-time',        icon: <Clock size={20} />,         title: "O'quv vaqti",       description: "Kunlik o'quv vaqti va kam ishlaganlar" },
      { href: '/filadmin/tournaments',       icon: <Trophy size={20} />,        title: 'Turnirlar',         description: 'Musobaqalarni boshqarish' },
    ],
  },
  {
    id: 'staff',
    label: 'Xodimlar va vazifalar',
    iconBg: 'bg-indigo-50',
    iconColor: 'text-indigo-700',
    cards: [
      { href: '/filadmin/staff',             icon: <UserCog size={20} />,      title: 'Xodimlar',          description: 'Mentor / menejer / tester boshqaruvi' },
      { href: '/filadmin/attendance/staff',  icon: <Clock size={20} />,         title: 'Xodim davomat tarixi', description: 'Oxirgi 7 kun tarixi' },
      { href: '/filadmin/kpi',               icon: <Star size={20} />,          title: 'KPI Mukofot',       description: 'Xodimlarga ball berish' },
      { href: '/filadmin/tasks',             icon: <ClipboardList size={20} />, title: 'Vazifalar',         description: 'Topshiriqlarni boshqarish' },
    ],
  },
  {
    id: 'finance',
    label: 'Moliya va hisobotlar',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
    cards: [
      { href: '/filadmin/payments',          icon: <CreditCard size={20} />,    title: "To'lovlar",          description: "O'quvchi to'lovlarini boshqarish" },
      { href: '/filadmin/promotion-report',  icon: <Megaphone size={20} />,     title: 'Reklama hisoboti',   description: 'Promotion natijalari' },
    ],
  },
  {
    id: 'infra',
    label: 'Infratuzilma va boshqaruv',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-700',
    cards: [
      { href: '/filadmin/groups',            icon: <GraduationCap size={20} />, title: 'Guruhlar',          description: "Guruh va mentor tayinlash" },
      { href: '/filadmin/devices',           icon: <Tablet size={20} />,        title: 'Planshetlar',       description: 'Kiosk qurilmalar' },
      { href: '/filadmin/video-guides',      icon: <Video size={20} />,         title: "Video qo'llanmalar", description: 'Foydalanuvchilar uchun video' },
      { href: '/delegations',                icon: <Send size={20} />,          title: 'Delegatsiya',        description: 'Vakolat berish va boshqarish' },
    ],
  },
];

// Most-pressed buttons across the panel. Tapping a quick action lands on
// the page where "Yangi ..." is the obvious next click.
const QUICK_ACTIONS = [
  { href: '/filadmin/attendance',  icon: <BarChart2 size={16} />,    label: 'Davomat',         tone: 'emerald' },
  { href: '/filadmin/warnings',    icon: <AlertTriangle size={16} />, label: 'Ogohlantirish',   tone: 'rose' },
  { href: '/filadmin/payments',    icon: <CreditCard size={16} />,    label: "To'lov",          tone: 'amber' },
  { href: '/filadmin/tasks',       icon: <ClipboardList size={16} />, label: 'Vazifa',          tone: 'indigo' },
];

const TONE_COLORS: Record<string, string> = {
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  amber: 'text-amber-700',
  indigo: 'text-indigo-700',
};

const ALL_CARDS: Card[] = NAV_GROUPS.flatMap((g) => g.cards);

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
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>(INITIAL_STATS);
  const [branchId, setBranchId] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let bid = '';
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        branchId?: string;
      };
      bid = u.branchId ?? '';
    } catch {
      /* ignore */
    }
    setBranchId(bid);
    const branchId = bid;

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

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);
  useRevalidateOnEvent(['status:updated', 'kpi:updated'], load);

  const totalStatus = stats.statusYashil + stats.statusSariq + stats.statusQizil;
  const pct = (n: number) => (totalStatus > 0 ? Math.round((n / totalStatus) * 100) : 0);

  // Client-side card search
  const trimmedQuery = query.trim().toLowerCase();
  const filteredCards = useMemo<Card[]>(() => {
    if (!trimmedQuery) return [];
    return ALL_CARDS.filter(
      (c) =>
        c.title.toLowerCase().includes(trimmedQuery) ||
        c.description.toLowerCase().includes(trimmedQuery),
    );
  }, [trimmedQuery]);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && filteredCards.length > 0) {
      e.preventDefault();
      router.push(filteredCards[0].href);
    }
    if (e.key === 'Escape') setQuery('');
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-8 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div
          aria-hidden
          className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 border border-[#0d9488]/30 flex items-center justify-center shrink-0">
              <Building2 size={20} className="text-[#0d9488]" />
            </div>
            <div className="min-w-0">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          {/* Status pie (simple bar visualization) */}
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

        {/* Quick actions row */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-2">
            Tezkor harakatlar
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUICK_ACTIONS.map((q) => (
              <button
                key={q.href}
                type="button"
                onClick={() => router.push(q.href)}
                className="flex items-center justify-center gap-2 bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-3 py-2.5 min-h-[44px] text-sm font-bold text-[#0f172a] hover:bg-[#f7f4ef] hover:border-[#0d9488]/40 transition-colors"
              >
                <span className={TONE_COLORS[q.tone] ?? 'text-[#0d9488]'}>{q.icon}</span>
                <span className="truncate">{q.label}</span>
                <Plus size={13} className="text-[#94a3b8] ml-auto shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
            aria-hidden
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            aria-label="Bo'limni qidirish"
            placeholder="Bo'limni qidiring (masalan: davomat, kpi, planshet)..."
            className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-2xl pl-10 pr-3 py-3 min-h-[44px] text-sm text-[#0f172a] focus:outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 placeholder:text-[#94a3b8]"
          />
        </div>

        {/* Filtered view OR grouped nav */}
        {trimmedQuery ? (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-2">
              {filteredCards.length > 0
                ? `${filteredCards.length} ta natija — Enter bilan birinchisiga o‘tish`
                : 'Hech narsa topilmadi'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredCards.map((c) => (
                <NavCardLink key={c.href} card={c} iconBg="bg-[#f7f4ef]" iconColor="text-[#0f172a]" />
              ))}
            </div>
            {filteredCards.length === 0 && (
              <div className="bg-white rounded-2xl border-[1.5px] border-dashed border-[#ede9e1] p-6 text-center">
                <Sparkles size={20} className="text-[#94a3b8] mx-auto mb-2" />
                <p className="text-sm text-[#64748b]">
                  Boshqacha so‘zlar bilan qidirib ko‘ring
                </p>
              </div>
            )}
          </div>
        ) : (
          NAV_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`group-${group.id}`}>
              <h2
                id={`group-${group.id}`}
                className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2 flex items-center gap-2"
              >
                <span className={`w-1 h-3.5 rounded ${group.iconBg.replace('-50', '-400')}`} />
                {group.label}
                <span className="text-[10px] font-mono font-semibold text-[#94a3b8]">
                  {group.cards.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {group.cards.map((c) => (
                  <NavCardLink
                    key={c.href}
                    card={c}
                    iconBg={group.iconBg}
                    iconColor={group.iconColor}
                  />
                ))}
              </div>
            </section>
          ))
        )}

        {/* Video check-ins panel — pinned at the bottom because it's a live
            data widget filadmins want at the end of a glance, not in the
            middle of nav scanning. */}
        {branchId && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Kunlik video</p>
            <VideoCheckinsPanel
              branchId={branchId}
              studentBasePath="/filadmin/students"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function NavCardLink({
  card,
  iconBg,
  iconColor,
}: {
  card: Card;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <Link
      href={card.href}
      className="bg-white rounded-[18px] p-4 min-w-0 flex items-center gap-3 border-[1.5px] border-[#ede9e1] transition-all hover:scale-[1.02] hover:border-[#0d9488]/40 hover:bg-[#0d9488]/[0.03]"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
        {card.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#0f172a] text-sm font-bold truncate">{card.title}</p>
        <p className="text-[#64748b] text-xs mt-0.5 truncate">{card.description}</p>
      </div>
      <ChevronRight size={16} className="text-[#94a3b8] shrink-0" />
    </Link>
  );
}
