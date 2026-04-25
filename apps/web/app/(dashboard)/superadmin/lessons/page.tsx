'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

interface Lesson {
  id: string;
  title: string;
  type: string;
  orderNumber: number;
  youtubeUrl: string;
  nRepetitions: number;
  isPublished: boolean;
  components: Record<string, boolean>;
}

const TYPE_LABELS: Record<string, string> = {
  english: 'Ingliz tili',
  personal_development: 'Shaxsiy rivojlanish',
  critical_thinking: 'Tanqidiy fikrlash',
  experiment: 'Tajriba',
};

export default function SuperadminLessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lesson[]>('/lessons', {}, token)
      .then((res) => setLessons(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function publishLesson(id: string) {
    setPublishing(id);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(`/lessons/${id}/publish`, { method: 'PATCH' }, token);
      setLessons((prev) => prev.map((l) => l.id === id ? { ...l, isPublished: true } : l));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xatolik');
    } finally {
      setPublishing(null);
    }
  }

  if (loading) {
    return <div className="text-gray-500 p-6">Yuklanmoqda...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Darslar</h1>
        <Link
          href="/superadmin/lessons/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          + Yangi Dars
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {lessons.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm">
          <p className="text-4xl mb-2">📚</p>
          <p className="font-medium">Hali dars yo&apos;q</p>
          <p className="text-sm mt-1">Birinchi darsni yarating</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Nomi</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Turi</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">N</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Komponentlar</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lessons.map((lesson) => (
                <tr key={lesson.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{lesson.orderNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{lesson.title}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {TYPE_LABELS[lesson.type] ?? lesson.type}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{lesson.nRepetitions}x</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {lesson.components.mcq && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">MCQ</span>
                      )}
                      {lesson.components.word_order && (
                        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded">So&apos;z</span>
                      )}
                      {lesson.components.vocabulary && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded">Lug&apos;at</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      lesson.isPublished
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {lesson.isPublished ? 'Nashr qilingan' : 'Qoralama'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <Link
                        href={`/superadmin/lessons/${lesson.id}`}
                        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Tahrirlash
                      </Link>
                      {!lesson.isPublished && (
                        <button
                          onClick={() => publishLesson(lesson.id)}
                          disabled={publishing === lesson.id}
                          className="text-sm text-green-600 hover:text-green-800 font-medium disabled:opacity-50"
                        >
                          {publishing === lesson.id ? '...' : 'Nashr'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
