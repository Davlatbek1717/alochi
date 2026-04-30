'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Table, Column, EmptyState, Skeleton, useToast } from '@/components/ui';

interface Failure {
  lessonId: string;
  failedCount: number;
  completedCount: number;
  failureRate: number;
}

const columns: Column<Failure>[] = [
  {
    key: 'lessonId',
    label: 'Dars ID',
    render: (row) => <span className="font-mono text-xs text-slate-400">{row.lessonId.slice(0, 8)}…</span>,
  },
  {
    key: 'failedCount',
    label: 'Failed',
    align: 'center',
    sortable: true,
    render: (row) => <span className="text-red-400 font-semibold">{row.failedCount}</span>,
  },
  {
    key: 'completedCount',
    label: 'Completed',
    align: 'center',
    sortable: true,
    render: (row) => <span className="text-emerald-400">{row.completedCount}</span>,
  },
  {
    key: 'failureRate',
    label: 'Failure rate',
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className={row.failureRate >= 50 ? 'text-red-400 font-semibold' : row.failureRate >= 30 ? 'text-yellow-400 font-semibold' : 'text-slate-300'}>
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
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Table columns={columns as unknown as Column<Record<string, unknown>>[]} data={[]} keyField="lessonId" loading />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Top Failure Lessons</h2>
      {failures.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={24} />}
          title="Failures yo'q — ajoyib!"
          description="Hech qanday darsda kritik muvaffaqiyatsizlik darajasi yo'q"
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
