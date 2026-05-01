'use client';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Lightbulb, Sparkles, Loader2 } from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import {
  gradeTranslation,
  explainAnswer,
  type ExplainAnswerResponse,
} from '@/lib/exercises';
import { XpFloater } from './XpFloater';
import type { TranslateConfig } from './exercise-types';

interface TranslateInputProps {
  config: TranslateConfig;
  onPassed: () => void;
  onFailed: () => void;
}

type Phase = 'idle' | 'checking' | 'correct' | 'wrong';

const MAX_CHARS = 200;
const PASS_THRESHOLD = 70;

/**
 * Pass 2 — Duolingo-grade typing translation:
 *   - Uzbek prompt → student types English (or vice versa) into a textarea.
 *   - Submission grades through `/ai/grade-translation`. If the AI reports
 *     `score >= 70` we treat the answer as correct; otherwise wrong.
 *   - On API failure we silently fall back to a strict case-insensitive
 *     compare against `correctAnswer` + `acceptedAnswers` so the lesson never
 *     blocks on a transient backend hiccup.
 *   - Correct: green flash, chime, +10 XP floater, auto-advance.
 *   - Wrong: shake, buzz, banner with the canonical answer + accepted list,
 *     plus a "Tushuntirish" button (preview of feature M) that fetches a
 *     kid-friendly explanation from `/ai/explain-answer` on demand.
 */
