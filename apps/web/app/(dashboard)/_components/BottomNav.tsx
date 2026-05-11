'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  BookOpen,
  Users,
  User,
  GraduationCap,
  BarChart2,
  ClipboardList,
  CreditCard,
  AlertTriangle,
  Building2,
  BookMarked,
  Send,
  FlaskConical,
  Swords,
  Trophy,
  Languages,
} from 'lucide-react';

type Tab = {
  href: string;
  icon: React.ReactNode;
  label: string;
  action?: string;
  activeColor?: string;
};

const STUDENT_GREEN = '#58cc02';
const STAFF_BRAND = '#6d28d9';

const NAV_TABS: Record<string, Tab[]> = {
  student: [
    { href: '/student', icon: <Home size={22} />, label: 'Bosh', activeColor: STUDENT_GREEN },
    { href: '/student/lessons', icon: <BookOpen size={22} />, label: 'Darslar', activeColor: STUDENT_GREEN },
    { href: '/student/translate', icon: <Languages size={22} />, label: 'Tarjima', activeColor: STUDENT_GREEN },
    { href: '/student/duels', icon: <Swords size={22} />, label: 'Duel', activeColor: STUDENT_GREEN },
    { href: '/student/profile', icon: <User size={22} />, label: 'Profil', activeColor: STUDENT_GREEN },
  ],
  mentor: [
    { href: '/mentor', icon: <Home size={20} />, label: 'Bosh' },
    { href: '/mentor/group', icon: <GraduationCap size={20} />, label: 'Guruh' },
    { href: '/mentor/attendance', icon: <BarChart2 size={20} />, label: 'Davomat' },
    { href: '/mentor/tasks', icon: <ClipboardList size={20} />, label: 'Vazifalar' },
    { href: '/mentor/leaderboard', icon: <Trophy size={20} />, label: 'Reyting' },
  ],
  tester: [
    { href: '/tester', icon: <Home size={20} />, label: 'Bosh' },
    { href: '/tester/lessons/current', icon: <FlaskConical size={20} />, label: 'Sinov' },
    { href: '/tester/exam-queue', icon: <ClipboardList size={20} />, label: 'Imtihon' },
  ],
  manager: [
    { href: '/manager', icon: <Home size={20} />, label: 'Bosh' },
    { href: '/manager/students', icon: <Users size={20} />, label: "O'quvchi" },
    { href: '/manager/payments', icon: <CreditCard size={20} />, label: "To'lov" },
    { href: '/manager/tasks', icon: <ClipboardList size={20} />, label: 'Vazifa' },
    { href: '/delegations', icon: <Send size={20} />, label: 'Vakolat' },
  ],
  filadmin: [
    { href: '/filadmin', icon: <Home size={20} />, label: 'Bosh' },
    { href: '/filadmin/attendance', icon: <BarChart2 size={20} />, label: 'Davomat' },
    { href: '/filadmin/payments', icon: <CreditCard size={20} />, label: "To'lov" },
    { href: '/filadmin/warnings', icon: <AlertTriangle size={20} />, label: 'Ogoh.' },
    { href: '/filadmin/tasks', icon: <ClipboardList size={20} />, label: 'Vazifa' },
  ],
  superadmin: [
    { href: '/superadmin', icon: <Home size={20} />, label: 'Bosh' },
    { href: '/superadmin/payments', icon: <CreditCard size={20} />, label: "To'lov" },
    { href: '/superadmin/branches', icon: <Building2 size={20} />, label: 'Filial' },
    { href: '/superadmin/users', icon: <Users size={20} />, label: 'Userlar' },
    { href: '/superadmin/lessons', icon: <BookMarked size={20} />, label: 'Darslar' },
  ],
};

function getRoleFromToken(): string {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { role?: string };
    return payload.role ?? '';
  } catch {
    return '';
  }
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState('');

  useEffect(() => {
    setRole(getRoleFromToken());
  }, []);

  const tabs = NAV_TABS[role] ?? [];
  if (tabs.length === 0) return null;

  function handleTabClick(tab: Tab) {
    if (tab.action === 'logout') {
      localStorage.clear();
      router.push('/login');
      return;
    }
    router.push(tab.href);
  }

  return (
    <nav
      className={[
        'md:hidden fixed bottom-0 left-0 right-0 z-50',
        'bg-[var(--surface)]/95 backdrop-blur-xl',
        'border-t border-[var(--line)]',
        'pb-[env(safe-area-inset-bottom)] px-1 pt-1.5',
        'shadow-[0_-8px_24px_-12px_rgba(30,27,75,0.14)]',
      ].join(' ')}
    >
      <div className="flex justify-around items-stretch max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href.length > 1 &&
              !tabs.some(
                (t) => t !== tab && t.href.startsWith(tab.href + '/'),
              ) &&
              pathname.startsWith(tab.href + '/'));
          const activeColor = tab.activeColor ?? STAFF_BRAND;
          const isStudent = activeColor === STUDENT_GREEN;
          return (
            <button
              key={tab.href}
              onClick={() => handleTabClick(tab)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'relative flex flex-col items-center justify-center gap-0.5',
                'flex-1 min-h-[56px] px-2 rounded-2xl',
                'transition-all duration-200 ease-out',
                'active:scale-95',
              ].join(' ')}
              style={
                isActive
                  ? {
                      color: activeColor,
                      backgroundColor: isStudent
                        ? 'rgba(88, 204, 2, 0.12)'
                        : 'rgba(109, 40, 217, 0.10)',
                    }
                  : { color: 'var(--ink-4)' }
              }
            >
              <span
                className={[
                  'transition-transform duration-200',
                  isActive ? 'scale-110' : '',
                ].join(' ')}
              >
                {tab.icon}
              </span>
              <span
                className={[
                  'text-[10px] leading-none mt-1 tracking-wide',
                  isActive ? 'font-extrabold' : 'font-bold',
                ].join(' ')}
              >
                {tab.label}
              </span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full"
                  style={{ backgroundColor: activeColor }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
