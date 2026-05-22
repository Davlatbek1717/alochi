'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, Copy, Loader2, Volume2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getSpeechCapabilities, speak, stopSpeaking } from '@/lib/speech';
import { useToast } from '@/components/ui';

type Lang = 'uz' | 'en';

const LANG_LABEL: Record<Lang, string> = {
  uz: "🇺🇿 O'zbek",
  en: '🇬🇧 English',
};

const MAX_CHARS = 2000;

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
        toast.error(
          'Tarjima qilinmadi. AI band — bir necha soniyadan soʻng qayta urinib koʻring.',
        );
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
      toast.error('Nusxalashda xatolik');
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
    <div className="sp-theme min-h-full pb-24">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 max-w-2xl mx-auto">
        <Link
          href="/student"
          aria-label="Orqaga"
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'var(--bone-2)', border: '1.5px solid var(--line)', color: 'var(--ink)' }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="sp-eyebrow">AI tarjimon</div>
          <h1 className="sp-display text-xl leading-tight" style={{ color: 'var(--ink)' }}>
            Tarjima
          </h1>
        </div>
      </header>

      <div className="px-4 max-w-2xl mx-auto space-y-3">
        {/* Direction toggle */}
        <div
          className="flex items-center gap-2 p-1"
          style={{
            background: 'var(--bone-2)',
            border: '1.5px solid var(--line)',
            borderRadius: 999,
          }}
        >
          <span
            className="flex-1 text-center py-2 sp-display text-[13px]"
            style={{
              background: 'var(--leaf)',
              color: 'var(--bone)',
              borderRadius: 999,
            }}
          >
            {LANG_LABEL[fromLang]}
          </span>
          <button
            type="button"
            onClick={swap}
            aria-label="Tilni almashtirish"
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'var(--bone)', border: '1.5px solid var(--line-2)', color: 'var(--ink)' }}
          >
            <ArrowLeftRight size={15} />
          </button>
          <span
            className="flex-1 text-center py-2 sp-display text-[13px]"
            style={{ color: 'var(--ink-2)' }}
          >
            {LANG_LABEL[toLang]}
          </span>
        </div>

        {/* Source */}
        <div className="relative">
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value.slice(0, MAX_CHARS))}
            onKeyDown={onKeyDown}
            rows={5}
            placeholder="matnni yozing yoki yopishtiring…"
            className="w-full p-3.5 text-[15px] resize-none outline-none"
            style={{
              background: 'var(--bone-2)',
              border: '2px solid var(--line-2)',
              borderRadius: 'var(--r-3)',
              color: 'var(--ink)',
              fontFamily: 'var(--f-ui)',
            }}
          />
          <span
            className="sp-mono absolute bottom-3 right-3 text-[10px]"
            style={{ color: source.length > MAX_CHARS * 0.9 ? 'var(--ember-deep)' : 'var(--ink-4)' }}
          >
            {source.length}/{MAX_CHARS}
          </span>
        </div>

        <button
          type="button"
          onClick={() => void handleTranslate()}
          disabled={!source.trim() || submitting}
          className="sp-display w-full py-3.5 min-h-[52px] flex items-center justify-center gap-2 active:translate-y-[2px] transition-transform disabled:opacity-50"
          style={{
            background: 'var(--leaf)',
            color: 'var(--bone)',
            border: '2px solid var(--leaf-deep)',
            borderRadius: 'var(--r-3)',
            boxShadow: '0 4px 0 var(--leaf-deep)',
            fontWeight: 700,
          }}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Tarjima qilinmoqda…
            </>
          ) : (
            'Tarjima qilish'
          )}
        </button>

        {/* Result */}
        <div
          className="p-4"
          style={{
            background: translation ? 'var(--leaf-tint)' : 'var(--bone)',
            border: `1.5px solid ${translation ? 'var(--leaf-soft)' : 'var(--line)'}`,
            borderRadius: 'var(--r-3)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="sp-eyebrow" style={{ color: 'var(--leaf-deep)' }}>
              tarjima
            </div>
            {translation && (
              <div className="flex items-center gap-1">
                {ttsAvailable && (
                  <button
                    type="button"
                    onClick={speakTranslation}
                    aria-label="Talaffuz"
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--bone)', border: '1px solid var(--leaf-soft)', color: 'var(--leaf-deep)' }}
                  >
                    <Volume2 size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={copyTranslation}
                  aria-label="Nusxalash"
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'var(--bone)', border: '1px solid var(--leaf-soft)', color: 'var(--leaf-deep)' }}
                >
                  <Copy size={14} />
                </button>
              </div>
            )}
          </div>
          {translation ? (
            <p
              className="sp-display text-lg whitespace-pre-wrap"
              style={{ color: 'var(--leaf-deep)' }}
            >
              {translation}
            </p>
          ) : (
            <p className="text-sm italic" style={{ color: 'var(--ink-4)' }}>
              Tarjima shu yerda paydo boʻladi.
            </p>
          )}
          {note && (
            <p
              className="text-xs mt-3 italic pt-2"
              style={{ color: 'var(--ink-2)', borderTop: '1px solid var(--leaf-soft)' }}
            >
              💡 {note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
