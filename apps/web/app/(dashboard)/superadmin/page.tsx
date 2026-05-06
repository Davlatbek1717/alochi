'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookMarked, CreditCard, Users, Building2,
  ShieldOff, Trophy, ChevronRight, Shield,
  Settings, BarChart2, AlertTriangle, TrendingUp,
  UserX, Camera, Award, Video, MessageSquare, Inbox,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateLong } from '@/lib/date-uz';
import { Skeleton } from '@/components/ui';

const NAV_CARDS = [
  { href: '/superadmin/contact-requests', icon: <Inbox size={22} />, title: "Demo so'rovlar", desc: "Mijozlardan yangi so'rovlar", color: 'hover:border-violet-300 hover:bg-violet-50' },
  { href: '/superadmin/tenants',     icon: <Building2 size={22} />, title: 'Markazlar',          desc: "A\'lochi markazlari ro'yxati va boshqaruv", color: 'hover:border-violet-300 hover:bg-violet-50' },
  { href: '/superadmin/tenants/new', icon: <Building2 size={22} />, title: "Yangi Markaz", desc: 'Markaz + admin yaratish', color: 'hover:border-emerald-300 hover:bg-emerald-50' },
  { href: '/superadmin/lessons',  icon: <BookMarked size={22} />, title: 'Darslar',              desc: 'Yaratish, tahrirlash, nashr',  color: 'hover:border-indigo-300 hover:bg-indigo-50' },
  { href: '/superadmin/payments', icon: <CreditCard size={22} />, title: "To'lovlar",            desc: 'Qarzdorlar, filial statistika', color: 'hover:border-emerald-300 hover:bg-emerald-50' },
  { href: '/superadmin/users',    icon: <Users size={22} />,      title: 'Foydalanuvchilar',     desc: 'Yaratish, tahrirlash',          color: 'hover:border-violet-300 hover:bg-violet-50' },
  { href: '/superadmin/branches', icon: <Building2 size={22} />,  title: 'Filiallar',            desc: "Qo'shish, boshqarish",          color: 'hover:border-blue-300 hover:bg-blue-50' },
  { href: '/superadmin/keywords', icon: <ShieldOff size={22} />,  title: "Taqiqlangan so'zlar",  desc: 'Chat filtrlash',                color: 'hover:border-rose-300 hover:bg-rose-50' },
  { href: '/superadmin/tournaments',icon: <Trophy size={22} />,   title: 'Turnirlar',            desc: 'Musobaqalar boshqaruvi',        color: 'hover:border-amber-300 hover:bg-amber-50' },
  { href: '/superadmin/adaptive',        icon: <Settings size={22} />,      title: 'Adaptiv Qiyinlik',     desc: 'N-back sozlamalari',            color: 'hover:border-blue-300 hover:bg-blue-50' },
  { href: '/superadmin/content-quality', icon: <BarChart2 size={22} />,     title: 'Kontent Sifati',       desc: 'A/B test, pass rate',           color: 'hover:border-purple-300 hover:bg-purple-50' },
  { href: '/superadmin/churn',           icon: <AlertTriangle size={22} />, title: 'Churn Monitor',        desc: 'Xavfli o\'quvchilar',           color: 'hover:border-red-300 hover:bg-red-50' },
  { href: '/superadmin/analytics',       icon: <TrendingUp size={22} />,    title: 'Analytics',            desc: 'Filial va dars statistika',     color: 'hover:border-green-300 hover:bg-green-50' },
  { href: '/superadmin/blocked-students',icon: <UserX size={22} />,         title: "Bloklangan o'quvchilar", desc: "To'lov va ogohlantirish bloklari", color: 'hover:border-rose-300 hover:bg-rose-50' },
  { href: '/superadmin/face-sla',        icon: <Camera size={22} />,        title: 'Face ID monitoring',   desc: "Face ID natijalari va SLA",     color: 'hover:border-cyan-300 hover:bg-cyan-50' },
  { href: '/superadmin/certificate-design', icon: <Award size={22} />,      title: 'Sertifikat dizayni',   desc: 'Shablon va brending',           color: 'hover:border-amber-300 hover:bg-amber-50' },
  { href: '/superadmin/video-guides',    icon: <Video size={22} />,         title: "Video qo'llanmalar",    desc: "Foydalanuvchilar uchun video",  color: 'hover:border-blue-300 hover:bg-blue-50' },
  { href: '/superadmin/templates',       icon: <MessageSquare size={22} />, title: 'Bildirishnoma shablonlari', desc: 'Telegram/inapp/SMS shablonlar', color: 'hover:border-violet-300 hover:bg-violet-50' },
  { href: '/superadmin/settings',        icon: <Settings size={22} />,      title: 'Sozlamalar',           desc: 'Bloklash chegarasi, tenant',    color: 'hover:border-slate-300 hover:bg-slate-50' },
];

