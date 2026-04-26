'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  orderNumber: number;
  nRepetitions: number;
  maxNOverride: number;
  type: string;
}

interface StudentStatus {
  englishStatus: string;
  personalStatus: string;
  criticalStatus: string;
}

interface UserInfo {
  id: string;
  name: string;
  role: string;
}

type StatusColor = 'green' | 'yellow' | 'red';

function statusColor(value: string): StatusColor {
  if (value === 'yashil') return 'green';
  if (value === 'sariq') return 'yellow';
  if (value === 'qizil') return 'red';
  return 'red';
}

const STATUS_CLASSES: Record<StatusColor, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<StatusColor, string> = {
  green: 'Yashil',
  yellow: 'Sariq',
  red: 'Qizil',
};

export default function StudentProfilePage() {
  const { id: studentId } = useParams<{ id: string }>();
  const router = useRouter();

  type StatusRecord = {
    id: string; date: string; englishStatus: string; personalStatus: string; criticalStatus: string;
    personalNote?: string; givenBy?: string;
  };

  const [studentName, setStudentName] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<StatusRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function load() {
      try {
        const [lessonsRes, statusRes, userRes] = await Promise.all([
          apiRequest<Lesson[]>('/lessons', {}, token),
          apiRequest<StudentStatus>(`/status/${studentId}`, {}, token).catch(() => ({ data: null })),
          apiRequest<UserInfo>(`/users/${studentId}`, {}, token),
        ]);

        setLessons(lessonsRes.data);
        setStatus(statusRes.data);
        setStudentName(userRes.data.name);

        const initial: Record<string, number> = {};
        for (const l of lessonsRes.data) {
          initial[l.id] = l.nRepetitions;
        }
        setOverrides(initial);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [studentId]);

  async function loadHistory() {
    if (historyLoading || history.length > 0) { setShowHistory(true); return; }
    setHistoryLoading(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<StatusRecord[]>(`/status/history/${studentId}`, {}, token);
      setHistory(res.data);
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); setShowHistory(true); }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave(lessonId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setSaving((prev) => ({ ...prev, [lessonId]: true }));
    try {
      await apiRequest(
        `/student-config/${studentId}/${lessonId}/n-override`,
        {
          method: 'POST',
          body: JSON.stringify({ nRepetitions: overrides[lessonId] }),
        },
        token,
      );
      showToast('Saqlandi!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving((prev) => ({ ...prev, [lessonId]: false }));
    }
  }

  function handleStart11() {
    const encoded = encodeURIComponent(`1:1 sessiya: ${studentName}`);
    router.push(`/delegations/new?reason=${encoded}`);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">
          {toast}
        </div>
      )}

      <Link
        href="/manager"
        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
      >
        &larr; Orqaga
      </Link>

      <div className="bg-white rounded-xl shadow-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">
            {loading ? (
              <span className="inline-block h-6 w-36 bg-gray-200 rounded animate-pulse" />
            ) : (
              studentName || 'Nomaʼlum oʼquvchi'
            )}
          </h1>
          <p className="text-sm text-gray-500">O&apos;quvchi profili</p>
        </div>
        <button
          onClick={handleStart11}
          disabled={!studentName}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          1:1 Sessiya boshlash
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-3">Holat</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Yuklanmoqda...</p>
        ) : error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : status ? (
          <div className="flex flex-wrap gap-3">
            {(
              [
                { label: 'Ingliz tili', value: status.englishStatus },
                { label: 'Shaxsiy', value: status.personalStatus },
                { label: 'Tanqidiy', value: status.criticalStatus },
              ] as { label: string; value: string }[]
            ).map(({ label, value }) => {
              const color = statusColor(value);
              return (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${STATUS_CLASSES[color]}`}
                >
                  {label}: {STATUS_LABELS[color]}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Status belgilanmagan</p>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold">Dars takrorlash soni (N override)</h2>
        </div>
        {loading ? (
          <div className="p-5 text-sm text-gray-400">Yuklanmoqda...</div>
        ) : error ? (
          <div className="p-5 text-sm text-red-500">{error}</div>
        ) : (
          <div className="divide-y">
            {lessons
              .slice()
              .sort((a, b) => a.orderNumber - b.orderNumber)
              .map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{lesson.title}</p>
                    <p className="text-xs text-gray-400">
                      Standart: {lesson.nRepetitions} marta &bull; Maks: {lesson.maxNOverride} &bull; {lesson.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={lesson.maxNOverride}
                      value={overrides[lesson.id] ?? lesson.nRepetitions}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          [lesson.id]: Math.min(lesson.maxNOverride, Math.max(1, Number(e.target.value))),
                        }))
                      }
                      className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      onClick={() => handleSave(lesson.id)}
                      disabled={saving[lesson.id]}
                      className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {saving[lesson.id] ? '...' : 'Saqlash'}
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <button
          onClick={() => showHistory ? setShowHistory(false) : loadHistory()}
          className="w-full px-5 py-4 flex items-center justify-between text-left border-b border-gray-100"
        >
          <h2 className="font-semibold">Status tarixi</h2>
          <span className="text-gray-400 text-sm">{showHistory ? '▲' : '▼'}</span>
        </button>

        {showHistory && (
          historyLoading ? (
            <p className="p-5 text-sm text-gray-400">Yuklanmoqda...</p>
          ) : history.length === 0 ? (
            <p className="p-5 text-sm text-gray-400">Tarix yo&apos;q</p>
          ) : (
            <div className="divide-y">
              {history.map((h) => (
                <div key={h.id} className="px-5 py-3 flex flex-wrap gap-x-4 gap-y-1 items-start">
                  <span className="text-xs text-gray-400 w-24 shrink-0">
                    {new Date(h.date).toLocaleDateString('uz-UZ')}
                  </span>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { label: 'ING', val: h.englishStatus },
                      { label: 'SHAXS', val: h.personalStatus },
                      { label: 'TANQ', val: h.criticalStatus },
                    ].map(({ label, val }) => (
                      <span key={label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        val === 'yashil' ? 'bg-green-100 text-green-700' :
                        val === 'sariq'  ? 'bg-yellow-100 text-yellow-700' :
                        val === 'qizil'  ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {label}: {val ?? '—'}
                      </span>
                    ))}
                  </div>
                  {h.personalNote && (
                    <p className="text-xs text-gray-500 w-full ml-24">{h.personalNote}</p>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
