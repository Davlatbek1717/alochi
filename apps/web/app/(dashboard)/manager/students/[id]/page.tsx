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

  const [studentName, setStudentName] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                      Standart: {lesson.nRepetitions} marta &bull; {lesson.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={overrides[lesson.id] ?? lesson.nRepetitions}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          [lesson.id]: Math.min(20, Math.max(1, Number(e.target.value))),
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
    </div>
  );
}
