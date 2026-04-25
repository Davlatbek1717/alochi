'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

type Role = 'superadmin' | 'filadmin' | 'manager' | 'mentor' | 'tester' | 'student';

interface NavItem {
  label: string;
  href: string;
}

const NAV_ITEMS: Record<Role, NavItem[]> = {
  superadmin: [
    { label: 'Bosh sahifa', href: '/superadmin' },
    { label: 'Darslar', href: '/superadmin/lessons' },
  ],
  filadmin: [
    { label: 'Bosh sahifa', href: '/filadmin' },
    { label: "Ogohlantirishlar", href: '/filadmin/warnings' },
    { label: "To'lovlar", href: '/filadmin/payments' },
    { label: 'Davomat', href: '/filadmin/attendance' },
    { label: 'Face davomat', href: '/filadmin/face-attendance' },
  ],
  manager: [
    { label: 'Bosh sahifa', href: '/manager' },
  ],
  mentor: [
    { label: 'Bosh sahifa', href: '/mentor' },
    { label: 'Guruh', href: '/mentor/group' },
    { label: 'Davomat', href: '/mentor/attendance' },
  ],
  tester: [
    { label: 'Bosh sahifa', href: '/tester' },
  ],
  student: [
    { label: 'Bosh sahifa', href: '/student' },
    { label: "Darslar", href: '/student/lessons' },
    { label: "Do'stlar", href: '/student/friends' },
  ],
};

const ROLE_LABELS: Record<Role, string> = {
  superadmin: 'Superadmin',
  filadmin: 'Filial Admin',
  manager: 'Menejer',
  mentor: 'Mentor',
  tester: 'Tester',
  student: 'Talaba',
};

interface UserInfo {
  id: string;
  name: string;
  role: Role;
  tenantId: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.replace('/login');
      return;
    }
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw) as UserInfo);
    } catch {
      // ignore parse errors
    }
  }, [router]);

  function handleLogout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.replace('/login');
  }

  const navItems = user?.role ? NAV_ITEMS[user.role] ?? [] : [];

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {user?.name ?? '...'}
          </p>
          {user?.role && (
            <span className="mt-1 inline-block text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5">
              {ROLE_LABELS[user.role]}
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Chiqish
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
