'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

const LESSON_TYPES = [
  { value: 'english', label: 'Ingliz tili' },
  { value: 'personal_development', label: 'Shaxsiy rivojlanish' },
  { value: 'critical_thinking', label: 'Tanqidiy fikrlash' },
  { value: 'experiment', label: 'Tajriba' },
];

export default function NewLessonPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    title: '',
    type: 'english',
    orderNumber: '',
    youtubeUrl: '',
    nRepetitions: '3',
    maxNOverride: '',
    mcqEnabled: false,
    wordOrderEnabled: false,
    vocabularyEnabled: false,
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');

    const body: Record<string, unknown> = {
      tenantId: user.tenantId,
      title: form.title,
      type: form.type,
      orderNumber: parseInt(form.orderNumber),
      youtubeUrl: form.youtubeUrl,
      nRepetitions: parseInt(form.nRepetitions),
      mcqEnabled: form.mcqEnabled,
      wordOrderEnabled: form.wordOrderEnabled,
      vocabularyEnabled: form.vocabularyEnabled,
    };

    if (form.maxNOverride) {
      body.maxNOverride = parseInt(form.maxNOverride);
    }

    try {
      await apiRequest('/lessons', {
        method: 'POST',
        body: JSON.stringify(body),
      }, token);
      router.push('/superadmin/lessons');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/superadmin/lessons" className="text-gray-400 hover:text-gray-600">
          ← Orqaga
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Yangi Dars</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dars nomi <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Masalan: Present Simple"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Turi <span className="text-red-500">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {LESSON_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tartib raqami <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={form.orderNumber}
              onChange={(e) => set('orderNumber', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="1"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            YouTube URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={form.youtubeUrl}
            onChange={(e) => set('youtubeUrl', e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="https://youtu.be/..."
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              N — Takrorlash soni <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={form.nRepetitions}
              onChange={(e) => set('nRepetitions', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">1 dan 10 gacha</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max N (Manager uchun limit)
            </label>
            <input
              type="number"
              min="1"
              max="20"
              value={form.maxNOverride}
              onChange={(e) => set('maxNOverride', e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="10"
            />
            <p className="text-xs text-gray-400 mt-1">Ixtiyoriy, 1-20</p>
          </div>
        </div>

        <div>
          <p className="block text-sm font-medium text-gray-700 mb-2">Komponentlar</p>
          <div className="space-y-2">
            {[
              { field: 'mcqEnabled', label: 'MCQ — Ko\'p tanlovli test' },
              { field: 'wordOrderEnabled', label: 'So\'z tartibi testi' },
              { field: 'vocabularyEnabled', label: 'Lug\'at (so\'zlar)' },
            ].map(({ field, label }) => (
              <label key={field} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form[field as keyof typeof form] as boolean}
                  onChange={(e) => set(field, e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            AI Tutor va Kamera — Faza 2 da qo&apos;shiladi
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saqlanmoqda...' : 'Dars yaratish'}
          </button>
          <Link
            href="/superadmin/lessons"
            className="px-4 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
          >
            Bekor
          </Link>
        </div>
      </form>
    </div>
  );
}
