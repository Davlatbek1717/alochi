'use client';

interface SkeletonProps {
  className?: string;
  theme?: 'light' | 'dark';
}

export function Skeleton({ className = '', theme = 'light' }: SkeletonProps) {
  const bg =
    theme === 'light'
      ? 'bg-[var(--surface-3)]'
      : 'bg-slate-700/50';
  return (
    <div className={`${bg} rounded-md animate-pulse ${className}`} />
  );
}

export function SkeletonText({
  lines = 3,
  className = '',
  theme = 'light',
}: {
  lines?: number;
  className?: string;
  theme?: 'light' | 'dark';
}) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          theme={theme}
          className={`h-3.5 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '', theme = 'light' }: SkeletonProps) {
  const cardBg =
    theme === 'light'
      ? 'bg-[var(--surface)] border-[var(--line)]'
      : 'bg-slate-800/60 border-slate-700';
  return (
    <div className={`${cardBg} border rounded-2xl p-6 ${className}`}>
      <Skeleton theme={theme} className="h-5 w-1/3 mb-4" />
      <SkeletonText theme={theme} lines={3} />
    </div>
  );
}

export function SkeletonStats({
  count = 4,
  className = '',
  theme = 'light',
}: {
  count?: number;
  className?: string;
  theme?: 'light' | 'dark';
}) {
  const cardBg =
    theme === 'light'
      ? 'bg-[var(--surface)] border-[var(--line)]'
      : 'bg-slate-800/60 border-slate-700';
  return (
    <div
      className={`grid grid-cols-2 md:grid-cols-${count} gap-4 ${className}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${cardBg} border rounded-2xl p-5`}>
          <Skeleton theme={theme} className="h-10 w-10 mb-4 rounded-xl" />
          <Skeleton theme={theme} className="h-8 w-1/2 mb-3" />
          <Skeleton theme={theme} className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
