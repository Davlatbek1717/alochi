'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookMarked, CreditCard, Users, Building2,
  Trophy, ChevronRight, Shield, Search,
  Settings, BarChart2, TrendingUp,
  UserX, Camera, Award, Video, MessageSquare, Send,
  FileClock, Plus, Sparkles,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateLong } from '@/lib/date-uz';
import { Skeleton } from '@/components/ui';

type Card = {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
};

type Group = {
  id: string;
  label: string;
  // Tint applied to the icon background — keeps each category visually
  // distinct so superadmins can scan to the right cluster instantly.
  iconBg: string;
  iconColor: string;
  cards: Card[];
};

// ── Navigation grouped into four scannable clusters ─────────────────────────
// Was a flat list of 14 cards which made finding anything a "scan the whole
// grid" problem. Categorise by what the superadmin is trying to *do*, not
// by alphabet or feature owner.
const NAV_GROUPS: Group[] = [
  {
    id: 'people',
    label: 'Odamlar va filiallar',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-700',
    cards: [
      { href: '/superadmin/users',    icon: <Users size={20} />,    title: 'Foydalanuvchilar',     desc: 'Yaratish, tahrirlash' },
      { href: '/superadmin/branches', icon: <Building2 size={20} />, title: 'Filiallar',           desc: "A'lojon filiallari va admin tayinlash" },
      { href: '/superadmin/blocked-students', icon: <UserX size={20} />, title: "Bloklangan o'quvchilar", desc: "To'lov va ogohlantirish bloklari" },
    ],
  },
  {
    id: 'content',
    label: 'Mazmun va shablon',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    cards: [
      { href: '/superadmin/lessons',  icon: <BookMarked size={20} />, title: 'Darslar',          desc: 'Yaratish, tahrirlash, nashr' },
      { href: '/superadmin/certificate-design', icon: <Award size={20} />, title: 'Sertifikat dizayni', desc: 'Shablon va brending' },
      { href: '/superadmin/video-guides', icon: <Video size={20} />, title: "Video qo'llanmalar", desc: "Foydalanuvchilar uchun video" },
      { href: '/superadmin/templates', icon: <MessageSquare size={20} />, title: 'Bildirishnoma shablonlari', desc: 'Telegram/inapp/SMS shablonlar' },
    ],
  },
  {
    id: 'ops',
    label: "To'lov, imtihon, delegatsiya",
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
    cards: [
      { href: '/superadmin/payments', icon: <CreditCard size={20} />, title: "To'lovlar",      desc: 'Qarzdorlar, filial statistika' },
      { href: '/superadmin/tournaments', icon: <Trophy size={20} />, title: 'Turnirlar',       desc: 'Musobaqalar boshqaruvi' },
      { href: '/delegations',         icon: <Send size={20} />,     title: 'Delegatsiya',      desc: 'Vakolat berish va boshqarish' },
    ],
  },
  {
    id: 'analytics',
    label: 'Tahlil va monitoring',
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-700',
    cards: [
      { href: '/superadmin/analytics', icon: <TrendingUp size={20} />, title: 'Analytics',     desc: 'Filial va dars statistika' },
      { href: '/superadmin/content-quality', icon: <BarChart2 size={20} />, title: 'Kontent Sifati', desc: 'A/B test, pass rate' },
      { href: '/superadmin/face-sla', icon: <Camera size={20} />,    title: 'Face ID monitoring', desc: "Face ID natijalari va SLA" },
      { href: '/superadmin/audit-log', icon: <FileClock size={20} />, title: 'Audit jurnali',    desc: "O'zgartirishlar tarixi" },
      { href: '/superadmin/settings', icon: <Settings size={20} />,  title: 'Sozlamalar',       desc: 'Bloklash chegarasi' },
    ],
  },
];

// Most-used actions surfaced as a button row at the top of the body. Saves
// 2-3 taps versus "open the home card → click 'Yangi' inside" for the
// things superadmins do daily.
const QUICK_ACTIONS = [
  { href: '/superadmin/lessons/new',  icon: <BookMarked size={16} />, label: "Yangi dars" },
  { href: '/superadmin/users',        icon: <Users size={16} />,      label: 'Foydalanuvchi' },
  { href: '/superadmin/branches',     icon: <Building2 size={16} />,  label: 'Filial' },
  { href: '/superadmin/tournaments',  icon: <Trophy size={16} />,     label: 'Turnir' },
];

const ALL_CARDS: Card[] = NAV_GROUPS.flatMap((g) => g.cards);

type Stats = { branches: number; lessons: number; users: number };

