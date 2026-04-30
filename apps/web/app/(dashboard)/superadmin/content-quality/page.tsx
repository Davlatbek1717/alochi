'use client';
import React, { useEffect, useState } from 'react';
import { BarChart2, Play, Eye } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  Button,
  Modal,
  Table,
  Column,
  PageHeader,
  Skeleton,
  useToast,
} from '@/components/ui';

interface LessonStat {
  lessonId: string;
  title: string;
  passRate: number;
  totalStudents: number;
  feedbackAvg: number | null;
  feedbackCount: number;
  avgSessions: number;
}

interface ABResult {
  variant: string;
  students: number;
  passRate: number;
}

export default function ContentQualityPage() {
  const [lessons, setLessons] = useState<LessonStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [abResults, setAbResults] = useState<ABResult[] | null>(null);
  const toast = useToast();

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    apiRequest<LessonStat[]>('/content-quality/lessons', {}, token())
      .then((r) => setLessons(r.data))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function viewABResults(lessonId: string) {
    setSelectedLesson(lessonId);
    try {
      const r = await apiRequest<ABResult[]>(`/content-quality/lessons/${lessonId}/ab-results`, {}, token());
      setAbResults(r.data);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    }
  }

  async function startABTest(lessonId: string) {
    try {
      await apiRequest(`/content-quality/lessons/${lessonId}/variant`, {
        method: 'POST',
        body: JSON.stringify({ config: { description: 'B varianti' } }),
      }, token());
      toast.success('B variant yaratildi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: Column<any>[] = [
    {
      key: 'title',
      label: 'Dars',
      render: (row) => <span className="text-white font-medium">{row.title}</span>,
    },
    {
      key: 'passRate',
      label: 'Pass rate',
      align: 'center',
      sortable: true,
      render: (row) => (
        <div className="flex items-center justify-center gap-2">
          <div className="w-20 bg-slate-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${row.passRate >= 70 ? 'bg-emerald-500' : row.passRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${row.passRate}%` }}
            />
          </div>
          <span className={row.passRate < 50 ? 'text-red-400 font-semibold' : 'text-slate-300'}>{row.passRate}%</span>
        </div>
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
      key: 'feedbackAvg',
      label: 'Fikr avg',
      align: 'center',
      sortable: true,
      accessor: (row) => row.feedbackAvg ?? 0,
      render: (row) => (
        <span className="text-slate-300">{row.feedbackAvg ? `${row.feedbackAvg.toFixed(1)} ⭐` : '—'}</span>
      ),
    },
    {
      key: 'avgSessions',
      label: "O'rtacha sessiya",
      align: 'center',
      sortable: true,
      accessor: (row) => row.avgSessions ?? 0,
      render: (row) => (
        <span className="text-slate-300">{row.avgSessions ? row.avgSessions.toFixed(1) : '—'}</span>
      ),
    },
    {
      key: 'lessonId',
      label: 'Amallar',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<Eye size={12} />}
            onClick={(e) => { e.stopPropagation(); viewABResults(row.lessonId); }}
          >
            A/B natijalar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Play size={12} />}
            onClick={(e) => { e.stopPropagation(); startABTest(row.lessonId); }}
          >
            A/B boshlash
          </Button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-full bg-slate-900">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-8 w-56" />
        </div>
        <Table columns={columns} data={[]} keyField="lessonId" loading />
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-900">
    <div className="p-6 space-y-6">
      <PageHeader
        icon={<BarChart2 size={20} />}
        title="Darslar Samaradorligi"
        description="Pass rate, A/B test natijalari va fikr-mulohazalar"
        iconColor="text-purple-400"
      />

      <Table
        columns={columns}
        data={lessons}
        keyField="lessonId"
        emptyMessage="Hali darslar yo'q"
        rowClassName={(row) => (row.passRate < 50 ? 'bg-rose-50/30' : '')}
      />

      <Modal
        open={Boolean(selectedLesson && abResults)}
        onClose={() => { setSelectedLesson(null); setAbResults(null); }}
        title="A/B Test natijalari"
        size="lg"
      >
        <div className="flex gap-4 flex-wrap">
          {abResults?.map((ab) => (
            <div key={ab.variant} className="bg-slate-900/60 border border-slate-600 rounded-xl p-4 min-w-36">
              <div className="text-lg font-bold text-white">Variant {ab.variant}</div>
              <div className="text-slate-400 text-sm">{ab.students} o&apos;quvchi</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{ab.passRate}%</div>
              <div className="text-xs text-slate-500">pass rate</div>
            </div>
          ))}
          {abResults && abResults.length === 0 && (
            <p className="text-slate-500 text-sm">Bu dars uchun A/B test yo&apos;q</p>
          )}
        </div>
      </Modal>
    </div>
    </div>
  );
}