type Stats = { branches: number; lessons: number; users: number };
type ContactCounts = { new: number; total: number };

export default function SuperadminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ branches: 0, lessons: 0, users: 0 });
  const [newRequests, setNewRequests] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    Promise.all([
      apiRequest<Array<unknown>>('/branches', {}, token).catch(() => ({ data: [] as unknown[] })),
      apiRequest<Array<unknown>>('/lessons', {}, token).catch(() => ({ data: [] as unknown[] })),
      apiRequest<Array<unknown>>('/users', {}, token).catch(() => ({ data: [] as unknown[] })),
      apiRequest<{ items: unknown[]; counts: ContactCounts }>(
        '/contact-requests?status=new',
        {},
        token,
      ).catch(() => ({ data: { items: [], counts: { new: 0, total: 0 } } })),
    ]).then(([b, l, u, c]) => {
      setStats({
        branches: Array.isArray(b.data) ? b.data.length : 0,
        lessons: Array.isArray(l.data) ? l.data.length : 0,
        users: Array.isArray(u.data) ? u.data.length : 0,
      });
      const counts = (c as { data: { counts?: ContactCounts } }).data?.counts;
      setNewRequests(counts?.new ?? 0);
    }).finally(() => setLoaded(true));
  }, []);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none overflow-hidden"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="flex items-start gap-4 mb-5 relative z-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
            <Shield size={22} className="text-white" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-0.5">Tizim boshqaruvi</p>
            <p className="text-white text-xl font-bold">Superadmin Paneli</p>
            <p className="text-[#475569] text-xs mt-0.5 font-mono">
              {formatDateLong(new Date())}
            </p>
          </div>
        </div>

        {/* Stat bar */}
        <div className="grid grid-cols-3 gap-2 relative z-10">
          {[
            { label: 'Filiallar', value: stats.branches, color: 'text-[#0d9488]' },
            { label: 'Darslar',   value: stats.lessons,  color: 'text-violet-400' },
            { label: 'Foydalanuvchilar', value: stats.users, color: 'text-[#f59e0b]' },
          ].map((s) => (
            <div key={s.label} className="bg-[#162032] rounded-[14px] p-3">
              {loaded ? (
                <p className={`text-xl font-black font-mono ${s.color}`}>{s.value}</p>
              ) : (
                <Skeleton className="h-7 w-12 mb-1" />
              )}
              <p className="text-[#94a3b8] text-[10px] mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-8 pb-6">
        <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Navigatsiya</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {NAV_CARDS.map((card) => {
            const showBadge =
              card.href === '/superadmin/contact-requests' && newRequests > 0;
            return (
              <button
                key={card.href}
                onClick={() => router.push(card.href)}
                className={`relative bg-white rounded-[18px] p-4 min-w-0 flex items-center gap-3 border-[1.5px] border-[#ede9e1] transition-all hover:scale-[1.02] text-left ${card.color}`}
              >
                <div className="relative w-11 h-11 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#0f172a] shrink-0">
                  {card.icon}
                  {showBadge && (
                    <span
                      aria-label={`${newRequests} ta yangi so'rov`}
                      className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center shadow"
                    >
                      {newRequests > 99 ? '99+' : newRequests}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0f172a] text-sm font-bold truncate">{card.title}</p>
                  <p className="text-[#64748b] text-xs mt-0.5 truncate">{card.desc}</p>
                </div>
                <ChevronRight size={15} className="text-[#94a3b8] shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
