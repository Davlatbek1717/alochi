'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Copy, Languages, Loader2, Volume2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getSpeechCapabilities, speak, stopSpeaking } from '@/lib/speech';
import { useToast } from '@/components/ui';

type Lang = 'uz' | 'en';

const LANG_LABEL: Record<Lang, string> = {
  uz: "O'zbek",
  en: 'Ingliz',
};

const MAX_CHARS = 2000;

/**
 * Student translator tool — paste Uzbek or English, get the other side.
 *
 * - Direction is a single uz↔en toggle (no manual lang select on each side).
 * - Submits on Enter (Shift+Enter for newline) and via the button.
 * - Live char counter + 2000-char cap (mirrors the backend DTO limit).
 * - "Play" button uses browser SpeechSynthesis when available (Chrome/Edge).
 * - Copy-to-clipboard for the translation.
 */
export default function StudentTranslatePage() {
  const toast = useToast();
  const [fromLang, setFromLang] = useState<Lang>('uz');
  const [source, setSource] = useState('');
  const [translation, setTranslation] = useState('');
  const [note, setNote] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const toLang: Lang = fromLang === 'uz' ? 'en' : 'uz';

  useEffect(() => {
    setTtsAvailable(getSpeechCapabilities().tts);
    return () => stopSpeaking();
  }, []);

  function swap() {
    // Swap direction + move the translated text to the source slot so the
    // student can chain "translate → tweak → translate back" naturally.
    setFromLang(toLang);
    setSource(translation);
    setTranslation(source);
    setNote(undefined);
  }

  async function handleTranslate() {
    const trimmed = source.trim();
    if (!trimmed || submitting) return;
    if (trimmed.length > MAX_CHARS) {
      toast.error(`Matn ${MAX_CHARS} belgidan oshmasligi kerak`);
      return;
    }
    setSubmitting(true);
    setTranslation('');
    setNote(undefined);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const res = await apiRequest<{ translation: string; note?: string }>(
        '/ai/translate-text',
        {
          method: 'POST',
          body: JSON.stringify({ text: trimmed, fromLang, toLang }),
          signal: ctrl.signal,
        },
        token,
      );
      setTranslation(res.data.translation || '');
      setNote(res.data.note);
      if (!res.data.translation) {
        toast.error('Tarjima qilinmadi, qaytadan urinib koʻring');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      toast.error(err instanceof Error ? err.message : 'Xato yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  function copyTranslation() {
    if (!translation) return;
    try {
      navigator.clipboard.writeText(translation);
      toast.success('Nusxalandi');
    } catch {
      toast.error("Nusxalashda xatolik");
    }
  }

  function speakTranslation() {
    if (!translation) return;
    if (!ttsAvailable) {
      toast.error('Audio chiqarish brauzeringizda yoq');
      return;
    }
    void speak(translation, {
      lang: toLang === 'en' ? 'en-US' : 'uz-UZ',
      rate: 0.95,
    }).catch(() => {
      toast.error('Audio chiqarishda xatolik');
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !submitting) {
      e.preventDefault();
      void handleTranslate();
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #58cc02 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#58cc02]/20 border border-[#58cc02]/30 flex items-center justify-center shrink-0">
            <Languages size={20} className="text-[#58cc02]" />
          </div>
          <div className="min-w-0">
            <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">
              AI tarjimon
            </p>
            <p className="text-white text-lg font-bold">Tarjima</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-24 space-y-3 max-w-2xl mx-auto">
        {/* Direction toggle */}
        <div className="flex items-center justify-center gap-3 bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-4 py-3">
          <span className="text-sm font-extrabold text-[#0f172a] flex-1 text-center">
            {LANG_LABEL[fromLang]}
          </span>
          <button
            type="button"
            onClick={swap}
            aria-label="Tilni almashtirish"
            className="w-10 h-10 rounded-xl bg-[#f7f4ef] border border-[#ede9e1] hover:bg-[#ede9e1] flex items-center justify-center transition-colors shrink-0"
          >
            <ArrowLeftRight size={16} className="text-[#0f172a]" />
          </button>
          <span className="text-sm font-extrabold text-[#0f172a] flex-1 text-center">
            {LANG_LABEL[toLang]}
          </span>
        </div>

        {/* Source */}
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
              {LANG_LABEL[fromLang]} ({fromLang})
            </p>
            <p
              className={[
                'text-[10px] font-mono font-bold',
                source.length > MAX_CHARS * 0.9
                  ? 'text-amber-600'
                  : 'text-[#94a3b8]',
              ].join(' ')}
            >
              {source.length}/{MAX_CHARS}
            </p>
          </div>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={onKeyDown}
            rows={4}
            placeholder={
              fromLang === 'uz'
                ? "Tarjima qilmoqchi bo'lgan matnni shu yerga yozing..."
                : 'Type the text you want to translate...'
            }
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#58cc02] resize-none"
          />
        </div>

        <button
          type="button"
          onClick={() => void handleTranslate()}
          disabled={!source.trim() || submitting}
          className="w-full bg-[#58cc02] hover:brightness-105 text-white font-extrabold uppercase tracking-wide text-sm py-3.5 min-h-[52px] rounded-2xl border-b-[4px] border-[#46a302] active:translate-y-[2px] active:border-b-[2px] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Tarjima qilinmoqda...
            </>
          ) : (
            'Tarjima qilish'
          )}
        </button>

        {/* Translation */}
        <div
          className={[
            'rounded-2xl border-[1.5px] p-4',
            translation
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-white border-[#ede9e1]',
          ].join(' ')}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
              {LANG_LABEL[toLang]} ({toLang})
            </p>
            {translation && (
              <div className="flex items-center gap-1">
                {ttsAvailable && (
                  <button
                    type="button"
                    onClick={speakTranslation}
                    aria-label="Audio o'qish"
                    className="w-9 h-9 rounded-xl bg-white border border-[#ede9e1] hover:bg-violet-50 hover:border-violet-200 flex items-center justify-center transition-colors"
                  >
                    <Volume2 size={14} className="text-[#0f172a]" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={copyTranslation}
                  aria-label="Nusxalash"
                  className="w-9 h-9 rounded-xl bg-white border border-[#ede9e1] hover:bg-violet-50 hover:border-violet-200 flex items-center justify-center transition-colors"
                >
                  <Copy size={14} className="text-[#0f172a]" />
                </button>
              </div>
            )}
          </div>
          {translation ? (
            <p className="text-sm text-[#0f172a] leading-relaxed whitespace-pre-wrap">
              {translation}
            </p>
          ) : (
            <p className="text-sm text-[#94a3b8] italic">
              Tarjima shu yerda paydo boʻladi.
            </p>
          )}
          {note && (
            <p className="text-xs text-[#0f172a]/70 mt-3 italic border-t border-emerald-200 pt-2">
              💡 {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
