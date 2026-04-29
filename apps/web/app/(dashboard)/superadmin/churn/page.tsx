'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface ChurnStudent {
  id: string;
  score: number;
  signals: Record<string, boolean>;
  student: { id: string; name: string; branchId: string | null };
}

const SIGNAL_LABELS: Record<string, string> = {
  absent3Days: 'Absent 3+ kun',
  streakBroken: 'Streak uzildi',
  passRateDrop: 'Pass rate tushdi',
  redStatus: 'Qizil status',
  noParentTg: "Ota Telegram yo'q",
};

export default function ChurnPage() {
  const [high, setHigh] = useState<ChurnStudent[]>([]);
  const [medium, setMedium] = useState<ChurnStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    Promise.all([
      apiRequest<ChurnStudent[]>('/churn/high-risk', {}, token()),
      apiRequest<ChurnStudent[]>('/churn/medium-risk', {}, token()),
    ])
      .then(([h, m]) => { setHigh(h.data); setMedium(m.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  function StudentTable({ students, color }: { students: ChurnStudent[]; color: 'red' | 'yellow' }) {
    if (students.length === 0) return <div className="text-slate-500 text-sm p-4">Yo&apos;q</div>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400">Ism</th>
              <th className="text-center px-4 py-3 text-slate-400">Ball</th>
              <th className="text-left px-4 py-3 text-slate-400">Sabablar</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-slate-700/50 hover:bg-slate-700/20">
                <td className="px-4 py-3 text-white font-medium">{s.student.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-bold text-lg ${color === 'red' ? 'text-red-400' : 'text-yellow-400'}`}>{s.score}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(s.signals).filter(([, v]) => v).map(([k]) => (
                      <span key={k} className={`text-xs px-2 py-0.5 rounded-full ${color === 'red' ? 'bg-red-900/40 text-red-300' : 'bg-yellow-900/40 text-yellow-300'}`}>
                        {SIGNAL_LABELS[k] ?? k}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <AlertTriangle className="text-red-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Churn Risk Monitoring</h1>
      </div>
      {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
      <div className="space-y-6">
        <div className="bg-slate-800/60 border border-red-900/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-red-900/50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-red-300 font-medium">Yuqori xavf (&gt;60 ball) — {high.length} ta o&apos;quvchi</span>
          </div>
          <StudentTable students={high} color="red" />
        </div>
        <div className="bg-slate-800/60 border border-yellow-900/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-yellow-900/50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-yellow-300 font-medium">O&apos;rta xavf (31–60 ball) — {medium.length} ta o&apos;quvchi</span>
          </div>
          <StudentTable students={medium} color="yellow" />
        </div>
      </div>
    </div>
  );
}
