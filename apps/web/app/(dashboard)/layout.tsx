'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from './_components/BottomNav';

interface UserInfo {
  id: string;
  name: string;
  role: string;
  tenantId: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
    localStorage.clear();
    router.replace('/login');
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 truncate max-w-[70%]">
          {user?.name ?? '...'}
        </p>
        <button
          onClick={handleLogout}
          className="text-xs text-red-500 hover:text-red-700 font-medium"
        >
          Chiqish
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-4 pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
