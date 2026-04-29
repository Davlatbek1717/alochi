'use client';
import React, { useEffect, useState } from 'react';
import { BarChart2, Play } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface LessonStat {
  lessonId: string;
  title: string;
  passRate: number;
  totalStudents: number;
  feedbackAvg: number | null;
  feedbackCount: number;
}

interface ABResult {
  variant: string;
  students: number;
  passRate: number;
}

export default function ContentQualityPage() {
  const [lessons, setLessons] = useState<LessonStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);
  const [abResults, setAbResults] = useState<ABResult[] | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    apiRequest<LessonStat[]>('/content-quality/lessons', {}, token())
      .then((r) => setLessons(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function viewABResults(lessonId: string) {
    setSelectedLesson(lessonId);
    try {
      const r = await apiRequest<ABResult[]>(`/content-quality/lessons/${lessonId}/ab-results`, {}, token());
      setAbResults(r.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xato yuz berdi');
    }
  }

  async function startABTest(lessonId: string) {
    try {
      await apiRequest(`/content-quality/lessons/${lessonId}/variant`, {
        method: 'POST',
        body: JSON.stringify({ config: { description: 'B varianti' } }),
      }, token());
      setSuccessMsg('B variant yaratildi');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xato yuz berdi');
    }
  }

  if (loading) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-8">
        <BarChart2 className="text-purple-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Darslar Samaradorligi</h1>
      </div>
      {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
      {successMsg && <div className="mb-4 p-3 bg-green-900/40 border border-green-700 rounded-lg text-green-300 text-sm">{successMsg}</div>}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left px-4 py-3 text-slate-400 font-medium">Dars</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Pass rate</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">O&apos;quvchilar</th>
              <th className="text-center px-4 py-3 text-slate-400 font-medium">Fikr avg</th>
              <th className="text-right px-4 py-3 text-slate-400 font-medium">Amallar</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map((l) => (
              <React.Fragment key={l.lessonId}>
                <tr
                  className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${l.passRate < 50 ? 'bg-red-900/10' : ''}`}>
                  <td className="px-4 py-3 text-white">{l.title}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 bg-slate-700 rounded-full h-2">
                        <div className={`h-2 rounded-full ${l.passRate >= 70 ? 'bg-green-500' : l.passRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${l.passRate}%` }} />
                      </div>
                      <span className={l.passRate < 50 ? 'text-red-400' : 'text-slate-300'}>{l.passRate}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-slate-300">{l.totalStudents}</td>
                  <td className="px-4 py-3 text-center text-slate-300">
                    {l.feedbackAvg ? `${l.feedbackAvg.toFixed(1)} ⭐` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => viewABResults(l.lessonId)}
                      className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-300">
                      A/B natijalar
                    </button>
                    <button onClick={() => startABTest(l.lessonId)}
                      className="text-xs px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded text-white inline-flex items-center gap-1">
                      <Play size={10} /> A/B boshlash
                    </button>
                  </td>
                </tr>
                {selectedLesson === l.lessonId && abResults && (
                  <tr key={`${l.lessonId}-ab`} className="bg-slate-900/60">
                    <td colSpan={5} className="px-6 py-4">
                      <div className="text-sm text-slate-400 mb-2">A/B Test natijalari:</div>
                      <div className="flex gap-4">
                        {abResults.map((ab) => (
                          <div key={ab.variant} className="bg-slate-800 border border-slate-600 rounded-lg p-4 min-w-36">
                            <div className="text-lg font-bold text-white">Variant {ab.variant}</div>
                            <div className="text-slate-400 text-sm">{ab.students} o&apos;quvchi</div>
                            <div className="text-2xl font-bold text-blue-400 mt-1">{ab.passRate}%</div>
                            <div className="text-xs text-slate-500">pass rate</div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {lessons.length === 0 && <div className="p-8 text-center text-slate-500">Hali darslar yo&apos;q</div>}
      </div>
    </div>
  );
}
