'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const NAV_TABS: Record<string, { href: string; icon: string; label: string; action?: string }[]> = {
  student: [
    { href: '/student',         icon: '🏠', label: 'Bosh'      },
    { href: '/student/lessons', icon: '📚', label: 'Darslar'   },
    { href: '/student/friends', icon: '👥', label: "Do'stlar"  },
    { href: '/student/duel',    icon: '⚔️', label: 'Duel'      },
    { href: '/student/profile', icon: '👤', label: 'Profil', action: 'logout' },
  ],
  mentor: [
    { href: '/mentor',            icon: '🏠', label: 'Bosh'    },
    { href: '/mentor/group',      icon: '👨‍🎓', label: 'Guruh'  },
    { href: '/mentor/attendance', icon: '📊', label: 'Davomat' },
  ],
  tester: [
    { href: '/mentor',            icon: '🏠', label: 'Bosh'    },
    { href: '/mentor/group',      icon: '👨‍🎓', label: 'Guruh'  },
    { href: '/mentor/attendance', icon: '📊', label: 'Davomat' },
  ],
  manager: [
    { href: '/manager',             icon: '🏠', label: 'Bosh'        },
    { href: '/manager/students',    icon: '👥', label: "O'quvchilar" },
    { href: '/manager/delegations', icon: '📋', label: 'Delegatsiya' },
  ],
  filadmin: [
    { href: '/filadmin',            icon: '🏠', label: 'Bosh'           },
    { href: '/filadmin/attendance', icon: '✅', label: 'Davomat'        },
    { href: '/filadmin/payments',   icon: '💰', label: "To'lovlar"      },
    { href: '/filadmin/warnings',   icon: '⚠️', label: 'Ogohlantirish' },
  ],
  superadmin: [
    { href: '/superadmin',          icon: '🏠', label: 'Bosh'             },
    { href: '/superadmin/branches', icon: '🏢', label: 'Filiallar'        },
    { href: '/superadmin/users',    icon: '👤', label: 'Foydalanuvchilar' },
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

  function handleTabClick(tab: { href: string; action?: string }) {
    if (tab.action === 'logout') {
      localStorage.clear();
      router.push('/login');
      return;
    }
    router.push(tab.href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-[env(safe-area-inset-bottom)] px-2 pt-2 z-50">
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
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
