'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import BottomNav from './_components/BottomNav';
import { DuelNotificationProvider } from './_components/DuelNotificationProvider';
import { NotificationBell } from './_components/NotificationBell';
import { InstallPrompt } from '@/components/InstallPrompt';
import {
  Home, BookOpen, Users, GraduationCap, BarChart2, ClipboardList,
  CreditCard, AlertTriangle, Building2, BookMarked, Send,
  ShieldOff, Trophy, User, FlaskConical,
} from 'lucide-react';
import { ToastProvider, Button } from '@/components/ui';

interface UserInfo { id: string; name: string; role: string; tenantId: string; }

type NavItem = { href: string; icon: React.ReactNode; label: string };

const SIDEBAR_NAV: Record<string, NavItem[]> = {
  student: [
    { href: '/student',         icon: <Home size={17} />,          label: 'Bosh sahifa'  },
    { href: '/student/lessons', icon: <BookOpen size={17} />,      label: 'Darslar'      },
    { href: '/student/exams',   icon: <GraduationCap size={17} />, label: 'Imtihonlar'   },
    { href: '/student/friends', icon: <Users size={17} />,         label: "Do'stlar"     },
    { href: '/profile',         icon: <User size={17} />,          label: 'Profil'       },
  ],
  mentor: [
    { href: '/mentor',            icon: <Home size={17} />,          label: 'Bosh sahifa' },
    { href: '/mentor/group',      icon: <GraduationCap size={17} />, label: 'Guruh'       },
    { href: '/mentor/attendance', icon: <BarChart2 size={17} />,     label: 'Davomat'     },
    { href: '/mentor/tasks',      icon: <ClipboardList size={17} />, label: 'Vazifalar'   },
  ],
  tester: [
    { href: '/tester',                 icon: <Home size={17} />,           label: 'Bosh sahifa'      },
    { href: '/tester/lessons/current', icon: <FlaskConical size={17} />,   label: 'Sinov darsi'      },
    { href: '/tester/exam-queue',      icon: <ClipboardList size={17} />,  label: 'Imtihon navbati'  },
  ],
  manager: [
    { href: '/manager',             icon: <Home size={17} />,          label: 'Bosh sahifa'  },
    { href: '/manager/students',    icon: <Users size={17} />,         label: "O'quvchilar"  },
    { href: '/manager/payments',    icon: <CreditCard size={17} />,    label: "To'lovlar"    },
    { href: '/manager/tasks',       icon: <ClipboardList size={17} />, label: 'Vazifalar'    },
    { href: '/manager/delegations', icon: <Send size={17} />,          label: 'Delegatsiya'  },
  ],
  filadmin: [
    { href: '/filadmin',            icon: <Home size={17} />,           label: 'Bosh sahifa'    },
    { href: '/filadmin/attendance', icon: <BarChart2 size={17} />,      label: 'Davomat'        },
    { href: '/filadmin/payments',   icon: <CreditCard size={17} />,     label: "To'lovlar"      },
    { href: '/filadmin/warnings',   icon: <AlertTriangle size={17} />,  label: 'Ogohlantirish'  },
    { href: '/filadmin/tasks',      icon: <ClipboardList size={17} />,  label: 'Vazifalar'      },
  ],
  superadmin: [
    { href: '/superadmin',          icon: <Home size={17} />,       label: 'Bosh sahifa'      },
    { href: '/superadmin/payments', icon: <CreditCard size={17} />, label: "To'lovlar"        },
    { href: '/superadmin/branches', icon: <Building2 size={17} />,  label: 'Filiallar'        },
    { href: '/superadmin/users',    icon: <Users size={17} />,      label: 'Foydalanuvchilar' },
    { href: '/superadmin/lessons',  icon: <BookMarked size={17} />, label: 'Darslar'          },
    { href: '/superadmin/keywords', icon: <ShieldOff size={17} />,  label: "Taqiqlangan so'z" },
    { href: '/filadmin/tournaments',icon: <Trophy size={17} />,     label: 'Turnirlar'        },
  ],
};

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  const sidebarItems = user ? (SIDEBAR_NAV[user.role] ?? []) : [];

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
        {/* Top header */}
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

        {/* Body: sidebar (desktop) + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar — only md+ */}
          {sidebarItems.length > 0 && (
            <aside className="hidden md:flex flex-col w-52 shrink-0 bg-[#0f172a] border-r border-white/5">
              <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {sidebarItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href.length > 1 && pathname.startsWith(item.href + '/') &&
                      !sidebarItems.some((t) => t !== item && t.href.startsWith(item.href + '/')));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-white/10 text-white'
                          : 'text-[#94a3b8] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>
          )}

          {/* Main content */}
          <main id="main-content" className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
        </div>

        {/* Bottom nav — mobile only */}
        <BottomNav />
      </div>
      <InstallPrompt />
    </DuelNotificationProvider>
    </ToastProvider>
  );
}
