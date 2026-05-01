'use client';
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { explainAnswer, type ExplainAnswerResponse } from '@/lib/exercises';

/**
 * Pass 5 (Feature M) — Universal "Tushuntirib bering" panel.
 *
 * A single reusable component used across the 11 exercise types that have a
 * meaningful "wrong" state. On first tap it lazy-fetches `/ai/explain-answer`
 * and shows a kid-friendly Uzbek explanation card. The result is cached on
 * the instance, so re-opening (e.g. after the student reads it, closes the
 * accordion, then taps again) is instant — and a re-mount is only triggered
 * by the runner when the next exercise loads.
 *
 * Visual style: yellow-amber accent, matching the gold tier badges used
 * elsewhere in the student UI. The expanded card uses a white surface with
 * a soft yellow rule on the hint, and a dotted-line list for examples.
 *
 * Each component decides what `question`, `studentAnswer` and `correctAnswer`
 * mean in its context (e.g. SpeakSentence sends "audio recording" as the
 * student answer because there's no typed text). The AI grader uses
 * `exerciseType` to tailor its tips.
 */
interface ExplainPanelProps {
  exerciseType:
    | 'mcq'
    | 'word_order'
    | 'translate'
    | 'fill_blank'
    | 'order_sentences'
    | 'listen_pick'
    | 'listen_type'
    | 'spelling'
    | 'match_pairs'
    | 'pick_picture'
    | 'speak_sentence';
  /** The prompt shown to the student. */
  question: string;
  /** Whatever the student submitted (text, label, or "audio recording"). */
  studentAnswer: string;
  /** The canonical correct answer the AI should explain. */
  correctAnswer: string;
  /** Optional surrounding context (lesson title, etc.) for nuance. */
  context?: string;
}

export function ExplainPanel({
  exerciseType,
  question,
  studentAnswer,
  correctAnswer,
  context,
}: ExplainPanelProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ExplainAnswerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchExplanation() {
    // If already loaded, just toggle open. If currently loading, ignore the
    // tap so a frantic student double-tap doesn't fire two requests.
    if (data) {
      setOpen(true);
      return;
    }
    if (loading) return;
    setLoading(true);
    setError('');
    setOpen(true);
    try {
      const token =
        typeof window !== 'undefined'
          ? (window.localStorage.getItem('accessToken') ?? '')
          : '';
      const res = await explainAnswer(
        { exerciseType, question, studentAnswer, correctAnswer, context },
        token,
      );
      setData(res);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Tushuntirib bo'lmadi. Keyinroq urinib ko'ring.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {!open && (
        <button
          type="button"
          onClick={fetchExplanation}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-[#fef3c7] hover:bg-[#fde68a] disabled:opacity-60 disabled:cursor-not-allowed text-[#a16207] font-extrabold text-xs border-2 border-b-[3px] border-[#fbbf24] active:translate-y-[1px] active:border-b-2 transition-all"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          Tushuntirib bering
        </button>
      )}
      {open && (
        <div className="bg-white rounded-2xl border-[1.5px] border-[#e8e0d0] p-4 motion-safe:[animation:pop_400ms_ease-out]">
          {loading ? (
            <div className="flex items-center gap-2 text-[#7a5e2c] text-sm font-bold">
              <Sparkles size={14} className="animate-pulse text-[#d97706]" />
              Tushuntirilyapti...
            </div>
          ) : error ? (
            <p className="text-[#991b1b] text-sm font-bold">{error}</p>
          ) : data ? (
            <div className="space-y-3">
              <p
                className="text-[#3c3c3c] font-extrabold text-sm leading-snug"
                style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
              >
                {data.explanation}
              </p>
              {data.hint && (
                <div className="bg-[#fffaf0] rounded-xl p-3 border-l-4 border-[#fbbf24]">
                  <p className="text-[10px] font-extrabold text-[#a16207] uppercase tracking-wider mb-1">
                    Maslahat
                  </p>
                  <p className="text-[#3c3c3c] text-xs font-bold leading-snug">
                    {data.hint}
                  </p>
                </div>
              )}
              {data.examples && data.examples.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-extrabold text-[#777] uppercase tracking-wider">
                    Misollar
                  </p>
                  {data.examples.slice(0, 3).map((ex, i) => (
                    <p
                      key={i}
                      className="text-xs font-bold text-[#3c3c3c] pl-3 border-l-2 border-[#e8e0d0] leading-snug"
                    >
                      {ex}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default ExplainPanel;
