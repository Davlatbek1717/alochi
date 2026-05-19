'use client';
import { useEffect, useState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, EmptyState, useToast } from '@/components/ui';

interface LoyaltyStudent {
  studentId: string;
  name: string;
  daysInactive: number;
}
interface LoyaltyResp {
  counts: { loyal: number; steady: number; atRisk: number; dormant: number };
  atRisk: LoyaltyStudent[];
  dormant: LoyaltyStudent[];
}

const SEGMENTS: {
  key: keyof LoyaltyResp['counts'];
  label: string;
  cls: string;
}[] = [
  { key: 'loyal', label: 'Sodiq', cls: 'bg-emerald-100 text-emerald-700' },
  { key: 'steady', label: 'Barqaror', cls: 'bg-sky-100 text-sky-700' },
  { key: 'atRisk', label: 'Xavf ostida', cls: 'bg-amber-100 text-amber-700' },
  { key: 'dormant', label: 'Faolsiz', cls: 'bg-rose-100 text-rose-700' },
];

function List({
  title,
  items,
}: {
  title: string;
  items: LoyaltyStudent[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b]">
        {title}
      </p>
      {items.map((s) => (
        <div
          key={s.studentId}
          className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-2.5 flex items-center justify-between gap-3"
        >
          <span className="text-sm font-extrabold text-[#0f172a] truncate">
            {s.name}
          </span>
          <span className="text-[11px] font-bold text-[#94a3b8] shrink-0">
            {s.daysInactive} kun faolsiz
          </span>
        </div>
      ))}
    </div>
  );
}

export function LoyaltyTab() {
  const [data, setData] = useState<LoyaltyResp | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<LoyaltyResp>('/analytics/loyalty', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" theme="light" />
        <Skeleton className="h-40 w-full rounded-xl" theme="light" />
      </div>
    );
  }

  const counts = data?.counts;
  const total = counts
    ? counts.loyal + counts.steady + counts.atRisk + counts.dormant
    : 0;

  if (!counts || total === 0) {
    return (
      <EmptyState
        icon={<HeartHandshake size={24} />}
        title="Maʼlumot yoʻq"
        description="Sodiqlik segmentatsiyasi uchun faol oʻquvchilar topilmadi"
        theme="light"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[#0f172a]">
          Sodiqlik segmentatsiyasi
        </h2>
        <p className="text-xs text-[#64748b] mt-0.5">
          Soʻnggi faollik va streak boʻyicha {total} ta faol oʻquvchi.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SEGMENTS.map((seg) => (
          <div
            key={seg.key}
            className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-center"
          >
            <p className="text-xl font-extrabold text-[#0f172a]">
              {counts[seg.key]}
            </p>
            <span
              className={`inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${seg.cls}`}
            >
              {seg.label}
            </span>
          </div>
        ))}
      </div>

      <List title="Xavf ostida" items={data?.atRisk ?? []} />
      <List title="Faolsiz (eng uzoq)" items={data?.dormant ?? []} />
    </div>
  );
}
