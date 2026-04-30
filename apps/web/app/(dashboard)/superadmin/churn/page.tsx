'use client';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Table,
  Column,
  PageHeader,
  EmptyState,
  SkeletonCard,
  useToast,
} from '@/components/ui';

interface ChurnStudent {
  id: string;
  score: number;
  signals: Record<string, boolean>;
  student: { id: string; name: string; branchId: string | null };
}

interface Branch {
  id: string;
  name: string;
}

interface ModelMetrics {
  samples: number;
  precision_mean: number;
  recall_mean: number;
  f1_mean: number;
  cv_folds?: number;
  trained_at?: string;
}

function formatTrainedAt(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('uz-UZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SIGNAL_LABELS: Record<string, string> = {
  absent3Days: 'Absent 3+ kun',
  streakBroken: 'Streak uzildi',
  passRateDrop: 'Pass rate tushdi',
  redStatus: 'Qizil status',
  noParentTg: "Ota Telegram yo'q",
};

function buildColumns(color: 'red' | 'yellow'): Column<ChurnStudent>[] {
  return [
    {
      key: 'student',
      label: 'Ism',
      render: (row) => <span className="text-white font-medium">{row.student.name}</span>,
    },
    {
      key: 'score',
      label: 'Ball',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span className={`font-bold text-lg ${color === 'red' ? 'text-red-400' : 'text-yellow-400'}`}>
          {row.score}
        </span>
      ),
    },
    {
      key: 'signals',
      label: 'Sabablar',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {Object.entries(row.signals)
            .filter(([, v]) => v)
            .map(([k]) => (
              <span
                key={k}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  color === 'red'
                    ? 'bg-red-900/40 text-red-300'
                    : 'bg-yellow-900/40 text-yellow-300'
                }`}
              >
                {SIGNAL_LABELS[k] ?? k}
              </span>
            ))}
        </div>
      ),
    },
  ];
}

export default function ChurnPage() {
  const [high, setHigh] = useState<ChurnStudent[]>([]);
  const [medium, setMedium] = useState<ChurnStudent[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const toast = useToast();

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    apiRequest<Branch[]>('/branches', {}, token())
      .then((r) => setBranches(r.data ?? []))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch ML model metrics. On 404 / error / cold-start payload, leave as null
  // so the UI shows the "Model hali o'qitilmagan" copy.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiRequest<ModelMetrics | { error: string }>(
          '/churn/model-metrics',
          {},
          token(),
        );
        if (cancelled) return;
        const payload = r.data as ModelMetrics | { error: string } | null;
        if (
          payload &&
          typeof (payload as ModelMetrics).samples === 'number' &&
          typeof (payload as ModelMetrics).precision_mean === 'number'
        ) {
          setModelMetrics(payload as ModelMetrics);
        } else {
          setModelMetrics(null);
        }
      } catch {
        if (!cancelled) setModelMetrics(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    setLoading(true);
    const qs = branchId ? `?branchId=${branchId}` : '';
    try {
      const [h, m] = await Promise.all([
        apiRequest<ChurnStudent[]>(`/churn/high-risk${qs}`, {}, token()),
        apiRequest<ChurnStudent[]>(`/churn/medium-risk${qs}`, {}, token()),
      ]);
      setHigh(h.data);
      setMedium(m.data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (initialLoading) {
    return (
      <div className="min-h-full bg-slate-900">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-slate-700/50 animate-pulse" />
          <div className="h-8 w-56 bg-slate-700/50 rounded animate-pulse" />
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
      </div>
    );
  }

  const highColumns = buildColumns('red');
  const mediumColumns = buildColumns('yellow');

  return (
    <div className="min-h-full bg-slate-900">
    <div className="p-6 space-y-6">
      <PageHeader
        icon={<AlertTriangle size={20} />}
        title="Churn Risk Monitoring"
        description="Tashlab ketish xavfi yuqori o'quvchilar ro'yxati"
        iconColor="text-red-400"
      />

      {/* ML model metrics block — Phase 14 */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl shadow p-5">
        <h3 className="font-semibold mb-3 text-slate-100">
          ML modeli ko&apos;rsatkichlari
        </h3>
        {modelMetrics === null ? (
          <p className="text-slate-400 text-sm">
            Model hali o&apos;qitilmagan
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <span className="text-xs text-slate-400">Namunalar</span>
              <div className="font-bold text-lg text-slate-100">
                {modelMetrics.samples}
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400">Precision</span>
              <div className="font-bold text-lg text-slate-100">
                {(modelMetrics.precision_mean * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400">Recall</span>
              <div className="font-bold text-lg text-slate-100">
                {(modelMetrics.recall_mean * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <span className="text-xs text-slate-400">F1</span>
              <div className="font-bold text-lg text-slate-100">
                {(modelMetrics.f1_mean * 100).toFixed(1)}%
              </div>
            </div>
            <div className="col-span-2 md:col-span-4 text-xs text-slate-400">
              Oxirgi train: {formatTrainedAt(modelMetrics.trained_at)}
              {modelMetrics.cv_folds
                ? ` (CV ${modelMetrics.cv_folds} fold)`
                : ''}
            </div>
          </div>
        )}
      </div>

      {/* Branch filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-400" htmlFor="churn-branch-filter">
          Filial:
        </label>
        <select
          id="churn-branch-filter"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">Barcha filiallar</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* High risk */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            <CardTitle>Yuqori xavf (&gt;60 ball)</CardTitle>
            <span className="ml-auto text-sm text-slate-400">{high.length} ta o&apos;quvchi</span>
          </div>
          <CardDescription>Zudlik bilan murojaat talab qilinadi</CardDescription>
        </CardHeader>
        {high.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle size={24} />}
            title="Yuqori xavfli o'quvchilar yo'q"
            description="Barcha o'quvchilar yaxshi holatda"
          />
        ) : (
          <Table
            columns={highColumns as unknown as Column<Record<string, unknown>>[]}
            data={high as unknown as Record<string, unknown>[]}
            keyField="id"
          />
        )}
      </Card>

      {/* Medium risk */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
            <CardTitle>O&apos;rta xavf (31–60 ball)</CardTitle>
            <span className="ml-auto text-sm text-slate-400">{medium.length} ta o&apos;quvchi</span>
          </div>
          <CardDescription>Kuzatuv tavsiya etiladi</CardDescription>
        </CardHeader>
        {medium.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle size={24} />}
            title="O'rta xavfli o'quvchilar yo'q"
            description="Hozircha kuzatuv talab qilinadigan o'quvchilar yo'q"
          />
        ) : (
          <Table
            columns={mediumColumns as unknown as Column<Record<string, unknown>>[]}
            data={medium as unknown as Record<string, unknown>[]}
            keyField="id"
          />
        )}
      </Card>
    </div>
    </div>
  );
}
