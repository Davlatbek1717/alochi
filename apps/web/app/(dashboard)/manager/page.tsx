'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';
import {
  Users, CreditCard, ClipboardList, Send, AlertCircle, AlertTriangle,
  TrendingUp, Trophy, Calendar, Award, ChevronRight, Search, Plus,
  Sparkles, Clock,
} from 'lucide-react';
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

type Card = {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
};

type Group = {
  id: string;
  label: string;
  iconBg: string;
  iconColor: string;
  cards: Card[];
};

// ── Navigation grouped into three clusters ─────────────────────────────────
// Manager's day is: monitor students → run sessions → pay/reward → admin.
// Categorise by that flow so the most-used cluster (students + payments)
// sits at the top.
const NAV_GROUPS: Group[] = [
  {
    id: 'students',
    label: 'O‘quvchilar va to‘lov',
    iconBg: 'bg-violet-50',
    iconColor: 'text-violet-700',
    cards: [
      { href: '/manager/students',    icon: <Users size={20} />,        title: "O'quvchilar",    desc: 'Status boshqaruv' },
      { href: '/manager/payments',    icon: <CreditCard size={20} />,   title: "To'lovlar",      desc: 'Qarzdorlar hisobi' },
      { href: '/manager/certificates',icon: <Award size={20} />,        title: 'Sertifikatlar',  desc: "O'quvchi sertifikatlari" },
      { href: '/manager/study-time',  icon: <Clock size={20} />,        title: "O'quv vaqti",    desc: 'Kunlik / oraliq hisobot' },
    ],
  },
  {
    id: 'engagement',
    label: 'Sessiya, vazifa, mukofot',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-700',
    cards: [
      { href: '/manager/sessions',    icon: <Calendar size={20} />,     title: '1:1 Sessiyalar', desc: 'Individual rejalashtirish' },
      { href: '/manager/tasks',       icon: <ClipboardList size={20} />,title: 'Vazifalar',      desc: "Topshiriqlarim" },
      { href: '/manager/rewards',     icon: <Trophy size={20} />,        title: "Sovg'a / Kitob", desc: "Rag'batlantirish" },
    ],
  },
  {
    id: 'admin',
    label: 'Boshqaruv',
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    cards: [
      { href: '/delegations',         icon: <Send size={20} />,         title: 'Vakolatlar',     desc: 'Menga berilgan vakolatlar' },
    ],
  },
];

const QUICK_ACTIONS = [
  { href: '/manager/students',  icon: <Users size={16} />,        label: "O'quvchilar",  tone: 'violet' },
  { href: '/manager/payments',  icon: <CreditCard size={16} />,   label: "To'lov",       tone: 'emerald' },
  { href: '/manager/sessions',  icon: <Calendar size={16} />,     label: 'Sessiya',      tone: 'amber' },
  { href: '/manager/tasks',     icon: <ClipboardList size={16} />,label: 'Vazifa',       tone: 'orange' },
];

const TONE_COLORS: Record<string, string> = {
  violet: 'text-violet-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  orange: 'text-orange-700',
};

const ALL_CARDS: Card[] = NAV_GROUPS.flatMap((g) => g.cards);

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

type AttentionTab = 'red' | 'yellow' | 'top';

