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
  // Two-stage gate: roleVerified flips true ONLY after the role-prefix
  // effect has confirmed the URL matches the user's role. Children
  // render only after that — without this gate, a wrong-role visitor
  // would see one or two render cycles of the target page (and its
  // useEffects firing data fetches) before the redirect completes.
  const [roleVerified, setRoleVerified] = useState(false);

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
          // Fetch tenant branding for the dashboard chrome. Uses the
          // /tenants/me/branding endpoint (open to any authenticated
          // user inside the tenant) so non-superadmin roles don't
          // 403-spam the console on every dashboard load.
          if (userInfo.tenantId) {
            apiRequest<TenantBranding>('/tenants/me/branding', {}, token)
              .then((res) => {
                if (res.data.brandName) setBrandName(res.data.brandName);
              })
              .catch(() => { /* silently ignore — fallback to "A'lochi" */ });
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
    if (!expectedPrefix) {
      // Unknown role — block rendering until the redirect (below) lands.
      setRoleVerified(false);
      return;
    }
    if (SHARED_PREFIXES.some((p) => pathname.startsWith(p))) {
      setRoleVerified(true);
      return;
    }
    // Match prefix WITH a slash boundary so /student also covers
    // /student/lessons but /studentpolice (hypothetical) wouldn't
    // sneak through.
    if (pathname === expectedPrefix || pathname.startsWith(`${expectedPrefix}/`)) {
      setRoleVerified(true);
      return;
    }
    // Wrong-role URL — pivot to the user's actual role home and keep
    // the gate closed so the wrong-role children never mount.
    setRoleVerified(false);
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
      <div className="flex flex-col min-h-screen bg-[var(--background)] overflow-x-hidden">
        {/* Skip to main content — keyboard a11y */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--brand)] focus:text-white focus:rounded-lg focus:font-bold"
        >
          Asosiy kontentga o&apos;tish
        </a>
        {/* Top identity bar — deep ink. Sits above per-role top nav. */}
        <header
          className={[
            'sticky top-0 z-50',
            'bg-[#0f0c2d] border-b border-white/[0.06]',
            'px-3 sm:px-5 py-2.5',
            'flex items-center justify-between gap-2 min-w-0',
          ].join(' ')}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className={[
                'grid place-items-center',
                'w-8 h-8 rounded-xl',
                'bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)]',
                'text-white text-[11px] font-extrabold tracking-wide',
                'shadow-[0_4px_12px_-4px_rgba(109,40,217,0.5)]',
                'shrink-0',
              ].join(' ')}
            >
              {user?.name ? getInitials(user.name) : '…'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {user?.name ?? '…'}
              </p>
              <p className="text-[10px] text-white/55 truncate leading-tight font-medium tracking-wide">
                {brandName ?? "A'lochi"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <NotificationBell />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="!text-white/80 hover:!text-white hover:!bg-white/10"
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

        {/* Main content — only renders once role is verified. Until
            then a thin skeleton placeholder sits in place so the
            wrong-role page can't fire any of its data-fetch effects. */}
        <main
          id="main-content"
          className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden pb-20 md:pb-0"
        >
          {roleVerified ? (
            children
          ) : (
            <div className="min-h-full bg-[#f7f4ef] p-5 space-y-4">
              <div className="h-8 w-48 bg-[#ede9e1] rounded-xl animate-pulse" />
              <div className="h-32 bg-white rounded-2xl border-[1.5px] border-[#ede9e1] animate-pulse" />
              <div className="h-32 bg-white rounded-2xl border-[1.5px] border-[#ede9e1] animate-pulse" />
            </div>
          )}
        </main>

        {/* Bottom nav — mobile only */}
        <BottomNav />
      </div>
      <InstallPrompt />
    </DuelNotificationProvider>
    </ToastProvider>
  );
}
