'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BookOpen,
  CheckSquare,
  AlertTriangle,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, useToast } from '@/components/ui';

const LESSON_TYPES = [
  { value: 'english', label: 'Ingliz tili' },
  { value: 'personal_development', label: 'Shaxsiy rivojlanish' },
  { value: 'critical_thinking', label: 'Tanqidiy fikrlash' },
  { value: 'experiment', label: 'Tajriba' },
];

interface ExistingLesson {
  id: string;
  orderNumber: number;
}

/**
 * Pull a YouTube video ID out of any common URL shape so the embed
 * preview works regardless of how the URL was pasted. Mirrors the
 * student-side parser; intentionally permissive.
 */
function getYoutubeId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const v = u.searchParams.get('v');
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const parts = u.pathname.split('/').filter(Boolean);
      if (
        parts.length >= 2 &&
        ['embed', 'v', 'shorts', 'live'].includes(parts[0])
      ) {
        const id = parts[1];
        return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    /* fall through */
  }
  return null;
}

export default function FiladminNewLessonPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [suggestedOrder, setSuggestedOrder] = useState<number | null>(null);
  const toast = useToast();

  const [form, setForm] = useState({
    title: '',
    type: 'english',
    orderNumber: '',
    youtubeUrl: '',
    nRepetitions: '3',
    maxNOverride: '',
    aiTutorEnabled: false,
    hasExam: false,
  });

  // Pre-load existing lessons once so we can suggest the next free
  // orderNumber. Avoids the admin having to count through 500 entries
  // by hand to find the gap.
  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<ExistingLesson[]>('/lessons', {}, token)
      .then((res) => {
        if (res.data.length === 0) {
          setSuggestedOrder(1);
          return;
        }
        const max = res.data.reduce(
          (m, l) => (l.orderNumber > m ? l.orderNumber : m),
          0,
        );
        setSuggestedOrder(max + 1);
      })
      .catch(() => {
        // Non-fatal — admin can still type the number manually.
        setSuggestedOrder(1);
      });
  }, []);

  // Apply the suggestion the moment it arrives, but only if the admin
  // hasn't started typing one. Bare assignment here would clobber a
  // user-entered value after a slow network.
  useEffect(() => {
    if (suggestedOrder !== null && form.orderNumber === '') {
      setForm((prev) => ({ ...prev, orderNumber: String(suggestedOrder) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedOrder]);

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const ytId = useMemo(() => getYoutubeId(form.youtubeUrl), [form.youtubeUrl]);
  const ytInvalid = form.youtubeUrl.trim() !== '' && !ytId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.error('Dars nomini kiriting');
      return;
    }
    if (!form.orderNumber || Number(form.orderNumber) < 1) {
      toast.error("Tartib raqami noto'g'ri");
      return;
    }
    if (!ytId) {
      toast.error("YouTube havolasi noto'g'ri");
      return;
    }

    setSaving(true);

    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as {
      tenantId?: string;
    };

    const body: Record<string, unknown> = {
      tenantId: user.tenantId,
      title: form.title.trim(),
      type: form.type,
      orderNumber: parseInt(form.orderNumber, 10),
      youtubeUrl: form.youtubeUrl.trim(),
      nRepetitions: parseInt(form.nRepetitions, 10),
      aiTutorEnabled: form.aiTutorEnabled,
      hasExam: form.hasExam,
    };

    if (form.maxNOverride) {
      body.maxNOverride = parseInt(form.maxNOverride, 10);
    }

    try {
      const res = await apiRequest<{ id: string }>(
        '/lessons',
        { method: 'POST', body: JSON.stringify(body) },
        token,
      );
      toast.success("Dars yaratildi — endi topshiriq qo'shing");
      // Land on the edit page so the admin can keep authoring without
      // bouncing through the list.
      router.push(`/filadmin/lessons/${res.data.id}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  const fieldLabel =
    'block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5';
  const fieldInput =
    'w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0d9488] transition-colors';

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 space-y-4">
          <button
            onClick={() => router.push('/filadmin/lessons')}
            className="flex items-center gap-2 text-[#94a3b8] text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Darslar
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0d9488]/20 flex items-center justify-center shrink-0">
              <BookOpen size={20} className="text-[#0d9488]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">
                Yangi dars
              </p>
              <p className="text-[#94a3b8] text-xs font-semibold">
                Asosiy ma&apos;lumotlarni kiriting — keyingi qadamda topshiriqlarni qo&apos;shasiz
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <label className={fieldLabel}>
              Dars nomi <span className="text-[#e11d48]">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={fieldInput}
              placeholder="Masalan: Present Simple"
              required
              autoFocus
            />
          </div>

          {/* Type + order */}
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={fieldLabel}>
                  Turi <span className="text-[#e11d48]">*</span>
                </label>
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  className={fieldInput}
                >
                  {LESSON_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-widest text-[#64748b]">
                    Tartib raqami <span className="text-[#e11d48]">*</span>
                  </label>
                  {suggestedOrder !== null &&
                    form.orderNumber !== String(suggestedOrder) && (
                      <button
                        type="button"
                        onClick={() => set('orderNumber', String(suggestedOrder))}
                        className="flex items-center gap-1 text-[10px] font-bold text-[#0d9488] hover:underline"
                      >
                        <Sparkles size={10} />#{suggestedOrder} taklif
                      </button>
                    )}
                </div>
                <input
                  type="number"
                  min={1}
                  value={form.orderNumber}
                  onChange={(e) => set('orderNumber', e.target.value)}
                  className={fieldInput}
                  placeholder={
                    suggestedOrder !== null ? String(suggestedOrder) : '1'
                  }
                  required
                />
              </div>
            </div>
          </div>

          {/* YouTube + live preview */}
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <label className={fieldLabel}>
              YouTube URL <span className="text-[#e11d48]">*</span>
            </label>
            <div className="relative">
              <LinkIcon
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
              />
              <input
                type="url"
                value={form.youtubeUrl}
                onChange={(e) => set('youtubeUrl', e.target.value)}
                className={`${fieldInput} pl-9`}
                placeholder="https://youtu.be/..."
                required
              />
            </div>
            {ytInvalid && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <AlertTriangle
                  size={14}
                  className="text-amber-600 shrink-0 mt-0.5"
                />
                <p className="text-xs font-semibold text-amber-800">
                  Video ID aniqlanmadi — havolani tekshiring (youtu.be /
                  youtube.com / shorts).
                </p>
              </div>
            )}
            {ytId && (
              <div className="rounded-xl overflow-hidden border border-[#ede9e1] aspect-video bg-black">
                <iframe
                  key={ytId}
                  src={`https://www.youtube.com/embed/${ytId}`}
                  title="YouTube preview"
                  className="w-full h-full"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>

          {/* Repetitions */}
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={fieldLabel}>
                  N takrorlash <span className="text-[#e11d48]">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.nRepetitions}
                  onChange={(e) => set('nRepetitions', e.target.value)}
                  className={fieldInput}
                  required
                />
                <p className="text-xs text-[#94a3b8] font-semibold mt-1">
                  1–10 oralig&apos;ida
                </p>
              </div>
              <div>
                <label className={fieldLabel}>Maksimum N (ixtiyoriy)</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.maxNOverride}
                  onChange={(e) => set('maxNOverride', e.target.value)}
                  className={fieldInput}
                  placeholder="Masalan: 10"
                />
                <p className="text-xs text-[#94a3b8] font-semibold mt-1">
                  Bo&apos;sh qoldirsangiz N ishlatiladi
                </p>
              </div>
            </div>
          </div>

          {/* Lesson-level toggles. The 13 exercise types (MCQ, word_order,
              translate, listen_*, etc) are configured one-by-one on the
              edit page after creation. The admin previously had to pre-
              guess which "components" they wanted via these checkboxes —
              now this section is just for lesson-level features that
              have no per-instance config. */}
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[#64748b]">
              Qo&apos;shimcha xususiyatlar
            </p>
            <div className="space-y-1">
              {[
                {
                  field: 'aiTutorEnabled',
                  label: 'AI Tutor — Aloqush bilan savol-javob (Gemini)',
                  hint: '3 ta savol berishi mumkin',
                },
                {
                  field: 'hasExam',
                  label: 'Akademiyada imtihon',
                  hint: 'Tester tomonidan ochiladi',
                },
              ].map(({ field, label, hint }) => {
                const checked = form[field as keyof typeof form] as boolean;
                return (
                  <label
                    key={field}
                    className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-[#f7f4ef] transition-colors"
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-[1.5px] flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        checked
                          ? 'bg-[#0d9488] border-[#0d9488]'
                          : 'border-[#ede9e1] bg-white'
                      }`}
                    >
                      {checked && <CheckSquare size={12} className="text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => set(field, e.target.checked)}
                      className="sr-only"
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-[#0f172a] font-bold leading-snug">
                        {label}
                      </p>
                      <p className="text-xs text-[#94a3b8] font-semibold mt-0.5">
                        {hint}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2">
              <p className="text-xs font-semibold text-[#64748b] leading-relaxed">
                <span className="font-bold text-[#0f172a]">Eslatma:</span>{' '}
                Mashqlar (MCQ, tarjima, eshitish, ovozli o&apos;qish, va h.k.) keyingi qadamda dars sahifasida bittadan qo&apos;shiladi.
              </p>
            </div>
          </div>

          <div className="flex gap-3 sticky bottom-3 z-10">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              fullWidth
              size="lg"
              disabled={saving || ytInvalid}
            >
              {saving ? 'Saqlanmoqda...' : 'Dars yaratish va davom etish'}
            </Button>
            <button
              type="button"
              onClick={() => router.push('/filadmin/lessons')}
              disabled={saving}
              className="px-5 py-4 border-[1.5px] border-[#ede9e1] bg-white rounded-xl text-[#64748b] font-bold text-sm hover:bg-[#f7f4ef] disabled:opacity-50 transition-colors"
            >
              Bekor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
