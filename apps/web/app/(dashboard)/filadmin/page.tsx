'use client';
import Link from 'next/link';
import {
  BarChart2,
  CreditCard,
  AlertTriangle,
  Star,
  Tablet,
  Trophy,
  ChevronRight,
  Building2,
  ClipboardList,
} from 'lucide-react';

const NAV_CARDS = [
  {
    href: '/filadmin/attendance',
    icon: <BarChart2 size={22} />,
    title: 'Davomat',
    description: 'Kunlik qatnashuvni belgilash',
    color: 'hover:border-teal-300 hover:bg-teal-50',
  },
  {
    href: '/filadmin/payments',
    icon: <CreditCard size={22} />,
    title: "To'lovlar",
    description: "O'quvchi to'lovlarini boshqarish",
    color: 'hover:border-emerald-300 hover:bg-emerald-50',
  },
  {
    href: '/filadmin/warnings',
    icon: <AlertTriangle size={22} />,
    title: 'Ogohlantirishlar',
    description: 'Intizom muammolarini qayd etish',
    color: 'hover:border-rose-300 hover:bg-rose-50',
  },
  {
    href: '/filadmin/kpi',
    icon: <Star size={22} />,
    title: 'KPI Mukofot',
    description: 'Xodimlarga ball berish',
    color: 'hover:border-amber-300 hover:bg-amber-50',
  },
  {
    href: '/filadmin/devices',
    icon: <Tablet size={22} />,
    title: 'Planshetlar',
    description: 'Kiosk qurilmalarni boshqarish',
    color: 'hover:border-violet-300 hover:bg-violet-50',
  },
  {
    href: '/filadmin/tournaments',
    icon: <Trophy size={22} />,
    title: 'Turnirlar',
    description: 'Musobaqalarni boshqarish',
    color: 'hover:border-amber-300 hover:bg-amber-50',
  },
  {
    href: '/filadmin/tasks',
    icon: <ClipboardList size={22} />,
    title: 'Vazifalar',
    description: 'Topshiriqlarni boshqarish',
    color: 'hover:border-orange-300 hover:bg-orange-50',
  },
];

export default function FiladminDashboard() {
  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-8 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-40 h-40 rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }}
        />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 border border-[#0d9488]/30 flex items-center justify-center">
              <Building2 size={20} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Filial boshqaruvi</p>
              <p className="text-white text-lg font-bold">Filadmin Paneli</p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-5">
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Tezkor navigatsiya</p>
          <div className="grid grid-cols-2 gap-3">
            {NAV_CARDS.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`bg-white rounded-[18px] p-4 flex items-center gap-3 border-[1.5px] border-[#ede9e1] transition-all text-left ${card.color}`}
              >
                <div className="w-11 h-11 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#0f172a] shrink-0">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0f172a] text-sm font-bold truncate">{card.title}</p>
                  <p className="text-[#64748b] text-xs mt-0.5 truncate">{card.description}</p>
                </div>
                <ChevronRight size={16} className="text-[#94a3b8] shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
