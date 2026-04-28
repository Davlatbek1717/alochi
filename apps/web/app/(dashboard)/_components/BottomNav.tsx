'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home, BookOpen, Users, Swords, User,
  GraduationCap, BarChart2, ClipboardList,
  CreditCard, AlertTriangle, Building2,
  BookMarked, Send,
} from 'lucide-react';


type Tab = { href: string; icon: React.ReactNode; label: string; action?: string };

const NAV_TABS: Record<string, Tab[]> = {
  student: [
    { href: '/student',         icon: <Home size={20} />,           label: 'Bosh'       },
    { href: '/student/lessons', icon: <BookOpen size={20} />,       label: 'Darslar'    },
    { href: '/student/exams',   icon: <GraduationCap size={20} />,  label: 'Imtihon'    },
    { href: '/student/friends', icon: <Users size={20} />,          label: "Do'stlar"   },
    { href: '/student/profile', icon: <User size={20} />,           label: 'Profil', action: 'logout' },
  ],
  mentor: [
    { href: '/mentor',            icon: <Home size={20} />,         label: 'Bosh'      },
    { href: '/mentor/group',      icon: <GraduationCap size={20} />,label: 'Guruh'     },
    { href: '/mentor/attendance', icon: <BarChart2 size={20} />,    label: 'Davomat'   },
    { href: '/mentor/tasks',      icon: <ClipboardList size={20} />,label: 'Vazifalar' },
  ],
  tester: [
    { href: '/tester',       icon: <Home size={20} />,         label: 'Bosh'      },
    { href: '/tester/tasks', icon: <ClipboardList size={20} />,label: 'Vazifalar' },
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
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)] px-2 pt-2 z-50">
      <div className="flex justify-around items-center max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href.length > 1 &&
              !tabs.some((t) => t !== tab && t.href.startsWith(tab.href + '/')) &&
              pathname.startsWith(tab.href + '/'));
          return (
            <button
              key={tab.href}
              onClick={() => handleTabClick(tab)}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 min-w-[44px] min-h-[44px] justify-center px-2 rounded-lg transition-colors ${
                isActive ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-600 rounded-full" />
              )}
              {tab.icon}
              <span className="text-[10px] font-medium leading-none mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
