'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ShieldOff,
  Trophy,
  FlaskConical,
  Inbox,
  Zap,
  TrendingDown,
  ScanFace,
  Award,
  Video,
  Bell,
  Settings,
  Layers,
  Wrench,
  CheckCircle,
  PiggyBank,
  Calendar,
} from 'lucide-react';

interface SubItem {
  href: string;
  icon?: React.ReactNode;
  label: string;
}

interface NavEntry {
  label: string;
  /** When set, the entry is a single direct link (no sub-items). */
  href?: string;
  icon?: React.ReactNode;
  /** Sub-pages of this section. The first sub-item is treated as the
   *  default landing for the group. */
  items?: SubItem[];
}

const NAV: Record<string, NavEntry[]> = {
  // ─── Superadmin — 19 routes grouped into 6 menus ─────────────────────────
  superadmin: [
    {
      label: 'Bosh sahifa',
      href: '/superadmin',
      icon: <Home size={15} />,
    },
    {
      label: 'Markazlar',
      icon: <Building2 size={15} />,
      items: [
        { href: '/superadmin/tenants', icon: <Building2 size={14} />, label: 'Markazlar' },
        { href: '/superadmin/branches', icon: <Building2 size={14} />, label: 'Filiallar' },
        { href: '/superadmin/contact-requests', icon: <Inbox size={14} />, label: "Demo so'rovlar" },
      ],
    },
    {
      label: 'Foydalanuvchilar',
      icon: <Users size={15} />,
      items: [
        { href: '/superadmin/users', icon: <Users size={14} />, label: 'Foydalanuvchilar' },
        { href: '/superadmin/blocked-students', icon: <AlertTriangle size={14} />, label: "Bloklangan o'quvchilar" },
      ],
    },
    {
      label: "Ta'lim",
      icon: <BookMarked size={15} />,
      items: [
        { href: '/superadmin/lessons', icon: <BookMarked size={14} />, label: 'Darslar' },
        { href: '/superadmin/exams', icon: <GraduationCap size={14} />, label: 'Imtihonlar' },
        { href: '/superadmin/tournaments', icon: <Trophy size={14} />, label: 'Turnirlar' },
        { href: '/superadmin/certificate-design', icon: <Award size={14} />, label: 'Sertifikat dizayni' },
        { href: '/superadmin/adaptive', icon: <Zap size={14} />, label: 'Adaptiv qiyinlik' },
        { href: '/superadmin/content-quality', icon: <BarChart2 size={14} />, label: 'Kontent sifati' },
      ],
    },
    {
      label: 'Moliya',
      icon: <CreditCard size={15} />,
      items: [
        { href: '/superadmin/payments', icon: <CreditCard size={14} />, label: "To'lovlar" },
      ],
    },
    {
      label: 'Tahlil',
      icon: <BarChart2 size={15} />,
      items: [
        { href: '/superadmin/analytics', icon: <BarChart2 size={14} />, label: 'Analytics' },
        { href: '/superadmin/churn', icon: <TrendingDown size={14} />, label: 'Churn monitor' },
        { href: '/superadmin/face-sla', icon: <ScanFace size={14} />, label: 'Face ID monitoring' },
      ],
    },
    {
      label: 'Sozlamalar',
      icon: <Settings size={15} />,
      items: [
        { href: '/superadmin/settings', icon: <Settings size={14} />, label: 'Sozlamalar' },
        { href: '/superadmin/keywords', icon: <ShieldOff size={14} />, label: "Taqiqlangan so'zlar" },
        { href: '/superadmin/video-guides', icon: <Video size={14} />, label: "Video qo'llanmalar" },
        { href: '/superadmin/templates', icon: <Bell size={14} />, label: 'Bildirishnoma shablonlari' },
      ],
    },
  ],

  mentor: [
    { label: 'Bosh sahifa', href: '/mentor', icon: <Home size={15} /> },
    { label: 'Guruh', href: '/mentor/group', icon: <GraduationCap size={15} /> },
    { label: 'Davomat', href: '/mentor/attendance', icon: <BarChart2 size={15} /> },
    { label: 'Vazifalar', href: '/mentor/tasks', icon: <ClipboardList size={15} /> },
    { label: "O'quvchilar", href: '/mentor/students', icon: <Users size={15} /> },
  ],

  manager: [
    { label: 'Bosh sahifa', href: '/manager', icon: <Home size={15} /> },
    {
      label: "O'quvchilar",
      icon: <Users size={15} />,
      items: [
        { href: '/manager/students', icon: <Users size={14} />, label: "O'quvchilar" },
        { href: '/manager/sessions', icon: <Calendar size={14} />, label: 'Sessiyalar' },
        { href: '/manager/certificates', icon: <Award size={14} />, label: 'Sertifikatlar' },
      ],
    },
    {
      label: 'Moliya',
      icon: <CreditCard size={15} />,
      items: [
        { href: '/manager/payments', icon: <CreditCard size={14} />, label: "To'lovlar" },
        { href: '/manager/rewards', icon: <PiggyBank size={14} />, label: 'Mukofotlar' },
      ],
    },
    {
      label: 'Vazifalar',
      icon: <ClipboardList size={15} />,
      items: [
        { href: '/manager/tasks', icon: <ClipboardList size={14} />, label: 'Vazifalar' },
        { href: '/manager/kpi', icon: <BarChart2 size={14} />, label: 'KPI' },
      ],
    },
  ],

  filadmin: [
    { label: 'Bosh sahifa', href: '/filadmin', icon: <Home size={15} /> },
    {
      label: "O'quvchilar",
      icon: <Users size={15} />,
      items: [
        { href: '/filadmin/students', icon: <Users size={14} />, label: "O'quvchilar" },
        { href: '/filadmin/blocked-students', icon: <AlertTriangle size={14} />, label: 'Bloklanganlar' },
        { href: '/filadmin/warnings', icon: <AlertTriangle size={14} />, label: 'Ogohlantirish' },
      ],
    },
    {
      label: 'Davomat',
      icon: <BarChart2 size={15} />,
      items: [
        { href: '/filadmin/attendance', icon: <BarChart2 size={14} />, label: 'Davomat' },
        { href: '/filadmin/face-attendance', icon: <ScanFace size={14} />, label: 'Face davomat' },
        { href: '/filadmin/devices', icon: <Wrench size={14} />, label: 'Qurilmalar' },
      ],
    },
    {
      label: 'Moliya',
      icon: <CreditCard size={15} />,
      items: [
        { href: '/filadmin/payments', icon: <CreditCard size={14} />, label: "To'lovlar" },
        { href: '/filadmin/promotion-report', icon: <BarChart2 size={14} />, label: 'Promo hisobot' },
      ],
    },
    {
      label: 'Xodimlar',
      icon: <Users size={15} />,
      items: [
        { href: '/filadmin/staff', icon: <Users size={14} />, label: 'Xodimlar' },
        { href: '/filadmin/tasks', icon: <ClipboardList size={14} />, label: 'Vazifalar' },
        { href: '/filadmin/kpi', icon: <BarChart2 size={14} />, label: 'KPI' },
        { href: '/filadmin/tournaments', icon: <Trophy size={14} />, label: 'Turnirlar' },
        { href: '/filadmin/video-guides', icon: <Video size={14} />, label: "Qo'llanmalar" },
      ],
    },
  ],

  tester: [
    { label: 'Bosh sahifa', href: '/tester', icon: <Home size={15} /> },
    { label: 'Sinov darsi', href: '/tester/lessons/current', icon: <FlaskConical size={15} /> },
    { label: 'Imtihon navbati', href: '/tester/exam-queue', icon: <CheckCircle size={15} /> },
    { label: 'Vazifalar', href: '/tester/tasks', icon: <ClipboardList size={15} /> },
    { label: 'Texnik muammo', href: '/tester/tech-issues', icon: <Wrench size={15} /> },
  ],

  student: [
    { label: 'Bosh sahifa', href: '/student', icon: <Home size={15} /> },
    { label: 'Darslar', href: '/student/lessons', icon: <BookOpen size={15} /> },
    { label: 'Imtihonlar', href: '/student/exams', icon: <GraduationCap size={15} /> },
    { label: "Do'stlar", href: '/student/friends', icon: <Users size={15} /> },
    { label: 'Profil', href: '/student/profile', icon: <Layers size={15} /> },
  ],
};

