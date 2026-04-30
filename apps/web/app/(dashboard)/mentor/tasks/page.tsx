'use client';
import { useEffect, useState } from 'react';
import { ClipboardList, PlayCircle, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';

type Task = {
  id: string; title: string; description?: string; status: string;
  kpiBall: number; deadline?: string; creator?: { name: string };
};

const STATUS_LABEL: Record<string, string> = {
  sent: 'Yuborildi', seen: "Ko'rildi", in_progress: 'Jarayonda', done: 'Bajarildi', confirmed: 'Tasdiqlandi',
};
const STATUS_BADGE: Record<string, string> = {
  sent:        'bg-[#f7f4ef] text-[#64748b] border border-[#ede9e1]',
  seen:        'bg-blue-50 text-blue-600 border border-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 border border-amber-200',
  done:        'bg-emerald-50 text-emerald-600 border border-emerald-200',
  confirmed:   'bg-[#0d9488]/10 text-[#0d9488] border border-[#0d9488]/20',
};

const NEXT_STATUS: Record<string, string | null> = {
  sent: 'in_progress', seen: 'in_progress', in_progress: 'done', done: null, confirmed: null,
};

export default function MentorTasksPage() {
  const { success, error: toastError } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  function token() { return localStorage.getItem('accessToken') ?? ''; }

  useEffect(() => {
    apiRequest<Task[]>('/tasks/my', {}, token())
      .then((res) => setTasks(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    try {
      const res = await apiRequest<Task>(`/tasks/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, token());
      setTasks((prev) => prev.map((t) => t.id === id ? res.data : t));
      success('Status yangilandi');
    } catch (err) { toastError(err instanceof Error ? err.message : 'Xato'); }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Mentor</p>
          <p className="text-white text-xl font-bold">Mening Vazifalarim</p>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-4 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState
              icon={<ClipboardList size={28} />}
              title="Vazifalar yo'q"
              description="Sizga hali vazifalar yuklanmagan"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((t) => {
              const next = NEXT_STATUS[t.status];
              return (
                <div key={t.id} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-4 space-y-2.5">
                  <div className="flex items-start gap-2 justify-between">
                    <p className="font-semibold text-[#0f172a] text-sm flex-1">{t.title}</p>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[t.status] ?? STATUS_BADGE.sent}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>
                  {t.description && <p className="text-xs text-[#64748b]">{t.description}</p>}
                  <div className="flex items-center justify-between text-xs text-[#94a3b8]">
                    <span>{t.creator?.name}</span>
                    {t.kpiBall > 0 && <span className="bg-[#f7f4ef] px-2 py-0.5 rounded-full">{t.kpiBall} KPI</span>}
                  </div>
                  {next && (
                    <Button
                      variant={next === 'done' ? 'success' : 'secondary'}
                      fullWidth
                      size="sm"
                      icon={next === 'done' ? <CheckCircle size={14} /> : <PlayCircle size={14} />}
                      onClick={() => updateStatus(t.id, next)}
                    >
                      {next === 'done' ? 'Bajarildi' : 'Boshlash'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
