'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from './_components/BottomNav';
import TopNav from './_components/TopNav';
import { DuelNotificationProvider } from './_components/DuelNotificationProvider';
import { NotificationBell } from './_components/NotificationBell';
import { InstallPrompt } from '@/components/InstallPrompt';
import { ToastProvider, Button } from '@/components/ui';

interface UserInfo { id: string; name: string; role: string; tenantId: string; }

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
    <ToastProvider>
    <DuelNotificationProvider>
      <div className="flex flex-col min-h-screen bg-[#f7f4ef]">
        {/* Skip to main content — keyboard a11y */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg"
        >
          Asosiy kontentga o&apos;tish
        </a>
        {/* Top header — identity + bell + logout. Sits above the per-role
            top nav so navigation chrome stays consistent across pages. */}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
            >
              Chiqish
            </Button>
          </div>
        </header>

        {/* Per-role top nav — desktop only. Mobile users navigate via the
            BottomNav at the bottom of the viewport. The desktop nav drops
            into a horizontal strip with grouped dropdowns so reaching
            any sub-section is a one-click hover, not a dashboard
            round-trip through tile menus. */}
        {user && <TopNav role={user.role} />}

        {/* Main content */}
        <main
          id="main-content"
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-20 md:pb-0"
        >
          {children}
        </main>

        {/* Bottom nav — mobile only */}
        <BottomNav />
      </div>
      <InstallPrompt />
    </DuelNotificationProvider>
    </ToastProvider>
  );
}
