'use client';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import BottomNav from './_components/BottomNav';
import TopNav from './_components/TopNav';
import { DuelNotificationProvider } from './_components/DuelNotificationProvider';
import { NotificationBell } from './_components/NotificationBell';
import { InstallPrompt } from '@/components/InstallPrompt';
import { ToastProvider, Button } from '@/components/ui';
import { apiRequest } from '@/lib/api';

interface UserInfo { id: string; name: string; role: string; tenantId: string; }

interface TenantBranding { brandName?: string | null; }

/**
 * Role → URL-prefix mapping. Used by the layout to redirect a user
 * whose stored role doesn't match the prefix they're trying to visit
 * — otherwise they'd hit a 403 on every API call from the wrong-role
 * page and have no idea why.
 */
const ROLE_PREFIX: Record<string, string> = {
  superadmin: '/superadmin',
  filadmin: '/filadmin',
  manager: '/manager',
  mentor: '/mentor',
  tester: '/tester',
  student: '/student',
};

const ROLE_HOME: Record<string, string> = {
  superadmin: '/superadmin',
  filadmin: '/filadmin',
  manager: '/manager',
  mentor: '/mentor',
  tester: '/tester',
  student: '/student',
};

/** Routes that don't belong to any one role (e.g. delegations). */
const SHARED_PREFIXES = ['/delegations'];

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [user, setUser] = useState<UserInfo | null>(null);
  const [brandName, setBrandName] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/login'); return; }
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed && typeof parsed.id === 'string' && typeof parsed.role === 'string') {
          const userInfo = parsed as unknown as UserInfo;
          setUser(userInfo);
          // Fetch tenant branding if tenantId is available
          if (userInfo.tenantId) {
            apiRequest<TenantBranding>(`/tenants/${userInfo.tenantId}`, {}, token)
              .then((res) => {
                if (res.data.brandName) setBrandName(res.data.brandName);
              })
              .catch(() => { /* silently ignore — fallback to 'Adouptivo' */ });
          }
        }
      }
    } catch { /* ignore */ }
  }, [router]);

  // Role-based redirect. If the stored user has a role but they're
  // visiting a path under a different role's prefix (e.g. a tester on
  // /superadmin/...), bounce them to their own home. Without this,
  // every API call on the wrong page returns 403 and the user has no
  // visible explanation. Shared paths (/delegations) bypass the check.
  useEffect(() => {
    if (!user || !pathname) return;
    const expectedPrefix = ROLE_PREFIX[user.role];
    if (!expectedPrefix) return;
    if (SHARED_PREFIXES.some((p) => pathname.startsWith(p))) return;
    // Match prefix WITH a slash boundary so /student also covers
    // /student/lessons but /studentpolice (hypothetical) wouldn't
    // sneak through.
    if (pathname === expectedPrefix) return;
    if (pathname.startsWith(`${expectedPrefix}/`)) return;
    // Wrong-role URL — pivot to the user's actual role home.
    const home = ROLE_HOME[user.role] ?? '/';
    router.replace(home);
  }, [user, pathname, router]);

  function handleLogout() {
    localStorage.clear();
    router.replace('/login');
  }

  return (
    <ToastProvider>
    <DuelNotificationProvider>
      <div className="flex flex-col min-h-screen bg-[#f7f4ef] overflow-x-hidden">
        {/* Skip to main content — keyboard a11y */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-lg"
        >
          Asosiy kontentga o&apos;tish
        </a>
        {/* Top header — identity + bell + logout. Sits above the per-role
            top nav so navigation chrome stays consistent across pages. */}
        <header className="sticky top-0 z-50 bg-[#0f172a] border-b border-white/5 px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2 min-w-0">
          {/* Identity — must shrink so the right-side bell+logout buttons
              never get cut off on narrow phones (e.g. 360-430px). The
              `min-w-0` on the flex item is what actually lets the text
              truncate; without it the inner <p> would expand to its
              intrinsic content width and push the header beyond the
              viewport. */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-black shrink-0">
              {user?.name ? getInitials(user.name) : '…'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {user?.name ?? '…'}
              </p>
              <p className="text-[10px] text-[#94a3b8] truncate leading-tight">
                {brandName ?? 'Adouptivo'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
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
