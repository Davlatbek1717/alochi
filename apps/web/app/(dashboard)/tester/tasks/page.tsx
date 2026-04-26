'use client';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type Task = {
  id: string;
  title: string;
  description?: string;
  status: string;
  kpiBall: number;
  deadline?: string;
  creator?: { name: string };
};

const STATUS_LABEL: Record<string, string> = {
  sent: 'Yuborildi',
  seen: "Ko'rildi",
  in_progress: 'Jarayonda',
  done: 'Bajarildi',
  confirmed: 'Tasdiqlandi',
};

const STATUS_COLOR: Record<string, string> = {
  sent: 'bg-gray-100 text-gray-600',
  seen: 'bg-blue-100 text-blue-600',
  in_progress: 'bg-yellow-100 text-yellow-700',
  done: 'bg-green-100 text-green-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
};

const NEXT_STATUS: Record<string, string | null> = {
  sent: 'in_progress',
  seen: 'in_progress',
  in_progress: 'done',
  done: null,
  confirmed: null,
};

const NEXT_LABEL: Record<string, string> = {
  in_progress: 'Boshlash',
  done: 'Bajarildi ✓',
};

export default function TesterTasksPage() {
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
    } catch (err) { alert(err instanceof Error ? err.message : 'Xato'); }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-lg font-bold text-gray-900">Mening Vazifalarim</h1>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Yuklanmoqda...</p>
      ) : tasks.length === 0 ? (
        <p className="text-center text-gray-400 py-10">Vazifalar yo&apos;q</p>
      ) : (
        <div className="space-y-3">
          {tasks.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900 text-sm">{t.title}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLOR[t.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
              </div>
              {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{t.creator?.name}</span>
                <span>{t.kpiBall > 0 ? `${t.kpiBall} KPI` : ''}</span>
              </div>
              {NEXT_STATUS[t.status] && (
                <button
                  onClick={() => updateStatus(t.id, NEXT_STATUS[t.status]!)}
                  className="w-full bg-indigo-600 text-white py-1.5 rounded-xl text-xs font-semibold"
                >
                  {NEXT_LABEL[NEXT_STATUS[t.status]!] ?? NEXT_STATUS[t.status]}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
