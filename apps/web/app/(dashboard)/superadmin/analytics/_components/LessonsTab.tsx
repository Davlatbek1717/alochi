'use client';
import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Table, Column, EmptyState, Skeleton, useToast } from '@/components/ui';

interface LessonStat {
  lessonId: string;
  lessonTitle: string;
  passRate: number;
  totalStudents: number;
  passed: number;
  avgSessions: number;
  feedbackAvg: number | null;
}

const columns: Column<LessonStat>[] = [
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
    key: 'passRate',
    label: 'Pass rate',
    align: 'center',
    sortable: true,
    render: (row) => (
      <span
        className={
          row.passRate >= 70
            ? 'text-emerald-600 font-semibold'
            : row.passRate >= 50
              ? 'text-amber-600 font-semibold'
              : 'text-rose-600 font-semibold'
        }
      >
        {row.passRate}%
      </span>
    ),
  },
  {
    key: 'totalStudents',
    label: "O'quvchilar",
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="text-[#0f172a] font-medium">{row.totalStudents}</span>
    ),
  },
  {
    key: 'avgSessions',
    label: "O'rt. sessiya",
    align: 'center',
    sortable: true,
    render: (row) => (
      <span className="text-[#64748b]">{Number(row.avgSessions).toFixed(1)}</span>
    ),
  },
  {
    key: 'feedbackAvg',
    label: 'Fikr',
    align: 'center',
    sortable: true,
    accessor: (row) => row.feedbackAvg ?? 0,
    render: (row) => (
      <span className="text-[#64748b]">{row.feedbackAvg ?? '—'}</span>
    ),
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
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-56" theme="light" />
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
        Darslar Samaradorligi
      </h2>
      {lessons.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={24} />}
          title="Darslar statistikasi yo'q"
          description="Hali birorta dars uchun ma'lumot yig'ilmagan"
          theme="light"
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