export default function SuperadminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ branches: 0, lessons: 0, users: 0 });
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    Promise.all([
      apiRequest<Array<unknown>>('/branches', {}, token).catch(() => ({ data: [] as unknown[] })),
      apiRequest<Array<unknown>>('/lessons', {}, token).catch(() => ({ data: [] as unknown[] })),
      apiRequest<Array<unknown>>('/users', {}, token).catch(() => ({ data: [] as unknown[] })),
    ]).then(([b, l, u]) => {
      setStats({
        branches: Array.isArray(b.data) ? b.data.length : 0,
        lessons: Array.isArray(l.data) ? l.data.length : 0,
        users: Array.isArray(u.data) ? u.data.length : 0,
      });
    }).finally(() => setLoaded(true));
  }, []);

  const trimmedQuery = query.trim().toLowerCase();
  const filteredCards = useMemo<Card[]>(() => {
    if (!trimmedQuery) return [];
    return ALL_CARDS.filter(
      (c) =>
        c.title.toLowerCase().includes(trimmedQuery) ||
        c.desc.toLowerCase().includes(trimmedQuery),
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
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none overflow-hidden"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="flex items-start gap-4 mb-5 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
            <Shield size={22} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-0.5">Tizim boshqaruvi</p>
            <p className="text-white text-xl font-bold">Superadmin Paneli</p>
            <p className="text-[#475569] text-xs mt-0.5 font-mono truncate">
              {formatDateLong(new Date())}
            </p>
          </div>
        </div>

        {/* Stat bar */}
        <div className="grid grid-cols-3 gap-2 relative z-10">
          {[
            { label: 'Filiallar', value: stats.branches, color: 'text-[#0d9488]' },
            { label: 'Darslar',   value: stats.lessons,  color: 'text-violet-400' },
            { label: 'Foydalanuvchilar', value: stats.users, color: 'text-[#f59e0b]' },
          ].map((s) => (
            <div key={s.label} className="bg-[#162032] rounded-[14px] p-3 min-w-0">
              {loaded ? (
                <p className={`text-xl font-black font-mono ${s.color}`}>{s.value}</p>
              ) : (
                <Skeleton className="h-7 w-12 mb-1" />
              )}
              <p className="text-[#94a3b8] text-[10px] mt-0.5 leading-tight truncate">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-6">
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
                className="flex items-center justify-center gap-2 bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-3 py-2.5 min-h-[44px] text-sm font-bold text-[#0f172a] hover:bg-violet-50 hover:border-violet-200 transition-colors"
              >
                <span className="text-violet-700">{q.icon}</span>
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
            placeholder="Bo'limni qidiring (masalan: turnir, audit, sertifikat)..."
            className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-2xl pl-10 pr-3 py-3 min-h-[44px] text-sm text-[#0f172a] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200 placeholder:text-[#94a3b8]"
          />
        </div>

        {/* Filtered view OR grouped nav */}
        {trimmedQuery ? (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-2">
              {filteredCards.length > 0
                ? `${filteredCards.length} ta natija — Enter bilan birinchisiga o"tish`
                : 'Hech narsa topilmadi'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredCards.map((c) => (
                <NavCardButton
                  key={c.href}
                  card={c}
                  iconBg="bg-violet-50"
                  iconColor="text-violet-700"
                  onClick={() => router.push(c.href)}
                />
              ))}
            </div>
            {filteredCards.length === 0 && (
              <div className="bg-white rounded-2xl border-[1.5px] border-dashed border-[#ede9e1] p-6 text-center">
                <Sparkles size={20} className="text-[#94a3b8] mx-auto mb-2" />
                <p className="text-sm text-[#64748b]">
                  Boshqacha so&apos;zlar bilan qidirib ko&apos;ring
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
                <span className={`w-1 h-3.5 rounded ${group.iconBg.replace('bg-', 'bg-').replace('-50', '-400')}`} />
                {group.label}
                <span className="text-[10px] font-mono font-semibold text-[#94a3b8]">
                  {group.cards.length}
                </span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {group.cards.map((c) => (
                  <NavCardButton
                    key={c.href}
                    card={c}
                    iconBg={group.iconBg}
                    iconColor={group.iconColor}
                    onClick={() => router.push(c.href)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function NavCardButton({
  card,
  iconBg,
  iconColor,
  onClick,
}: {
  card: Card;
  iconBg: string;
  iconColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative bg-white rounded-[18px] p-4 min-w-0 flex items-center gap-3 border-[1.5px] border-[#ede9e1] transition-all hover:scale-[1.02] hover:border-[#6d28d9] hover:bg-[#6d28d9]/5 text-left"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
        {card.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#0f172a] text-sm font-bold truncate">{card.title}</p>
        <p className="text-[#64748b] text-xs mt-0.5 truncate">{card.desc}</p>
      </div>
      <ChevronRight size={15} className="text-[#94a3b8] shrink-0" />
    </button>
  );
}
