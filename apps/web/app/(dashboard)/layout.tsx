'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from './_components/BottomNav';
import { DuelNotificationProvider } from './_components/DuelNotificationProvider';
import { NotificationBell } from './_components/NotificationBell';

interface UserInfo {
  id: string;
  name: string;
  role: string;
  tenantId: string;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/login'); return; }
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed && typeof parsed.id === 'string' && typeof parsed.role === 'string') {
          setUser(parsed as unknown as UserInfo);
        }
      }
    } catch { /* ignore */ }
  }, [router]);

  function handleLogout() {
    localStorage.clear();
    router.replace('/login');
  }

  return (
    <DuelNotificationProvider>
      <div className="flex flex-col min-h-screen bg-[#f7f4ef]">
        <header className="sticky top-0 z-50 bg-[#0f172a] border-b border-white/5 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-black shrink-0">
              {user?.name ? getInitials(user.name) : '…'}
            </div>
            <p className="text-sm font-semibold text-white truncate max-w-[160px]">
              {user?.name ?? '…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="text-xs text-[#94a3b8] hover:text-white font-medium transition-colors"
            >
              Chiqish
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto pb-24">{children}</main>
        <BottomNav />
      </div>
    </DuelNotificationProvider>
  );
}
