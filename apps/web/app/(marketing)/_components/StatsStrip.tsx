'use client';
import { useCallback, useEffect, useState } from 'react';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { Users2, School, BookOpen, TrendingUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface MarketingStats {
  totalStudents: number;
  totalSchools: number;
  totalLessons: number;
  completedSessions: number;
  avgProgress: number;
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`.replace('.0k', 'k');
  return String(n);
}

export function StatsStrip() {
  const [stats, setStats] = useState<MarketingStats | null>(null);

  const load = useCallback(() => {
    fetch(`${API_BASE}/marketing/stats`)
      .then((r) => r.json())
      .then(
        (
          json:
            | { success?: boolean; data?: MarketingStats }
            | MarketingStats,
        ) => {
          const data =
            json && typeof json === 'object' && 'data' in json && json.data
              ? (json.data as MarketingStats)
              : (json as MarketingStats);
          if (data && typeof data === 'object') setStats(data);
        },
      )
      .catch(() => {
        /* graceful fallback */
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh platform stats when the visitor returns to the tab so the numbers
  // shown on the landing page reflect lesson completions that just happened.
  useFocusRevalidate(load);

  if (
    !stats ||
    (stats.totalStudents === 0 &&
      stats.totalSchools === 0 &&
      stats.totalLessons === 0 &&
      stats.completedSessions === 0)
  ) {
    return null;
  }

  const ITEMS = [
    {
      icon: <Users2 size={22} strokeWidth={2.25} />,
      value: fmt(stats.totalStudents),
      label: "O'quvchilar",
    },
    {
      icon: <School size={22} strokeWidth={2.25} />,
      value: fmt(stats.totalSchools),
      label: 'Markazlar',
    },
    {
      icon: <BookOpen size={22} strokeWidth={2.25} />,
      value: fmt(stats.totalLessons),
      label: 'Tugatilgan darslar',
    },
    {
      icon: <TrendingUp size={22} strokeWidth={2.25} />,
      value: `${stats.avgProgress}%`,
      label: "O'rtacha progress",
    },
  ];

  return (
    <section
      aria-labelledby="stats-h2"
      className="relative bg-[#0f0c2d] text-white overflow-hidden"
    >
      <h2 id="stats-h2" className="sr-only">
        Platformaning asosiy raqamlari
      </h2>

      {/* Layered atmosphere */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-100 pointer-events-none"
      >
        <div className="absolute -top-32 left-1/4 w-[480px] h-[300px] rounded-full bg-[var(--brand)]/30 blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 w-[480px] h-[300px] rounded-full bg-[var(--accent)]/14 blur-3xl" />
      </div>

      {/* Top gradient seam */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--brand)] to-transparent opacity-40"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6 lg:gap-x-12">
          {ITEMS.map((stat, i) => (
            <li
              key={stat.label}
              className={[
                'flex flex-col items-start',
                'motion-safe:[animation:count-up-fade_650ms_var(--ease-out-expo)_both]',
              ].join(' ')}
              style={{ animationDelay: `${i * 110}ms` }}
            >
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-white/[0.08] ring-1 ring-white/[0.12] mb-4 backdrop-blur-sm">
                {stat.icon}
              </span>
              <div className="font-display text-5xl sm:text-6xl font-bold leading-[0.9] tracking-[-0.025em]">
                {stat.value}
              </div>
              <div className="mt-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/65">
                {stat.label}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
