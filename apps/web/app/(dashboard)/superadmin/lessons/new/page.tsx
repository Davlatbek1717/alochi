'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, CheckSquare } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, useToast } from '@/components/ui';

const LESSON_TYPES = [
  { value: 'english', label: 'Ingliz tili' },
  { value: 'personal_development', label: 'Shaxsiy rivojlanish' },
  { value: 'critical_thinking', label: 'Tanqidiy fikrlash' },
  { value: 'experiment', label: 'Tajriba' },
];

export default function NewLessonPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const toast = useToast();

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
    aiTutorEnabled: false,
    hasExam: false,
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { tenantId?: string };

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
      aiTutorEnabled: form.aiTutorEnabled,
      hasExam: form.hasExam,
    };

    if (form.maxNOverride) {
      body.maxNOverride = parseInt(form.maxNOverride);
    }

    try {
      await apiRequest('/lessons', {
        method: 'POST',
        body: JSON.stringify(body),
      }, token);
      toast.success('Dars yaratildi');
      router.push('/superadmin/lessons');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
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
          <button onClick={() => router.push('/superadmin/lessons')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Darslar
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
              <BookOpen size={18} className="text-[#0d9488]" />
            </div>
            <p className="text-white font-bold text-lg">Yangi Dars</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              Dars nomi <span className="text-[#e11d48]">*</span>
            </p>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              aria-label="Dars nomi"
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm font-medium focus:outline-none focus:border-[#0f172a]"
              placeholder="Masalan: Present Simple"
              required
            />
          </div>

          {/* Type and order */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                  Turi <span className="text-[#e11d48]">*</span>
                </p>
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  aria-label="Dars turi"
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
                >
                  {LESSON_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                  Tartib # <span className="text-[#e11d48]">*</span>
                </p>
                <input
                  type="number"
                  min="1"
                  aria-label="Tartib raqami"
                  value={form.orderNumber}
                  onChange={(e) => set('orderNumber', e.target.value)}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
                  placeholder="1"
                  required
                />
              </div>
            </div>
          </div>

          {/* YouTube */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              YouTube URL <span className="text-[#e11d48]">*</span>
            </p>
            <input
              type="url"
              aria-label="YouTube URL"
              value={form.youtubeUrl}
              onChange={(e) => set('youtubeUrl', e.target.value)}
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
              placeholder="https://youtu.be/..."
              required
            />
          </div>

          {/* N repetitions */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                  N takrorlash <span className="text-[#e11d48]">*</span>
                </p>
                <input
                  type="number"
                  min="1"
                  max="10"
                  aria-label="N takrorlash soni"
                  value={form.nRepetitions}
                  onChange={(e) => set('nRepetitions', e.target.value)}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
                  required
                />
                <p className="text-xs text-[#94a3b8]">1–10</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Max N</p>
                <input
                  type="number"
                  min="1"
                  max="20"
                  aria-label="Maksimal N"
                  value={form.maxNOverride}
                  onChange={(e) => set('maxNOverride', e.target.value)}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a]"
                  placeholder="10"
                />
                <p className="text-xs text-[#94a3b8]">Ixtiyoriy, 1–20</p>
              </div>
            </div>
          </div>

          {/* Components */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Komponentlar</p>
            <div className="space-y-2">
              {[
                { field: 'mcqEnabled', label: "MCQ — Ko'p tanlovli test" },
                { field: 'wordOrderEnabled', label: "So'z tartibi testi" },
                { field: 'vocabularyEnabled', label: "Lug'at (so'zlar)" },
                { field: 'aiTutorEnabled', label: 'AI Tutor — Claude bilan savol-javob' },
                { field: 'hasExam', label: "Akademiyada imtihon (tester tomonidan ochiladi)" },
              ].map(({ field, label }) => (
                <label key={field} className="flex items-center gap-3 cursor-pointer p-3 rounded-xl hover:bg-[#f7f4ef] transition-colors">
                  <div className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center transition-colors ${
                    form[field as keyof typeof form]
                      ? 'bg-[#0f172a] border-[#0f172a]'
                      : 'border-[#ede9e1] bg-white'
                  }`}>
                    {form[field as keyof typeof form] && <CheckSquare size={12} className="text-white" />}
                  </div>
                  <input
                    type="checkbox"
                    checked={form[field as keyof typeof form] as boolean}
                    onChange={(e) => set(field, e.target.checked)}
                    className="sr-only"
                  />
                  <span className="text-sm text-[#0f172a] font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              fullWidth
              size="lg"
            >
              {saving ? 'Saqlanmoqda...' : 'Dars yaratish'}
            </Button>
            <button
              type="button"
              onClick={() => router.push('/superadmin/lessons')}
              className="px-5 py-4 border-[1.5px] border-[#ede9e1] rounded-xl text-[#64748b] font-bold text-sm hover:bg-[#f7f4ef]"
            >
              Bekor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