interface Props {
  role: string;
}

/**
 * Two-row top navigation:
 *
 *   Row 1 — primary groups. Always visible. Each group either is a
 *           direct link (Bosh sahifa) or a section header. Clicking
 *           a section header navigates to its first sub-item.
 *   Row 2 — sub-pills of the currently active section. Renders only
 *           when the active group has sub-items, persists for as long
 *           as the user stays inside that section, and disappears on
 *           plain links or when off-section (dashboard, profile).
 *
 * This replaces the previous hover-dropdown design that surfaced
 * sub-items only on hover and was easy to miss when the dark page
 * header sat right under the menu — visibility was the user-reported
 * issue. Now sub-items are *always* visible the moment you're inside
 * a section.
 */
export default function TopNav({ role }: Props) {
  const pathname = usePathname();
  const items = NAV[role] ?? [];
  if (items.length === 0) return null;

  const activeEntry = findActiveEntry(items, pathname);

  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="hidden md:block sticky top-[44px] z-40 bg-white border-b border-[#ede9e1]"
    >
      <div className="max-w-7xl mx-auto px-4">
        {/* Row 1 — primary groups */}
        <ul className="flex items-stretch gap-1 overflow-x-auto">
          {items.map((entry) => (
            <PrimaryEntry
              key={entry.label}
              entry={entry}
              isActive={entry === activeEntry}
            />
          ))}
          <div className="ml-auto inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] gap-1 shrink-0 px-2">
            <span>{role}</span>
          </div>
        </ul>

        {/* Row 2 — sub-pills for the active section. Only shown when
            the active group has sub-items so dashboard and direct-link
            destinations don't render an empty strip. */}
        {activeEntry?.items && activeEntry.items.length > 0 && (
          <div className="bg-[#fffaf0] -mx-4 px-4 border-t border-[#f3eedf]">
            <ul className="flex items-center gap-1.5 overflow-x-auto py-2 max-w-7xl mx-auto">
              {activeEntry.items.map((sub) => {
                const isSubActive =
                  pathname === sub.href ||
                  pathname.startsWith(sub.href + '/');
                return (
                  <li key={sub.href} className="shrink-0">
                    <Link
                      href={sub.href}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-bold rounded-full transition-colors ${
                        isSubActive
                          ? 'bg-[#0d9488] text-white'
                          : 'bg-white text-[#64748b] border border-[#ede9e1] hover:text-[#0f172a] hover:border-[#0d9488]/40'
                      }`}
                    >
                      {sub.icon && (
                        <span className={isSubActive ? 'text-white' : 'text-[#94a3b8]'}>
                          {sub.icon}
                        </span>
                      )}
                      {sub.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}

/**
 * Resolve which nav entry "owns" the current path. Done in three
 * phases so root-style hrefs (like "/superadmin") don't shadow
 * deeper sections that nest underneath them:
 *
 *   1. Prefer the group whose sub-item href matches the path. This
 *      catches the common case ("/superadmin/tenants" belongs to
 *      "Markazlar").
 *   2. Fall back to a direct-link entry with an EXACT path match.
 *      Only exact — never a prefix — so "/superadmin" matches the
 *      dashboard entry but doesn't claim every nested route.
 *   3. Last resort: longest-prefix match against any direct-link
 *      entry. Used for routes deeper than a known link, e.g.
 *      "/tester/lessons/current/X" mapping back to "Sinov darsi".
 */
function findActiveEntry(
  items: NavEntry[],
  pathname: string,
): NavEntry | undefined {
  // Phase 1 — group sub-items.
  for (const entry of items) {
    if (
      entry.items?.some(
        (s) => pathname === s.href || pathname.startsWith(s.href + '/'),
      )
    ) {
      return entry;
    }
  }
  // Phase 2 — exact direct-link match.
  for (const entry of items) {
    if (entry.href && pathname === entry.href) return entry;
  }
  // Phase 3 — longest-prefix direct-link match.
  let best: NavEntry | undefined;
  let bestLen = 0;
  for (const entry of items) {
    if (
      entry.href &&
      entry.href.length > bestLen &&
      pathname.startsWith(entry.href + '/')
    ) {
      best = entry;
      bestLen = entry.href.length;
    }
  }
  return best;
}

function PrimaryEntry({
  entry,
  isActive,
}: {
  entry: NavEntry;
  isActive: boolean;
}) {
  // For section groups, clicking the header navigates to the first
  // sub-item (the section's "default page"). Direct-link entries
  // (Bosh sahifa) just route to their href.
  const targetHref = entry.href ?? entry.items?.[0]?.href ?? '#';
  return (
    <li className="shrink-0">
      <Link
        href={targetHref}
        className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors ${
          isActive
            ? 'border-[#0d9488] text-[#0f172a]'
            : 'border-transparent text-[#64748b] hover:text-[#0f172a] hover:border-[#cbd5e1]'
        }`}
      >
        {entry.icon}
        <span>{entry.label}</span>
      </Link>
    </li>
  );
}