export default function ManagerDashboard() {
  const router = useRouter();
  const toast = useToast();
  const [redStudents, setRedStudents] = useState<StatusStudent[]>([]);
  const [yellowStudents, setYellowStudents] = useState<StatusStudent[]>([]);
  const [highPerformers, setHighPerformers] = useState<HighPerformer[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerName, setManagerName] = useState('');
  const [branchIdForPanel, setBranchIdForPanel] = useState('');
  const [query, setQuery] = useState('');
  // Combined "attention" panel tabs — red students by default, then
  // yellow + top performers. Saves two repetitive sections of vertical
  // space and lets the manager pivot with one tap.
  const [attentionTab, setAttentionTab] = useState<AttentionTab>('red');

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

  useFocusRevalidate(load);
  useRevalidateOnEvent(['status:updated', 'kpi:updated'], load);

  const alertCount = redStudents.length + yellowStudents.length;

  // Client-side nav card search
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
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="flex justify-between items-start mb-5 relative z-10">
          <div className="min-w-0">
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Manager Panel</p>
            <p className="text-white text-xl font-bold truncate">{managerName || 'Manager'}</p>
            <p className="text-[#475569] text-xs mt-1 font-mono truncate">
              {formatDateWeekday(new Date())}
            </p>
          </div>
        </div>

        {/* Alert badge */}
        <div className={`rounded-2xl p-4 relative z-10 flex items-center gap-4 ${alertCount > 0 ? 'bg-[#e11d48]/10 border border-[#e11d48]/20' : 'bg-[#0d9488]/10 border border-[#0d9488]/20'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${alertCount > 0 ? 'bg-[#e11d48]/15 border border-[#e11d48]/30' : 'bg-[#0d9488]/15 border border-[#0d9488]/30'}`}>
            <AlertCircle size={22} className={alertCount > 0 ? 'text-[#e11d48]' : 'text-[#0d9488]'} />
          </div>
          <div className="flex-1 min-w-0">
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
            <div className="flex items-center gap-1 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl px-3 py-1.5 shrink-0">
              <Trophy size={14} className="text-[#f59e0b]" />
              <span className="text-[#f59e0b] text-xs font-bold">{highPerformers.length}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <ChevronRight size={13} className="text-[#94a3b8] ml-auto shrink-0" />
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
            placeholder="Bo'limni qidiring (masalan: to'lov, sertifikat)..."
            className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-2xl pl-10 pr-3 py-3 min-h-[44px] text-sm text-[#0f172a] focus:outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 placeholder:text-[#94a3b8]"
          />
        </div>

        {/* Filtered nav OR grouped nav */}
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
                <p className="text-sm text-[#64748b]">Boshqacha so‘zlar bilan qidirib ko‘ring</p>
              </div>
            )}
          </div>
        ) : (
          NAV_GROUPS.map((group) => (
            <section key={group.id}>
              <h2 className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2 flex items-center gap-2">
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

        {/* Attention panel — tabbed Red / Yellow / Top instead of three
            stacked sections. Saves ~600px of scroll on a typical branch
            and lets the manager pivot with one tap. */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">
              Diqqat panel
            </p>
          </div>
          <div className="flex gap-1 bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-1 mb-3">
            {([
              { key: 'red',    label: 'Qizil',  count: redStudents.length,    dot: 'bg-rose-500' },
              { key: 'yellow', label: 'Sariq',  count: yellowStudents.length, dot: 'bg-amber-500' },
              { key: 'top',    label: '200%+',  count: highPerformers.length, dot: 'bg-emerald-500' },
            ] as { key: AttentionTab; label: string; count: number; dot: string }[]).map((t) => {
              const active = attentionTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setAttentionTab(t.key)}
                  className={[
                    'flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-extrabold transition-colors',
                    active
                      ? 'bg-[#0f172a] text-white'
                      : 'text-[#64748b] hover:text-[#0f172a]',
                  ].join(' ')}
                >
                  <span className={`w-2 h-2 rounded-full ${t.dot}`} />
                  {t.label}
                  <span className={active ? 'text-white/70' : 'text-[#94a3b8]'}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {attentionTab === 'red' && (
            <AttentionList
              loading={loading}
              items={redStudents.map((s) => ({
                id: s.studentId,
                studentId: s.student.id,
                name: s.student.name,
                meta: [s.englishStatus, s.personalStatus, s.criticalStatus].filter(Boolean).join(' · '),
              }))}
              tint="rose"
              hrefPrefix="/manager/students"
              emptyIcon={<AlertCircle size={24} />}
              emptyLabel="Qizil o'quvchi yo'q"
            />
          )}

          {attentionTab === 'yellow' && (
            <AttentionList
              loading={loading}
              items={yellowStudents.map((s) => ({
                id: s.studentId,
                studentId: s.student.id,
                name: s.student.name,
                meta: [s.englishStatus, s.personalStatus, s.criticalStatus].filter(Boolean).join(' · '),
              }))}
              tint="amber"
              hrefPrefix="/manager/students"
              emptyIcon={<AlertTriangle size={24} />}
              emptyLabel="Sariq o'quvchi yo'q"
            />
          )}

          {attentionTab === 'top' && (
            <AttentionList
              loading={loading}
              items={highPerformers.map((s) => ({
                id: s.id,
                studentId: s.id,
                name: s.name,
                meta: `${s.lessonsCompleted}/${s.totalLessons} dars`,
              }))}
              tint="emerald"
              hrefPrefix="/manager/students"
              emptyIcon={<Trophy size={24} />}
              emptyLabel="200%+ natijali o'quvchi yo'q"
            />
          )}
        </section>

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
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg} ${iconColor}`}>
        {card.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#0f172a] text-sm font-bold truncate">{card.title}</p>
        <p className="text-[#64748b] text-xs mt-0.5 truncate">{card.desc}</p>
      </div>
      <ChevronRight size={15} className="text-[#94a3b8] shrink-0" />
    </Link>
  );
}

/**
 * Compact "attention" list used inside the tabbed panel. Shared between
 * red / yellow / top tabs so the empty state and skeleton stay
 * consistent across tabs.
 */
function AttentionList({
  loading,
  items,
  tint,
  hrefPrefix,
  emptyIcon,
  emptyLabel,
}: {
  loading: boolean;
  items: Array<{ id: string; studentId: string; name: string; meta: string }>;
  tint: 'rose' | 'amber' | 'emerald';
  hrefPrefix: string;
  emptyIcon: React.ReactNode;
  emptyLabel: string;
}) {
  const styles: Record<typeof tint, { border: string; avatarBg: string; avatarText: string; trail: string }> = {
    rose:    { border: 'border-rose-100',    avatarBg: 'bg-rose-100',    avatarText: 'text-rose-700',    trail: 'text-rose-400' },
    amber:   { border: 'border-amber-100',   avatarBg: 'bg-amber-100',   avatarText: 'text-amber-700',   trail: 'text-amber-400' },
    emerald: { border: 'border-emerald-100', avatarBg: 'bg-emerald-100', avatarText: 'text-emerald-700', trail: 'text-emerald-400' },
  };
  const s = styles[tint];

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-[14px] p-3 border-[1.5px] border-[#ede9e1] flex items-center gap-3">
            <Skeleton theme="light" className="w-9 h-9 rounded-xl shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton theme="light" className="h-4 w-1/2" />
              <Skeleton theme="light" className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] overflow-hidden">
        <EmptyState icon={emptyIcon} title={emptyLabel} theme="light" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((it) => (
        <Link
          key={it.id}
          href={`${hrefPrefix}/${it.studentId}`}
          className={`bg-white rounded-[14px] px-4 py-3 border-[1.5px] ${s.border} flex items-center gap-3 hover:scale-[1.01] transition-transform`}
        >
          <div className={`w-9 h-9 rounded-xl ${s.avatarBg} ${s.avatarText} flex items-center justify-center text-sm font-black shrink-0`}>
            {getInitials(it.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#0f172a] text-sm font-semibold truncate">{it.name}</p>
            <p className="text-[#94a3b8] text-[11px] truncate">{it.meta}</p>
          </div>
          {tint === 'emerald' ? (
            <Trophy size={14} className="text-[#f59e0b] shrink-0" />
          ) : (
            <TrendingUp size={14} className={`${s.trail} shrink-0`} />
          )}
        </Link>
      ))}
    </div>
  );
}
