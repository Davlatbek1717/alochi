'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Upload, Trash2, Award } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';

type CertLevel = {
  level: 'bronze' | 'silver' | 'gold' | 'diamond';
  label: string;
  emoji: string;
  minLessons: number;
  imageUrl: string | null;
};

interface Draft {
  minLessons: string; // string for input value
  imageUrl: string | null; // null = unchanged from server, '' = explicit clear
  imagePreview: string | null; // local preview (data URL)
}

const MAX_IMAGE_BYTES = 700 * 1024; // 700 KB — keeps base64-encoded data-URL under 1 MB

function getToken() {
  return typeof window !== 'undefined'
    ? (localStorage.getItem('accessToken') ?? '')
    : '';
}

export default function CertificateDesignPage() {
  const toast = useToast();
  const [levels, setLevels] = useState<CertLevel[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadLevels = useCallback(() => {
    apiRequest<CertLevel[]>('/gamification/certificate-levels', {}, getToken())
      .then((res) => {
        const sorted = [...(res.data ?? [])].sort(
          (a, b) => a.minLessons - b.minLessons,
        );
        setLevels(sorted);
        const next: Record<string, Draft> = {};
        for (const l of sorted) {
          next[l.level] = {
            minLessons: String(l.minLessons),
            imageUrl: null, // null = unchanged
            imagePreview: l.imageUrl,
          };
        }
        setDrafts(next);
      })
      .catch(() => toast.error('Levels yuklanmadi'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadLevels(); }, [loadLevels]);
  useFocusRevalidate(loadLevels);

  function handleFile(level: string, file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Faqat rasm fayli (PNG, JPG, WebP) qabul qilinadi');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`Fayl 700 KB dan kichik bo'lishi kerak (joriy: ${(file.size / 1024).toFixed(0)} KB)`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setDrafts((p) => ({
        ...p,
        [level]: {
          ...p[level],
          imageUrl: dataUrl,
          imagePreview: dataUrl,
        },
      }));
    };
    reader.readAsDataURL(file);
  }

  function clearImage(level: string) {
    setDrafts((p) => ({
      ...p,
      [level]: {
        ...p[level],
        imageUrl: '', // explicit clear sentinel
        imagePreview: null,
      },
    }));
    const input = fileInputs.current[level];
    if (input) input.value = '';
  }

  function setStep(level: string, value: string) {
    setDrafts((p) => ({
      ...p,
      [level]: { ...p[level], minLessons: value },
    }));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const body: Record<
        string,
        { minLessons?: number; imageUrl?: string | null }
      > = {};
      for (const lvl of levels) {
        const draft = drafts[lvl.level];
        if (!draft) continue;
        const entry: { minLessons?: number; imageUrl?: string | null } = {};
        const n = Number(draft.minLessons);
        if (Number.isFinite(n) && n > 0 && n !== lvl.minLessons) {
          entry.minLessons = n;
        }
        if (draft.imageUrl !== null) {
          // null = unchanged. '' = clear. data-url = new image.
          entry.imageUrl = draft.imageUrl === '' ? null : draft.imageUrl;
        }
        if (entry.minLessons !== undefined || entry.imageUrl !== undefined) {
          body[lvl.level] = entry;
        }
      }
      if (Object.keys(body).length === 0) {
        toast.info("O'zgarish topilmadi");
        setSaving(false);
        return;
      }
      const res = await apiRequest<CertLevel[]>(
        '/gamification/certificate-levels',
        { method: 'PUT', body: JSON.stringify(body) },
        getToken(),
      );
      const sorted = [...(res.data ?? [])].sort(
        (a, b) => a.minLessons - b.minLessons,
      );
      setLevels(sorted);
      const next: Record<string, Draft> = {};
      for (const l of sorted) {
        next[l.level] = {
          minLessons: String(l.minLessons),
          imageUrl: null,
          imagePreview: l.imageUrl,
        };
      }
      setDrafts(next);
      toast.success("Sertifikat sozlamalari saqlandi");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Saqlashda xatolik',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/20 flex items-center justify-center">
              <Award size={18} className="text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Superadmin</p>
              <p className="text-white font-bold text-lg">Sertifikat dizayni</p>
            </div>
          </div>
          <button
            type="button"
            onClick={saveAll}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold px-4 py-2 rounded-xl border border-white/20 transition-colors disabled:opacity-60"
          >
            {saving ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {saving ? 'Saqlanmoqda…' : 'Saqlash'}
          </button>
        </div>
      </div>

      <div className="p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {levels.map((lvl) => {
          const draft = drafts[lvl.level];
          if (!draft) return null;
          return (
            <article
              key={lvl.level}
              className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5 flex flex-col gap-4"
            >
              {/* Title */}
              <div className="flex items-center gap-3">
                <span className="text-3xl">{lvl.emoji}</span>
                <div>
                  <h2 className="font-extrabold text-[#0f172a] text-base">
                    {lvl.label}
                  </h2>
                  <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#94a3b8]">
                    {lvl.level}
                  </p>
                </div>
              </div>

              {/* Image preview / dropzone */}
              <div className="relative">
                {draft.imagePreview ? (
                  <div className="group relative aspect-[1.41] w-full rounded-xl overflow-hidden border border-[#ede9e1] bg-[#f7f4ef]">
                    {/* Preview */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.imagePreview}
                      alt={`${lvl.label} sertifikat shabloni`}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-[#0f172a]/0 group-hover:bg-[#0f172a]/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => fileInputs.current[lvl.level]?.click()}
                        className="inline-flex items-center gap-2 bg-white text-[#0f172a] px-3 py-2 rounded-lg text-xs font-bold shadow-md"
                      >
                        <Upload size={14} />
                        O&apos;zgartirish
                      </button>
                      <button
                        type="button"
                        onClick={() => clearImage(lvl.level)}
                        className="inline-flex items-center gap-2 bg-white text-rose-600 px-3 py-2 rounded-lg text-xs font-bold shadow-md"
                      >
                        <Trash2 size={14} />
                        O&apos;chirish
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputs.current[lvl.level]?.click()}
                    className="aspect-[1.41] w-full rounded-xl border-2 border-dashed border-[#cbd5e1] bg-[#f7f4ef] hover:border-[#0f172a] hover:bg-[#fffaf0] transition-colors flex flex-col items-center justify-center gap-2 text-[#64748b]"
                  >
                    <Upload size={28} strokeWidth={1.75} />
                    <span className="text-sm font-bold">
                      Sertifikat shaklini yuklang
                    </span>
                    <span className="text-[11px]">
                      PNG, JPG yoki WebP · 1 MB gacha
                    </span>
                  </button>
                )}
                <input
                  ref={(el) => {
                    fileInputs.current[lvl.level] = el;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(lvl.level, f);
                  }}
                />
              </div>

              {/* Step trigger */}
              <div>
                <label
                  htmlFor={`step-${lvl.level}`}
                  className="block text-[11px] font-extrabold text-[#64748b] uppercase tracking-[0.18em] mb-1.5"
                >
                  Nechinchi darsdan keyin beriladi
                </label>
                <div className="relative">
                  <input
                    id={`step-${lvl.level}`}
                    type="number"
                    min={1}
                    max={9999}
                    value={draft.minLessons}
                    onChange={(e) => setStep(lvl.level, e.target.value)}
                    className="w-full bg-[#f7f4ef] border-[1.5px] border-[#cbd5e1] rounded-xl px-4 py-3 pr-16 text-base font-extrabold text-[#0f172a] focus:outline-none focus:border-[#0f172a] focus:ring-2 focus:ring-[#0f172a]/15"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94a3b8]">
                    dars
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-[#94a3b8]">
                  Hozir: <strong>{lvl.minLessons}</strong> ta dars
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 p-4 bg-[#fffaf0] rounded-xl border border-[#fbbf24]/35">
        <p className="text-xs text-[#64748b] leading-relaxed">
          💡 <strong>Eslatma:</strong> Yangi rasm yoki dars soni o&apos;zgartirilgandan
          so&apos;ng <strong>Saqlash</strong> tugmasini bosing.
          Allaqachon sertifikat olgan o&apos;quvchilar bekor bo&apos;lmaydi —
          yangi sozlama keyingi darslarni tugatuvchilarga tatbiq etiladi.
        </p>
      </div>
      </div>
    </div>
  );
}
