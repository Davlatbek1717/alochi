'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
  Send,
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
  ChevronDown,
  Layers,
  Wrench,
  CheckCircle,
  PiggyBank,
  Calendar,
  HelpCircle,
} from 'lucide-react';

interface SubItem {
  href: string;
  icon?: React.ReactNode;
  label: string;
  description?: string;
}

interface NavEntry {
  label: string;
  /** When set, the entry is a single link (no dropdown). */
  href?: string;
  icon?: React.ReactNode;
  /** Sub-items shown in the dropdown panel. */
  items?: SubItem[];
}

/**
 * Per-role grouped navigation. Top-level entries appear inline on the
 * top bar; entries with `items[]` open a hover/click dropdown panel
 * with sub-pages organised by topic. Replaces the previous left sidebar
 * which only showed 4-5 of the role's destinations and forced a
 * dashboard round-trip to reach the rest.
 */
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
        {
          href: '/superadmin/tenants',
          icon: <Building2 size={14} />,
          label: 'Markazlar',
          description: "A'lochi markazlari ro'yxati",
        },
        {
          href: '/superadmin/branches',
          icon: <Building2 size={14} />,
          label: 'Filiallar',
          description: "Qo'shish, boshqarish",
        },
        {
          href: '/superadmin/contact-requests',
          icon: <Inbox size={14} />,
          label: "Demo so'rovlar",
          description: 'Mijozlardan yangi so\'rov',
        },
      ],
    },
    {
      label: 'Foydalanuvchilar',
      icon: <Users size={15} />,
      items: [
        {
          href: '/superadmin/users',
          icon: <Users size={14} />,
          label: 'Foydalanuvchilar',
          description: 'Yaratish, tahrirlash',
        },
        {
          href: '/superadmin/blocked-students',
          icon: <AlertTriangle size={14} />,
          label: "Bloklangan o'quvchilar",
          description: "To'lov va ogohlantirish",
        },
      ],
    },
    {
      label: 'Ta\'lim',
      icon: <BookMarked size={15} />,
      items: [
        {
          href: '/superadmin/lessons',
          icon: <BookMarked size={14} />,
          label: 'Darslar',
          description: 'Yaratish, tahrirlash, nashr',
        },
        {
          href: '/superadmin/tournaments',
          icon: <Trophy size={14} />,
          label: 'Turnirlar',
          description: 'Musobaqalar boshqaruvi',
        },
        {
          href: '/superadmin/certificate-design',
          icon: <Award size={14} />,
          label: 'Sertifikat dizayni',
          description: 'Shablon va brending',
        },
        {
          href: '/superadmin/adaptive',
          icon: <Zap size={14} />,
          label: 'Adaptiv qiyinlik',
          description: 'N-back sozlamalari',
        },
        {
          href: '/superadmin/content-quality',
          icon: <BarChart2 size={14} />,
          label: 'Kontent sifati',
          description: 'A/B test, pass rate',
        },
      ],
    },
    {
      label: 'Moliya',
      icon: <CreditCard size={15} />,
      items: [
        {
          href: '/superadmin/payments',
          icon: <CreditCard size={14} />,
          label: "To'lovlar",
          description: 'Qarzdorlar, filial statistikasi',
        },
      ],
    },
    {
      label: 'Tahlil',
      icon: <BarChart2 size={15} />,
      items: [
        {
          href: '/superadmin/analytics',
          icon: <BarChart2 size={14} />,
          label: 'Analytics',
          description: 'Filial va dars statistika',
        },
        {
          href: '/superadmin/churn',
          icon: <TrendingDown size={14} />,
          label: 'Churn monitor',
          description: "Xavfli o'quvchilar",
        },
        {
          href: '/superadmin/face-sla',
          icon: <ScanFace size={14} />,
          label: 'Face ID monitoring',
          description: 'Face ID natijalari va SLA',
        },
      ],
    },
    {
      label: 'Sozlamalar',
      icon: <Settings size={15} />,
      items: [
        {
          href: '/superadmin/settings',
          icon: <Settings size={14} />,
          label: 'Sozlamalar',
          description: 'Bloklash chegarasi, telefon',
        },
        {
          href: '/superadmin/keywords',
          icon: <ShieldOff size={14} />,
          label: "Taqiqlangan so'zlar",
          description: 'Chat filtrlash',
        },
        {
          href: '/superadmin/video-guides',
          icon: <Video size={14} />,
          label: "Video qo'llanmalar",
          description: 'Foydalanuvchilar uchun',
        },
        {
          href: '/superadmin/templates',
          icon: <Bell size={14} />,
          label: 'Bildirishnoma shablonlari',
          description: 'Telegram / inapp / SMS',
        },
      ],
    },
  ],

  // ─── Mentor — 5 routes, all flat ──────────────────────────────────────────
  mentor: [
    { label: 'Bosh sahifa', href: '/mentor', icon: <Home size={15} /> },
    { label: 'Guruh', href: '/mentor/group', icon: <GraduationCap size={15} /> },
    { label: 'Davomat', href: '/mentor/attendance', icon: <BarChart2 size={15} /> },
    { label: 'Vazifalar', href: '/mentor/tasks', icon: <ClipboardList size={15} /> },
    { label: "O'quvchilar", href: '/mentor/students', icon: <Users size={15} /> },
  ],

  // ─── Manager — 8 routes ───────────────────────────────────────────────────
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

  // ─── Filadmin — 14 routes grouped into 5 menus ────────────────────────────
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

  // ─── Tester — 5 routes, all flat ──────────────────────────────────────────
  tester: [
    { label: 'Bosh sahifa', href: '/tester', icon: <Home size={15} /> },
    { label: 'Sinov darsi', href: '/tester/lessons/current', icon: <FlaskConical size={15} /> },
    { label: 'Imtihon navbati', href: '/tester/exam-queue', icon: <CheckCircle size={15} /> },
    { label: 'Vazifalar', href: '/tester/tasks', icon: <ClipboardList size={15} /> },
    { label: 'Texnik muammo', href: '/tester/tech-issues', icon: <Wrench size={15} /> },
  ],

  // ─── Student — 5 primary, rest in BrowseMoreGrid on the dashboard ────────
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

