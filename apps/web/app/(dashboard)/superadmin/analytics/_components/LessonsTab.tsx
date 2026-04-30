'use client';
import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Table, Column, EmptyState, Skeleton, useToast } from '@/components/ui';

interface LessonStat {
  lessonId: string;
  passRate: number;
  totalStudents: number;
  passed: number;
  avgSessions: number;
  feedbackAvg: number | null;
}

const columns: Column<LessonStat>[] = [
  {
    key: 'lessonId',
    label: 'Dars ID',
    render: (row) => <span className="font-mono text-xs text-slate-400">{row.lessonId.slice(0, 8)}…</span>,
  },
  {
    key: 'passRate',
    label: 'Pass rate',
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className={row.passRate >= 70 ? 'text-emerald-400 font-semibold' : row.passRate >= 50 ? 'text-yellow-400 font-semibold' : 'text-red-400 font-semibold'}>
        {row.passRate}%
      </span>
    ),
  },
  {
    key: 'totalStudents',
    label: "O'quvchilar",
    align: 'center',
    sortable: true,
    render: (row) => <span className="text-slate-300">{row.totalStudents}</span>,
  },
  {
    key: 'avgSessions',
    label: "O'rt. sessiya",
    align: 'center',
    sortable: true,
    render: (row) => <span className="text-slate-300">{row.avgSessions}</span>,
  },
  {
    key: 'feedbackAvg',
    label: 'Fikr',
    align: 'center',
    sortable: true,
    accessor: (row) => row.feedbackAvg ?? 0,
    render: (row) => <span className="text-slate-300">{row.feedbackAvg ?? '—'}</span>,
  },
];

export function LessonsTab() {
  const [lessons, setLessons] = useState<LessonStat[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<LessonStat[]>('/analytics/lessons', {}, token)
      .then((r) => setLessons(r.data))
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Table columns={columns as unknown as Column<Record<string, unknown>>[]} data={[]} keyField="lessonId" loading />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Darslar Samaradorligi</h2>
      {lessons.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} />}
          title="Darslar statistikasi yo'q"
          description="Hali birorta dars uchun ma'lumot yig'ilmagan"
        />
      ) : (
        <Table
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={lessons as unknown as Record<string, unknown>[]}
          keyField="lessonId"
        />
      )}
    </div>
  );
}
