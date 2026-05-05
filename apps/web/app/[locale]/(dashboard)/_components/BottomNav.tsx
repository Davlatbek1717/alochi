'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, BookOpen, Users, User,
  GraduationCap, BarChart2, ClipboardList,
  CreditCard, AlertTriangle, Building2,
  BookMarked, Send, FlaskConical, Swords,
} from 'lucide-react';

type Tab = {
  href: string;
  icon: React.ReactNode;
  label: string;
  action?: string;
  /** Tailwind text colour applied to the active state. Defaults to the
   *  panel's primary tint per role (green for student, amber for staff). */
  activeColor?: string;
};

/**
 * Per-role bottom tabs. The student panel uses the Duolingo-grade green
 * (#58cc02) so the nav matches the rest of that surface; staff panels
 * keep amber so they stay visually distinct from the student app.
 */
const STUDENT_GREEN = '#58cc02';
const STAFF_AMBER = '#f59e0b';

const NAV_TABS: Record<string, Tab[]> = {
  student: [
    { href: '/student',         icon: <Home size={22} />,           label: 'Bosh',    activeColor: STUDENT_GREEN },
    { href: '/student/lessons', icon: <BookOpen size={22} />,       label: 'Darslar', activeColor: STUDENT_GREEN },
    { href: '/student/duels',   icon: <Swords size={22} />,         label: 'Duel',    activeColor: STUDENT_GREEN },
    { href: '/student/profile', icon: <User size={22} />,           label: 'Profil',  activeColor: STUDENT_GREEN },
  ],
  mentor: [
    { href: '/mentor',            icon: <Home size={20} />,         label: 'Bosh'      },
    { href: '/mentor/group',      icon: <GraduationCap size={20} />,label: 'Guruh'     },
    { href: '/mentor/attendance', icon: <BarChart2 size={20} />,    label: 'Davomat'   },
    { href: '/mentor/tasks',      icon: <ClipboardList size={20} />,label: 'Vazifalar' },
  ],
  tester: [
    { href: '/tester',                 icon: <Home size={20} />,         label: 'Bosh'           },
    { href: '/tester/lessons/current', icon: <FlaskConical size={20} />, label: 'Sinov darsi'    },
    { href: '/tester/exam-queue',      icon: <ClipboardList size={20} />,label: 'Imtihon navbati' },
  ],
  manager: [
    { href: '/manager',             icon: <Home size={20} />,         label: 'Bosh'        },
    { href: '/manager/students',    icon: <Users size={20} />,        label: "O'quvchilar" },
    { href: '/manager/payments',    icon: <CreditCard size={20} />,   label: "To'lovlar"   },
    { href: '/manager/tasks',       icon: <ClipboardList size={20} />,label: 'Vazifalar'   },
    { href: '/manager/delegations', icon: <Send size={20} />,         label: 'Delegatsiya' },
  ],
  filadmin: [
    { href: '/filadmin',            icon: <Home size={20} />,          label: 'Bosh'          },
    { href: '/filadmin/attendance', icon: <BarChart2 size={20} />,     label: 'Davomat'       },
    { href: '/filadmin/payments',   icon: <CreditCard size={20} />,    label: "To'lovlar"     },
    { href: '/filadmin/warnings',   icon: <AlertTriangle size={20} />, label: 'Ogohlantirish' },
    { href: '/filadmin/tasks',      icon: <ClipboardList size={20} />, label: 'Vazifalar'     },
  ],
  superadmin: [
    { href: '/superadmin',          icon: <Home size={20} />,       label: 'Bosh'             },
    { href: '/superadmin/payments', icon: <CreditCard size={20} />, label: "To'lovlar"        },
    { href: '/superadmin/branches', icon: <Building2 size={20} />,  label: 'Filiallar'        },
    { href: '/superadmin/users',    icon: <Users size={20} />,      label: 'Foydalanuvchilar' },
    { href: '/superadmin/lessons',  icon: <BookMarked size={20} />, label: 'Darslar'          },
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
      className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#ede9e1] pb-[env(safe-area-inset-bottom)] px-1 pt-1.5 z-50"
      style={{ boxShadow: '0 -4px 16px -8px rgba(15, 23, 42, 0.08)' }}
    >
      <div className="flex justify-around items-stretch max-w-lg mx-auto">
        {tabs.map((tab) => {
          // A tab is "active" if the path is exactly its href OR a descendant
          // of it AND no sibling tab is a more specific prefix (so that
          // /student/duels doesn't also light up /student).
          const isActive =
            pathname === tab.href ||
            (tab.href.length > 1 &&
              !tabs.some(
                (t) => t !== tab && t.href.startsWith(tab.href + '/'),
              ) &&
              pathname.startsWith(tab.href + '/'));
          const activeColor = tab.activeColor ?? STAFF_AMBER;
          const isStudent = activeColor === STUDENT_GREEN;
          return (
            <button
              key={tab.href}
              onClick={() => handleTabClick(tab)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] px-2 rounded-2xl transition-all duration-200 active:scale-95"
              style={
                isActive
                  ? {
                      color: activeColor,
                      backgroundColor: isStudent
                        ? 'rgba(88, 204, 2, 0.10)'
                        : 'rgba(245, 158, 11, 0.10)',
                    }
                  : { color: '#94a3b8' }
              }
            >
              <span
                className={`transition-transform duration-200 ${
                  isActive ? 'scale-110' : ''
                }`}
              >
                {tab.icon}
              </span>
              <span
                className={`text-[10px] leading-none mt-0.5 ${
                  isActive ? 'font-extrabold' : 'font-bold'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
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