export default function TopNav({ role }: Props) {
  const pathname = usePathname();
  const items = NAV[role] ?? [];
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Asosiy navigatsiya"
      className="hidden md:block sticky top-[44px] z-40 bg-white/95 backdrop-blur border-b border-[#ede9e1]"
    >
      <div className="max-w-7xl mx-auto px-4">
        <ul className="flex items-stretch gap-1 overflow-x-auto">
          {items.map((entry) =>
            entry.items ? (
              <DropdownEntry
                key={entry.label}
                entry={entry}
                pathname={pathname}
              />
            ) : (
              <LinkEntry key={entry.label} entry={entry} pathname={pathname} />
            ),
          )}
          <div className="ml-auto inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] gap-1 shrink-0">
            <HelpCircle size={11} />
            <span>{role}</span>
          </div>
        </ul>
      </div>
    </nav>
  );
}

function LinkEntry({
  entry,
  pathname,
}: {
  entry: NavEntry;
  pathname: string;
}) {
  const href = entry.href ?? '#';
  const isActive =
    pathname === href ||
    (href.length > 1 && pathname.startsWith(href + '/'));
  return (
    <li className="shrink-0">
      <Link
        href={href}
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

function DropdownEntry({
  entry,
  pathname,
}: {
  entry: NavEntry;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLLIElement | null>(null);

  // Click-outside to close. Hover handlers below also keep the panel
  // pinned while the cursor is inside either the trigger or the panel.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Active when any of the dropdown's sub-items matches the current path.
  const items = entry.items ?? [];
  const isActive = items.some(
    (s) =>
      pathname === s.href ||
      (s.href.length > 1 && pathname.startsWith(s.href + '/')),
  );

  return (
    <li
      ref={containerRef}
      className="relative shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 px-3 py-2.5 text-sm font-bold border-b-2 transition-colors ${
          isActive
            ? 'border-[#0d9488] text-[#0f172a]'
            : 'border-transparent text-[#64748b] hover:text-[#0f172a] hover:border-[#cbd5e1]'
        }`}
      >
        {entry.icon}
        <span>{entry.label}</span>
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 w-72 bg-white rounded-2xl border-[1.5px] border-[#ede9e1] shadow-xl overflow-hidden motion-safe:animate-[scaleIn_140ms_ease-out_forwards]"
        >
          <ul className="p-1.5 space-y-0.5">
            {items.map((sub) => {
              const subActive =
                pathname === sub.href ||
                (sub.href.length > 1 && pathname.startsWith(sub.href + '/'));
              return (
                <li key={sub.href}>
                  <Link
                    href={sub.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={`flex items-start gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                      subActive
                        ? 'bg-[#0d9488]/10 text-[#0f172a]'
                        : 'text-[#0f172a] hover:bg-[#f7f4ef]'
                    }`}
                  >
                    {sub.icon && (
                      <span
                        className={`mt-0.5 shrink-0 ${
                          subActive ? 'text-[#0d9488]' : 'text-[#64748b]'
                        }`}
                      >
                        {sub.icon}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block font-bold leading-tight truncate">
                        {sub.label}
                      </span>
                      {sub.description && (
                        <span className="block text-[11px] font-medium text-[#64748b] mt-0.5 leading-snug">
                          {sub.description}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}