export function TranslateInput({ config, onPassed, onFailed }: TranslateInputProps) {
  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [feedback, setFeedback] = useState<string>('');
  const [acceptedFromApi, setAcceptedFromApi] = useState<string[] | null>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);
  const [shake, setShake] = useState(false);

  // Tushuntirish (explain) — feature M preview. Loaded lazily on demand;
  // a single inline card shows the explanation, hint and examples.
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainData, setExplainData] = useState<ExplainAnswerResponse | null>(null);
  const [explainError, setExplainError] = useState('');

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-focus on mount so the student can start typing immediately.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const targetLanguage = config.targetLanguage ?? 'en';
  const sourceText = config.sourceText ?? '';
  const correctAnswer = config.correctAnswer ?? '';
  const acceptedAnswers = config.acceptedAnswers ?? [];

  // Defensive empty-state — server data may be partial during early authoring.
  if (!sourceText || !correctAnswer) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
        <p
          className="text-[#3c3c3c] font-extrabold text-base"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Tarjima topshirig&apos;i topilmadi
        </p>
        <p className="text-[#777] text-sm font-semibold">
          Bu darsda hali tarjima sozlanmagan.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  const trimmed = answer.trim();
  const canSubmit = trimmed.length >= 2 && phase === 'idle';

  function strictMatch(student: string): boolean {
    const norm = student.trim().toLowerCase();
    if (!norm) return false;
    if (norm === correctAnswer.trim().toLowerCase()) return true;
    return acceptedAnswers.some((a) => a.trim().toLowerCase() === norm);
  }

  async function handleCheck() {
    if (!canSubmit) return;
    setPhase('checking');
    setFeedback('');
    setAcceptedFromApi(null);

    const token =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('accessToken') ?? '')
        : '';

    let correct = false;
    let nextFeedback = '';
    try {
      const result = await gradeTranslation(
        {
          sourceText,
          targetLanguage,
          studentAnswer: trimmed,
        },
        token,
      );
      // Treat the AI as the source of truth, but require a meaningful score
      // so a low-confidence "yes" doesn't sneak through.
      correct = result.correct && result.score >= PASS_THRESHOLD;
      nextFeedback = result.feedback ?? '';
      if (result.accepted_answers?.length) setAcceptedFromApi(result.accepted_answers);
    } catch {
      // Network / 5xx — fall back to strict match. The student is never
      // punished for an API outage: if they typed the canonical answer
      // exactly, it still counts.
      correct = strictMatch(trimmed);
      nextFeedback = correct
        ? "Ajoyib — to'g'ri javob!"
        : `To'g'ri javob: ${correctAnswer}`;
    }

    setFeedback(nextFeedback);
    if (correct) {
      setPhase('correct');
      playSound('correct');
      setShowFloater(true);
      setFloaterKey((k) => k + 1);
      // Auto-advance after the celebration animation.
      setTimeout(() => onPassed(), 1500);
    } else {
      setPhase('wrong');
      playSound('wrong');
      setShake(true);
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(120);
        }
      } catch {
        /* ignore */
      }
    }
  }

  async function handleExplain() {
    if (explainLoading || explainData) return;
    setExplainLoading(true);
    setExplainError('');
    const token =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('accessToken') ?? '')
        : '';
    try {
      const data = await explainAnswer(
        {
          exerciseType: 'translate',
          question: sourceText,
          studentAnswer: trimmed,
          correctAnswer,
        },
        token,
      );
      setExplainData(data);
    } catch {
      setExplainError("Tushuntirishni olishda xato. Keyinroq urinib ko'ring.");
    } finally {
      setExplainLoading(false);
    }
  }

  const isCorrect = phase === 'correct';
  const isWrong = phase === 'wrong';
  const isChecking = phase === 'checking';

  const inputBorder = isCorrect
    ? 'border-[#10b981] bg-[#dcfce7]'
    : isWrong
      ? 'border-[#ef4444] bg-[#fee2e2]'
      : 'border-[#e8e0d0] bg-white focus-within:border-[#58cc02]';

  const allAccepted = [
    ...new Set(
      [correctAnswer, ...(acceptedAnswers ?? []), ...(acceptedFromApi ?? [])].map((a) =>
        a.trim(),
      ),
    ),
  ].filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Header — eyebrow + Aloqush */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Mascot expression={isCorrect ? 'happy' : isWrong ? 'sad' : 'idle'} size={48} animated />
        </div>
        <div>
          <p
            className="text-[11px] font-extrabold text-[#7a5e2c] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {targetLanguage === 'en'
              ? "Bu jumlani inglizchaga tarjima qiling"
              : "Bu jumlani o'zbekchaga tarjima qiling"}
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            {targetLanguage === 'en' ? 'O\'zbekcha → English' : 'English → O\'zbekcha'}
          </p>
        </div>
      </div>

      {/* Source sentence card */}
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] px-4 py-6">
        <p
          className="text-3xl font-extrabold text-[#3c3c3c] text-center leading-tight"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {sourceText}
        </p>
      </div>

      {/* Answer textarea — shake on wrong, green tint on correct */}
      <div className="relative">
        <div
          className={`rounded-2xl border-2 border-b-[4px] transition-colors duration-200 ${inputBorder} ${
            shake ? 'motion-safe:[animation:shake_0.4s_ease-in-out]' : ''
          }`}
          onAnimationEnd={() => setShake(false)}
        >
          <textarea
            ref={inputRef}
            rows={3}
            maxLength={MAX_CHARS}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              // Submit with Cmd/Ctrl+Enter for keyboard-first users.
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
                e.preventDefault();
                void handleCheck();
              }
            }}
            disabled={phase !== 'idle'}
            placeholder={
              targetLanguage === 'en' ? 'Inglizchada yozing...' : "O'zbekchada yozing..."
            }
            aria-label="Tarjima javobi"
            className="w-full bg-transparent rounded-2xl p-4 text-lg font-bold text-[#3c3c3c] outline-none resize-none placeholder:text-[#cbbf9c] disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          />
          <div className="flex justify-between items-center px-4 pb-2 text-[11px] font-bold text-[#999]">
            <span>{targetLanguage === 'en' ? 'EN' : 'UZ'}</span>
            <span>
              {answer.length} / {MAX_CHARS}
            </span>
          </div>
        </div>

        {/* +10 XP floater on correct */}
        {showFloater && (
          <div className="absolute right-3 -top-3 pointer-events-none">
            <XpFloater
              key={floaterKey}
              amount={10}
              onDone={() => setShowFloater(false)}
            />
          </div>
        )}
      </div>

      {/* Hint chip — collapsed by default */}
      {config.hint && (
        <button
          type="button"
          onClick={() => setHintOpen((o) => !o)}
          className="text-xs font-extrabold text-[#7a5e2c] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fef3c7] border border-[#fde68a] hover:bg-[#fde68a] transition-colors"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          <Lightbulb size={14} className="text-[#d97706]" />
          {hintOpen ? "Maslahatni yashirish" : "💡 Maslahat"}
        </button>
      )}
      {hintOpen && config.hint && (
        <div className="bg-[#fffbeb] border-[1.5px] border-[#fde68a] rounded-2xl px-4 py-3">
          <p
            className="text-sm font-semibold text-[#78350f] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {config.hint}
          </p>
        </div>
      )}

      {/* Correct banner */}
      {isCorrect && (
        <div className="bg-[#dcfce7] border-[1.5px] border-[#bbf7d0] rounded-2xl px-4 py-3 flex items-start gap-2">
          <CheckCircle2 size={18} className="text-[#10b981] shrink-0 mt-0.5" />
          <p
            className="text-sm font-extrabold text-[#065f46] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {feedback || 'Ajoyib! +10 XP'}
          </p>
        </div>
      )}

      {/* Wrong banner — feedback + canonical answer + accepted list */}
      {isWrong && (
        <div className="space-y-3">
          <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl px-4 py-3 flex items-start gap-2">
            <XCircle size={18} className="text-[#ef4444] shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p
                className="text-sm font-extrabold text-[#991b1b] leading-snug"
                style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
              >
                {feedback || `To'g'ri javob: ${correctAnswer}`}
              </p>
              {allAccepted.length > 1 && (
                <p
                  className="text-[11px] font-bold text-[#7a1d1d] leading-snug"
                  style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                >
                  Qabul qilinadigan: {allAccepted.slice(0, 4).join(' · ')}
                </p>
              )}
            </div>
          </div>

          {/* Tushuntirish (M preview) — opens an inline expandable card. */}
          <div className="space-y-2">
            {!explainData && (
              <button
                type="button"
                onClick={handleExplain}
                disabled={explainLoading}
                className="text-xs font-extrabold text-white bg-[#1cb0f6] border-b-[3px] border-[#0e8cc4] rounded-2xl px-4 py-2 inline-flex items-center gap-1.5 active:translate-y-[1px] active:border-b-[1px] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
              >
                {explainLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                {explainLoading ? 'Tushuntirilmoqda...' : 'Tushuntirish'}
              </button>
            )}
            {explainError && (
              <p className="text-[11px] font-bold text-[#991b1b]">{explainError}</p>
            )}
            {explainData && (
              <div className="bg-[#eff6ff] border-[1.5px] border-[#bfdbfe] rounded-2xl px-4 py-3 space-y-2">
                <p
                  className="text-sm font-extrabold text-[#1e3a8a] leading-snug"
                  style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                >
                  {explainData.explanation}
                </p>
                {explainData.hint && (
                  <p className="text-xs font-semibold text-[#1e40af] leading-snug">
                    💡 {explainData.hint}
                  </p>
                )}
                {explainData.examples && explainData.examples.length > 0 && (
                  <ul className="text-xs font-semibold text-[#1e40af] space-y-1 pl-1">
                    {explainData.examples.slice(0, 3).map((ex, i) => (
                      <li key={i} className="leading-snug">
                        • {ex}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <Button
              variant="duo"
              size="lg"
              fullWidth
              className="!bg-[#ef4444] !border-[#b91c1c]"
              onClick={onFailed}
            >
              Davom etish
            </Button>
          </div>
        </div>
      )}

      {/* TEKSHIRISH CTA */}
      {!isWrong && !isCorrect && (
        <Button
          variant="duo"
          size="lg"
          fullWidth
          loading={isChecking}
          disabled={!canSubmit || isChecking}
          onClick={handleCheck}
        >
          {isChecking ? 'TEKSHIRILMOQDA...' : 'TEKSHIRISH'}
        </Button>
      )}
    </div>
  );
}

export default TranslateInput;
