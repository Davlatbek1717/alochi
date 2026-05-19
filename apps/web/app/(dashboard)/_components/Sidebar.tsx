'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Home,
  BookOpen,
  Users,
  GraduationCap,
  BarChart2,
  ClipboardList,
  CreditCard,
  AlertTriangle,
  Building2,
  BookMarked,
  Trophy,
  FlaskConical,
  ScanFace,
  Award,
  Video,
  Bell,
  Settings,
  Wrench,
  CheckCircle,
  PiggyBank,
  Calendar,
  Globe,
  Shield,
  ChevronDown,
  ChevronRight,
  LogOut,
  Send,
  Swords,
  User,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface SubItem {
  href: string;
  icon?: React.ReactNode;
  label: string;
}

interface NavEntry {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  items?: SubItem[];
}

/**
 * Sidebar nav config — same shape as the legacy TopNav so any role can
 * be moved over without changes to the structure. Every role lists
 * either a direct-link entry (no `items`) or a section header with
 * sub-items underneath. Sections are collapsible; the section that
 * owns the current path opens automatically.
 */
const NAV: Record<string, NavEntry[]> = {
  superadmin: [
    { label: 'Bosh sahifa', href: '/superadmin', icon: <Home size={16} /> },
    { label: 'Filiallar', href: '/superadmin/branches', icon: <Building2 size={16} /> },
    {
      label: 'Foydalanuvchilar',
      icon: <Users size={16} />,
      items: [
        { href: '/superadmin/users', icon: <Users size={14} />, label: 'Foydalanuvchilar' },
        { href: '/superadmin/blocked-students', icon: <AlertTriangle size={14} />, label: "Bloklangan o'quvchilar" },
        { href: '/superadmin/groups', icon: <Users size={14} />, label: 'Guruhlar' },
      ],
    },
    {
      label: "Ta'lim",
      icon: <BookMarked size={16} />,
      items: [
        { href: '/superadmin/lessons', icon: <BookMarked size={14} />, label: 'Darslar' },
        { href: '/superadmin/exams', icon: <GraduationCap size={14} />, label: 'Imtihonlar' },
        { href: '/superadmin/tournaments', icon: <Trophy size={14} />, label: 'Turnirlar' },
        { href: '/superadmin/certificate-design', icon: <Award size={14} />, label: 'Sertifikat dizayni' },
        { href: '/superadmin/content-quality', icon: <BarChart2 size={14} />, label: 'Kontent sifati' },
      ],
    },
    {
      label: 'Moliya',
      icon: <CreditCard size={16} />,
      items: [
        { href: '/superadmin/payments', icon: <CreditCard size={14} />, label: "To'lovlar" },
      ],
    },
    {
      label: 'Tahlil',
      icon: <BarChart2 size={16} />,
      items: [
        { href: '/superadmin/analytics', icon: <BarChart2 size={14} />, label: 'Analytics' },
        { href: '/superadmin/video-monitoring', icon: <Video size={14} />, label: 'Video monitoring' },
        { href: '/superadmin/face-sla', icon: <ScanFace size={14} />, label: 'Face ID monitoring' },
      ],
    },
    {
      label: 'Sozlamalar',
      icon: <Settings size={16} />,
      items: [
        { href: '/superadmin/settings', icon: <Settings size={14} />, label: 'Sozlamalar' },
        { href: '/superadmin/video-guides', icon: <Video size={14} />, label: "Video qo'llanmalar" },
        { href: '/superadmin/templates', icon: <Bell size={14} />, label: 'Bildirishnoma shablonlari' },
        { href: '/superadmin/landing', icon: <Globe size={14} />, label: 'Landing CMS' },
        { href: '/superadmin/audit-log', icon: <Shield size={14} />, label: 'Audit Log' },
      ],
    },
    { label: 'Delegatsiya', href: '/delegations', icon: <Send size={16} /> },
  ],

  filadmin: [
    { label: 'Bosh sahifa', href: '/filadmin', icon: <Home size={16} /> },
    {
      label: "O'quvchilar",
      icon: <Users size={16} />,
      items: [
        { href: '/filadmin/students', icon: <Users size={14} />, label: "O'quvchilar" },
        { href: '/filadmin/blocked-students', icon: <AlertTriangle size={14} />, label: 'Bloklanganlar' },
        { href: '/filadmin/warnings', icon: <AlertTriangle size={14} />, label: 'Ogohlantirish' },
        { href: '/filadmin/groups', icon: <Users size={14} />, label: 'Guruhlar' },
        { href: '/filadmin/leaderboard', icon: <Trophy size={14} />, label: 'Reyting' },
      ],
    },
    {
      label: 'Davomat',
      icon: <BarChart2 size={16} />,
      items: [
        { href: '/filadmin/attendance', icon: <BarChart2 size={14} />, label: 'Davomat' },
        { href: '/filadmin/face-attendance', icon: <ScanFace size={14} />, label: 'Face davomat' },
        { href: '/filadmin/devices', icon: <Wrench size={14} />, label: 'Qurilmalar' },
      ],
    },
    {
      label: 'Moliya',
      icon: <CreditCard size={16} />,
      items: [
        { href: '/filadmin/payments', icon: <CreditCard size={14} />, label: "To'lovlar" },
        { href: '/filadmin/promotion-report', icon: <BarChart2 size={14} />, label: 'Promo hisobot' },
      ],
    },
    {
      label: 'Xodimlar',
      icon: <Users size={16} />,
      items: [
        { href: '/filadmin/staff', icon: <Users size={14} />, label: 'Xodimlar' },
        { href: '/filadmin/tasks', icon: <ClipboardList size={14} />, label: 'Vazifalar' },
        { href: '/filadmin/kpi', icon: <BarChart2 size={14} />, label: 'KPI' },
        { href: '/filadmin/tournaments', icon: <Trophy size={14} />, label: 'Turnirlar' },
        { href: '/filadmin/video-guides', icon: <Video size={14} />, label: "Qo'llanmalar" },
      ],
    },
    {
      label: "Ta'lim",
      icon: <BookOpen size={16} />,
      items: [
        { href: '/filadmin/lessons', icon: <BookOpen size={14} />, label: 'Darslar' },
      ],
    },
    { label: 'Delegatsiya', href: '/delegations', icon: <Send size={16} /> },
  ],

  manager: [
    { label: 'Bosh sahifa', href: '/manager', icon: <Home size={16} /> },
    {
      label: "O'quvchilar",
      icon: <Users size={16} />,
      items: [
        { href: '/manager/students', icon: <Users size={14} />, label: "O'quvchilar" },
        { href: '/manager/sessions', icon: <Calendar size={14} />, label: 'Sessiyalar' },
        { href: '/manager/certificates', icon: <Award size={14} />, label: 'Sertifikatlar' },
      ],
    },
    {
      label: 'Moliya',
      icon: <CreditCard size={16} />,
      items: [
        { href: '/manager/payments', icon: <CreditCard size={14} />, label: "To'lovlar" },
        { href: '/manager/rewards', icon: <PiggyBank size={14} />, label: 'Mukofotlar' },
      ],
    },
    {
      label: 'Vazifalar',
      icon: <ClipboardList size={16} />,
      items: [
        { href: '/manager/tasks', icon: <ClipboardList size={14} />, label: 'Vazifalar' },
        { href: '/manager/kpi', icon: <BarChart2 size={14} />, label: 'KPI' },
      ],
    },
    { label: 'Vakolatlar', href: '/delegations', icon: <Send size={16} /> },
  ],

  mentor: [
    { label: 'Bosh sahifa', href: '/mentor', icon: <Home size={16} /> },
    { label: 'Guruh', href: '/mentor/group', icon: <GraduationCap size={16} /> },
    { label: 'Davomat', href: '/mentor/attendance', icon: <BarChart2 size={16} /> },
    { label: 'Vazifalar', href: '/mentor/tasks', icon: <ClipboardList size={16} /> },
    { label: "O'quvchilar", href: '/mentor/students', icon: <Users size={16} /> },
    { label: 'Reyting', href: '/mentor/leaderboard', icon: <Trophy size={16} /> },
  ],

  tester: [
    { label: 'Bosh sahifa', href: '/tester', icon: <Home size={16} /> },
    { label: 'Sinov darsi', href: '/tester/lessons/current', icon: <FlaskConical size={16} /> },
    { label: 'Imtihon navbati', href: '/tester/exam-queue', icon: <CheckCircle size={16} /> },
    { label: 'Vazifalar', href: '/tester/tasks', icon: <ClipboardList size={16} /> },
    { label: 'Texnik muammo', href: '/tester/tech-issues', icon: <Wrench size={16} /> },
  ],

  student: [
    { label: 'Bosh sahifa', href: '/student', icon: <Home size={16} /> },
    { label: 'Darslar', href: '/student/lessons', icon: <BookOpen size={16} /> },
    { label: 'Imtihonlar', href: '/student/exams', icon: <GraduationCap size={16} /> },
    { label: "Do'stlar", href: '/student/friends', icon: <Users size={16} /> },
    { label: 'Duel', href: '/student/duels', icon: <Swords size={16} /> },
    { label: 'Profil', href: '/student/profile', icon: <User size={16} /> },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Superadmin',
  filadmin: 'Filadmin',
  manager: 'Menejer',
  mentor: 'Mentor',
  tester: 'Tester',
  student: "O'quvchi",
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/**
 * Decide which path "owns" a section so the section auto-opens. Same
 * three-phase resolution as the old TopNav: prefer a sub-item match,
 * then exact direct-link, then longest-prefix direct-link.
 */
function findActiveLabel(items: NavEntry[], pathname: string): string | null {
  for (const entry of items) {
    if (
      entry.items?.some(
        (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
      )
    ) {
      return entry.label;
    }
  }
  for (const entry of items) {
    if (entry.href && pathname === entry.href) return entry.label;
  }
  let best: string | null = null;
  let bestLen = 0;
  for (const entry of items) {
    if (
      entry.href &&
      entry.href.length > bestLen &&
      pathname.startsWith(entry.href + '/')
    ) {
      best = entry.label;
      bestLen = entry.href.length;
    }
  }
  return best;
}

interface SidebarProps {
  role: string;
  userName: string;
  brandName: string | null;
  onLogout: () => void;
}

export default function Sidebar({ role, userName, brandName, onLogout }: SidebarProps) {
  const pathname = usePathname() ?? '';
  // Memoise the role's nav items so useMemo deps below don't churn on
  // every render. The NAV constant is module-scope, so an identical
  // role always yields the same array reference.
  const items = useMemo(() => NAV[role] ?? [], [role]);

  const activeLabel = useMemo(() => findActiveLabel(items, pathname), [items, pathname]);

  // Track which section labels are open. Sections with items default to
  // closed; the section owning the current path opens automatically and
  // re-opens whenever the route changes.
  const [openSections, setOpenSections] = useState<Set<string>>(() =>
    activeLabel ? new Set([activeLabel]) : new Set(),
  );

  useEffect(() => {
    if (!activeLabel) return;
    setOpenSections((prev) => {
      if (prev.has(activeLabel)) return prev;
      const next = new Set(prev);
      next.add(activeLabel);
      return next;
    });
  }, [activeLabel]);

  function toggleSection(label: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  if (items.length === 0) return null;

  return (
    <aside
      aria-label="Asosiy navigatsiya"
      className={[
        'hidden md:flex flex-col fixed left-0 top-0 bottom-0 z-40',
        'w-64',
        'bg-[var(--surface)] border-r border-[var(--line)]',
      ].join(' ')}
    >
      {/* Header — avatar + user + brand */}
      <div className="px-4 py-4 border-b border-[var(--line)] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={[
              'grid place-items-center shrink-0',
              'w-9 h-9 rounded-xl',
              'bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)]',
              'text-white text-[11px] font-extrabold tracking-wide',
              'shadow-[0_4px_12px_-4px_rgba(109,40,217,0.5)]',
            ].join(' ')}
          >
            {userName ? getInitials(userName) : '…'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--ink)] truncate leading-tight">
              {userName || '…'}
            </p>
            <p className="text-[10px] text-[var(--ink-4)] truncate leading-tight font-bold uppercase tracking-[0.18em] mt-0.5">
              {brandName ?? "A'lojon"}
            </p>
          </div>
        </div>
        <span
          className={[
            'inline-flex items-center mt-3',
            'px-2.5 py-1 rounded-full',
            'bg-[var(--brand-soft)] text-[var(--brand)]',
            'text-[10px] font-extrabold uppercase tracking-[0.18em]',
          ].join(' ')}
        >
          {ROLE_LABELS[role] ?? role}
        </span>
      </div>

      {/* Nav body */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {items.map((entry) => (
          <SidebarEntry
            key={entry.label}
            entry={entry}
            pathname={pathname}
            isOpen={openSections.has(entry.label)}
            onToggle={() => toggleSection(entry.label)}
          />
        ))}
      </nav>

      {/* Footer — notifications + logout */}
      <div className="border-t border-[var(--line)] px-2 py-2 space-y-0.5 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--ink-3)]">
          <NotificationBell />
          <span className="text-xs font-semibold">Bildirishnomalar</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className={[
            'w-full flex items-center gap-2.5',
            'px-3 py-2 rounded-lg',
            'text-sm font-semibold text-[var(--ink-3)]',
            'hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
            'transition-colors duration-150',
          ].join(' ')}
        >
          <LogOut size={16} className="shrink-0" />
          <span>Chiqish</span>
        </button>
      </div>
    </aside>
  );
}

interface EntryProps {
  entry: NavEntry;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
}

function SidebarEntry({ entry, pathname, isOpen, onToggle }: EntryProps) {
  // Direct-link entry — single Link row, no chevron.
  if (!entry.items || entry.items.length === 0) {
    const isActive =
      entry.href === pathname ||
      (entry.href && entry.href !== '/' && pathname.startsWith(entry.href + '/'));
    return (
      <Link
        href={entry.href ?? '#'}
        className={[
          'flex items-center gap-2.5 px-3 py-2 rounded-lg',
          'text-sm font-semibold transition-colors duration-150',
          isActive
            ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
            : 'text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
        ].join(' ')}
      >
        <span className={isActive ? 'text-[var(--brand)]' : 'text-[var(--ink-4)]'}>
          {entry.icon}
        </span>
        <span className="truncate">{entry.label}</span>
      </Link>
    );
  }

  // Section header with collapsible sub-items.
  const hasActiveChild = entry.items.some(
    (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
  );

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={[
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg',
          'text-sm font-semibold transition-colors duration-150',
          hasActiveChild
            ? 'text-[var(--ink)]'
            : 'text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
        ].join(' ')}
      >
        <span
          className={
            hasActiveChild ? 'text-[var(--brand)]' : 'text-[var(--ink-4)]'
          }
        >
          {entry.icon}
        </span>
        <span className="flex-1 text-left truncate">{entry.label}</span>
        <span className="text-[var(--ink-4)] shrink-0">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {isOpen && (
        <ul className="mt-0.5 mb-1.5 ml-3 pl-3 border-l border-[var(--line)] space-y-0.5">
          {entry.items.map((sub) => {
            const isActive =
              pathname === sub.href || pathname.startsWith(sub.href + '/');
            return (
              <li key={sub.href}>
                <Link
                  href={sub.href}
                  className={[
                    'flex items-center gap-2 px-3 py-1.5 rounded-lg',
                    'text-[13px] font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-[var(--brand-soft)] text-[var(--brand)] font-semibold'
                      : 'text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]',
                  ].join(' ')}
                >
                  {sub.icon && (
                    <span
                      className={
                        isActive ? 'text-[var(--brand)]' : 'text-[var(--ink-4)]'
                      }
                    >
                      {sub.icon}
                    </span>
                  )}
                  <span className="truncate">{sub.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
