'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Activity } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, EmptyState, useToast } from '@/components/ui';

interface ChurnStudent {
  studentId: string;
  name: string;
  score: number;
  risk: 'high' | 'medium' | 'low';
  factors: string[];
}
interface ChurnResp {
  method: 'rule';
  generatedAt: string;
  students: ChurnStudent[];
}
interface ModelMetrics {
  available: boolean;
  modelVersion?: string;
  metrics?: Record<string, unknown>;
}

const RISK_BADGE: Record<ChurnStudent['risk'], { txt: string; cls: string }> = {
  high: { txt: 'Yuqori', cls: 'bg-rose-100 text-rose-700' },
  medium: { txt: "O'rta", cls: 'bg-amber-100 text-amber-700' },
  low: { txt: 'Past', cls: 'bg-emerald-100 text-emerald-700' },
};

export function ChurnTab() {
  const [data, setData] = useState<ChurnResp | null>(null);
  const [model, setModel] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    setLoading(true);
    apiRequest<ChurnResp>('/analytics/churn?limit=50', {}, token)
      .then((r) => setData(r.data))
      .catch((e: unknown) =>
        toast.error(e instanceof Error ? e.message : 'Xatolik'),
      )
      .finally(() => setLoading(false));
    apiRequest<ModelMetrics>('/analytics/churn/metrics', {}, token)
      .then((r) => setModel(r.data))
      .catch(() => setModel({ available: false }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-56" theme="light" />
        <Skeleton className="h-64 w-full rounded-xl" theme="light" />
      </div>
    );
  }

  const students = data?.students ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[#0f172a]">
            Ketib qolish xavfi (churn)
          </h2>
          <p className="text-xs text-[#64748b] mt-0.5">
            Davomat, dars faolligi, oʻzlashtirish va holat asosida
            hisoblangan xavf reytingi.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
            model?.available
              ? 'bg-violet-100 text-violet-700'
              : 'bg-[#f1ede5] text-[#94a3b8]'
          }`}
          title="AI model holati"
        >
          <Activity size={12} />
          {model?.available
            ? `AI model: ${model.modelVersion ?? 'faol'}`
            : 'AI model ulanmagan — qoidaviy hisob'}
        </span>
      </div>

      {students.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={24} />}
          title="Xavf ostidagi oʻquvchilar yoʻq"
          description="Hozircha churn xavfi yuqori oʻquvchi aniqlanmadi"
          theme="light"
        />
      ) : (
        <div className="space-y-2">
          {students.map((s) => {
            const b = RISK_BADGE[s.risk];
            return (
              <div
                key={s.studentId}
                className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 flex items-center gap-3"
              >
                <div className="w-12 text-center shrink-0">
                  <p className="text-xl font-extrabold text-[#0f172a] leading-none">
                    {s.score}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-[#94a3b8]">
                    xavf
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-[#0f172a] truncate">
                    {s.name}
                  </p>
                  {s.factors.length > 0 && (
                    <p className="text-[11px] text-[#64748b] truncate">
                      {s.factors.join(' · ')}
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 text-[11px] font-extrabold px-2 py-0.5 rounded-full ${b.cls}`}
                >
                  {b.txt}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
