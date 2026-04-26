import Link from 'next/link';

const NAV_CARDS = [
  {
    href: '/filadmin/attendance',
    icon: '📋',
    title: 'Davomat',
    description: 'Kunlik qatnashuvni belgilash',
    bg: 'bg-blue-50',
  },
  {
    href: '/filadmin/payments',
    icon: '💳',
    title: "To'lovlar",
    description: "O'quvchi to'lovlarini boshqarish",
    bg: 'bg-green-50',
  },
  {
    href: '/filadmin/warnings',
    icon: '⚠️',
    title: 'Ogohlantirishlar',
    description: 'Intizom muammolarini qayd etish',
    bg: 'bg-yellow-50',
  },
  {
    href: '/filadmin/kpi',
    icon: '⭐',
    title: 'KPI Mukofot',
    description: 'Xodimlarga ball berish',
    bg: 'bg-purple-50',
  },
  {
    href: '/filadmin/devices',
    icon: '📱',
    title: 'Planshetlar',
    description: 'Kiosk qurilmalarni boshqarish',
    bg: 'bg-pink-50',
  },
];

export default function FiladminDashboard() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <p className="text-white/70 text-sm font-medium">Filial boshqaruvi</p>
        <h1 className="text-2xl font-bold mt-1">Filadmin Paneli</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {NAV_CARDS.map((card) => (
          <Link key={card.href} href={card.href}>
            <div
              className={`${card.bg} rounded-2xl p-5 h-full flex flex-col gap-3 hover:scale-[1.02] transition-transform cursor-pointer`}
            >
              <span className="text-3xl">{card.icon}</span>
              <div>
                <p className="font-semibold text-gray-800">{card.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
