'use client';
import { useEffect, useState } from 'react';
import { Users2, School, BookOpen, TrendingUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface MarketingStats {
  totalStudents: number;
  totalSchools: number;
  totalLessons: number;
  completedSessions: number;
  avgProgress: number;
}

const ZERO: MarketingStats = {
  totalStudents: 0,
  totalSchools: 0,
  totalLessons: 0,
  completedSessions: 0,
  avgProgress: 0,
};

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`.replace('.0k', 'k');
  return String(n);
}

export function StatsStrip() {
  const [stats, setStats] = useState<MarketingStats>(ZERO);

  useEffect(() => {
    fetch(`${API_BASE}/marketing/stats`)
      .then((r) => r.json())
      .then((data: MarketingStats) => {
        if (data && typeof data === 'object') setStats(data);
      })
      .catch(() => {
        /* graceful fallback — keep zeros */
      });
  }, []);

  const ITEMS = [
    {
      icon: <Users2 size={22} strokeWidth={2.5} />,
      value: fmt(stats.totalStudents),
      label: "Jami o'quvchilar",
    },
    {
      icon: <School size={22} strokeWidth={2.5} />,
      value: fmt(stats.totalSchools),
      label: 'Jami maktablar',
    },
    {
      icon: <BookOpen size={22} strokeWidth={2.5} />,
      value: fmt(stats.totalLessons),
      label: 'Tugatilgan darslar',
    },
    {
      icon: <TrendingUp size={22} strokeWidth={2.5} />,
      value: `${stats.avgProgress}%`,
      label: "O'rtacha progress",
    },
  ];

  return (
    <section
      aria-labelledby="stats-h2"
      className="relative bg-[#6d28d9] text-white overflow-hidden"
    >
      <h2 id="stats-h2" className="sr-only">
        Platformaning asosiy raqamlari
      </h2>

      {/* Decorative wash */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(40% 80% at 90% 50%, #f97316 0%, rgba(249,115,22,0) 60%), radial-gradient(40% 80% at 10% 50%, #4c1d95 0%, rgba(76,29,149,0) 60%)',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-6 lg:gap-x-10">
          {ITEMS.map((stat, i) => (
            <li
              key={stat.label}
              className="flex flex-col items-start motion-safe:[animation:count-up-fade_550ms_ease-out_both]"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="grid place-items-center w-10 h-10 rounded-full bg-white/15 ring-1 ring-white/20 mb-3">
                {stat.icon}
              </span>
              <div className="text-4xl sm:text-5xl font-extrabold leading-none tracking-tight">
                {stat.value}
              </div>
              <div className="mt-2 text-xs sm:text-sm font-extrabold uppercase tracking-widest text-white/85">
                {stat.label}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
