'use client';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`bg-slate-700/50 rounded animate-pulse ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-slate-800/60 border border-slate-700 rounded-xl p-6 ${className}`}>
      <Skeleton className="h-5 w-1/3 mb-4" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonStats({ count = 4, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <Skeleton className="h-5 w-5 mb-3" />
          <Skeleton className="h-8 w-1/2 mb-2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  );
}
