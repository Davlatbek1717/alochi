'use client';
import { useEffect, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Table, Column, EmptyState, Skeleton, useToast } from '@/components/ui';

interface Failure {
  lessonId: string;
  lessonTitle: string;
  failedCount: number;
  completedCount: number;
  failureRate: number;
}

const columns: Column<Failure>[] = [
  {
    key: 'lessonTitle',
    label: 'Dars',
    render: (row) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-[#0f172a]">
          {row.lessonTitle}
        </span>
        <span className="font-mono text-[10px] text-[#94a3b8]">
          {row.lessonId.slice(0, 8)}…
        </span>
      </div>
    ),
  },
  {
    key: 'failedCount',
    label: "Muvaffaqiyatsiz",
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="text-rose-600 font-semibold">{row.failedCount}</span>
    ),
  },
  {
    key: 'completedCount',
    label: "Muvaffaqiyatli",
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="text-emerald-600">{row.completedCount}</span>
    ),
  },
  {
    key: 'failureRate',
    label: 'Muvaffaqiyatsizlik darajasi',
    align: 'center',
    sortable: true,
    render: (row) => (
      <span
        className={
          row.failureRate >= 50
            ? 'text-rose-600 font-semibold'
            : row.failureRate >= 30
              ? 'text-amber-600 font-semibold'
              : 'text-[#64748b]'
        }
      >
        {row.failureRate}%
      </span>
    ),
  },
];

export function FailuresTab() {
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Failure[]>('/analytics/failures?limit=20', {}, token)
      .then((r) => setFailures(r.data))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" theme="light" />
        <Table
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={[]}
          keyField="lessonId"
          loading
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0f172a]">
        Eng Ko&apos;p Muvaffaqiyatsizlik
      </h2>
      {failures.length === 0 ? (
        <EmptyState
          icon={<BarChart2 size={24} />}
          title="Hozircha xatoliklar yo'q yoki tahlil sozlanmagan"
          description="Sinab ko'rgan, lekin o'ta olmagan o'quvchilar bu yerda ko'rinadi"
          theme="light"
        />
      ) : (
        <Table
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={failures as unknown as Record<string, unknown>[]}
          keyField="lessonId"
        />
      )}
    </div>
  );
}
