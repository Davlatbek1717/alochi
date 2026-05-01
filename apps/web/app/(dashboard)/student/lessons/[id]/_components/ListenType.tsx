'use client';
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { getTtsAudio, gradeTranslation } from '@/lib/exercises';
import { XpFloater } from './XpFloater';
import { ExplainPanel } from './ExplainPanel';
import type { ListenTypeConfig } from './exercise-types';

interface ListenTypeProps {
  config: ListenTypeConfig;
  onPassed: () => void;
  onFailed: () => void;
}

type Phase = 'idle' | 'checking' | 'correct' | 'wrong';
type AudioState = 'idle' | 'loading' | 'playing' | 'error';

const MAX_CHARS = 200;
const PASS_THRESHOLD = 70;

/**
 * Pass 3 (C) — Listen & Type:
 *   - Big play-audio button (auto-plays once on mount, replays on tap).
 *   - Textarea where the student types what they heard. Auto-focused after
 *     the first audio playback finishes so they can dive straight in.
 *   - Two-stage grading:
 *     1. Strict client-side check vs `config.text` (case-insensitive trim)
 *        AND any `acceptedAnswers`. This handles the common case fast and
 *        works offline.
 *     2. If strict fails, call `/ai/grade-translation` for fuzzy/typo
 *        forgiveness. We treat `score >= 70` as correct.
 *   - Wrong: shake, buzz, banner with the canonical text + a "Tushuntirish"
 *     button that lazy-loads `/ai/explain-answer`.
 *   - Network failures during the AI grade silently fall back to the strict
 *     verdict so a transient backend hiccup never blocks the lesson.
 */
export function ListenType({ config, onPassed, onFailed }: ListenTypeProps) {
  const text = config?.text ?? '';
  const acceptedAnswers = config?.acceptedAnswers ?? [];
  const context = config?.context ?? 'listening dictation';

  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [audioErrorVisible, setAudioErrorVisible] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);

  const [answer, setAnswer] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [feedback, setFeedback] = useState('');
  const [shake, setShake] = useState(false);
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const autoplayedRef = useRef(false);
  const focusedAfterPlayRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const a = audioElementRef.current;
      if (a) {
        try {
          a.pause();
        } catch {
          /* ignore */
        }
        a.onplay = null;
        a.onended = null;
        a.onerror = null;
        audioElementRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!text || autoplayedRef.current) return;
    autoplayedRef.current = true;
    const t = setTimeout(() => {
      void playAudio();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // After the first playback ends, focus the textarea so the student can
  // start typing immediately. We only do this once.
  useEffect(() => {
    if (audioState === 'idle' && hasPlayedOnce && !focusedAfterPlayRef.current) {
      focusedAfterPlayRef.current = true;
      inputRef.current?.focus();
    }
  }, [audioState, hasPlayedOnce]);

  async function playAudio() {
    if (audioState === 'loading') return;
    if (audioElementRef.current) {
      try {
        audioElementRef.current.currentTime = 0;
        await audioElementRef.current.play();
      } catch {
        /* ignore */
      }
      return;
    }
    setAudioState('loading');
    const token =
      typeof window !== 'undefined'
        ? (window.localStorage.getItem('accessToken') ?? '')
        : '';
    try {
      const res = await getTtsAudio(text, 'en', token);
      if (!res?.audioBase64) {
        if (mountedRef.current) {
          setAudioState('error');
          setAudioErrorVisible(true);
        }
        return;
      }
      const audio = new Audio(`data:${res.mimeType};base64,${res.audioBase64}`);
      audio.onplay = () => {
        if (mountedRef.current) setAudioState('playing');
      };
      audio.onended = () => {
        if (mountedRef.current) {
          setAudioState('idle');
          setHasPlayedOnce(true);
        }
      };
      audio.onerror = () => {
        if (mountedRef.current) {
          setAudioState('error');
          setAudioErrorVisible(true);
        }
      };
      audioElementRef.current = audio;
      await audio.play();
    } catch {
      if (mountedRef.current) {
        setAudioState('error');
        setAudioErrorVisible(true);
      }
    }
  }

  if (!text) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
        <AlertTriangle size={28} className="text-[#fbbf24] mx-auto" />
        <p
          className="text-[#3c3c3c] font-extrabold text-base"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Bu mashq sozlanmagan
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  const trimmed = answer.trim();
  const canSubmit = trimmed.length >= 1 && phase === 'idle';

  function strictMatch(value: string): boolean {
    const norm = value.trim().toLowerCase();
    if (!norm) return false;
    if (norm === text.trim().toLowerCase()) return true;
    return acceptedAnswers.some((a) => a.trim().toLowerCase() === norm);
  }

  async function handleCheck() {
    if (!canSubmit) return;
    // Pause any audio playback while we grade so the student can read the
    // result without competing audio.
    try {
      audioElementRef.current?.pause();
    } catch {
      /* ignore */
    }
    setPhase('checking');
    setFeedback('');

    let correct = strictMatch(trimmed);
    let nextFeedback = correct ? "Ajoyib — to'g'ri javob!" : '';

    if (!correct) {
      const token =
        typeof window !== 'undefined'
          ? (window.localStorage.getItem('accessToken') ?? '')
          : '';
      try {
        const result = await gradeTranslation(
          {
            sourceText: text,
            targetLanguage: 'en',
            studentAnswer: trimmed,
            context,
          },
          token,
        );
        correct = result.correct && result.score >= PASS_THRESHOLD;
        nextFeedback =
          result.feedback ||
          (correct ? "Ajoyib — yaqin variant!" : `To'g'ri javob: ${text}`);
      } catch {
        // Network outage — keep the strict verdict.
        nextFeedback = `To'g'ri javob: ${text}`;
      }
    }

    setFeedback(nextFeedback);
    if (correct) {
      setPhase('correct');
      playSound('correct');
      setShowFloater(true);
      setFloaterKey((k) => k + 1);
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

  const isCorrect = phase === 'correct';
  const isWrong = phase === 'wrong';
  const isChecking = phase === 'checking';
  const isPlaying = audioState === 'playing';
  const isLoading = audioState === 'loading';

  const inputBorder = isCorrect
    ? 'border-[#10b981] bg-[#dcfce7]'
    : isWrong
      ? 'border-[#ef4444] bg-[#fee2e2]'
      : 'border-[#e8e0d0] bg-white focus-within:border-[#58cc02]';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <Mascot
            expression={isCorrect ? 'happy' : isWrong ? 'sad' : 'idle'}
            size={48}
            animated
          />
        </div>
        <div>
          <p
            className="text-[11px] font-extrabold text-[#7a5e2c] uppercase tracking-wider"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Eshitganingizni yozing
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            Ovozni tinglang va aniq yozing
          </p>
        </div>
      </div>

      {/* Big circular play button */}
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="relative w-24 h-24 flex items-center justify-center">
          {isPlaying && (
            <span
              className="absolute inset-0 rounded-full bg-[#58cc02]/40 motion-safe:[animation:pulse-ring_1.2s_ease-out_infinite]"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            onClick={playAudio}
            disabled={isLoading}
            aria-label={isPlaying ? 'Audio o‘ynamoqda' : 'Audioni qayta o‘ynatish'}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center text-white border-b-[6px] active:translate-y-[2px] active:border-b-[3px] transition-all duration-150 disabled:opacity-80 disabled:cursor-wait ${
              audioState === 'error'
                ? 'bg-[#9ca3af] border-[#6b7280]'
                : 'bg-[#58cc02] border-[#46a302]'
            }`}
          >
            {isLoading ? (
              <Loader2 size={36} className="animate-spin" />
            ) : audioState === 'error' ? (
              <VolumeX size={36} />
            ) : (
              <Volume2 size={36} />
            )}
          </button>
        </div>
        <p className="text-[11px] font-bold text-[#777]">
          {isPlaying
            ? 'Tinglanmoqda...'
            : isLoading
              ? 'Yuklanmoqda...'
              : audioState === 'error'
                ? 'Audio mavjud emas'
                : 'Qayta tinglash uchun bosing'}
        </p>
      </div>

      {audioErrorVisible && (
        <div className="bg-[#fef3c7] border-[1.5px] border-[#fde68a] rounded-2xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={16} className="text-[#d97706] shrink-0 mt-0.5" />
          <p
            className="text-xs font-bold text-[#78350f] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Audio yuklab bo&apos;lmadi — matn:{' '}
            <span className="font-extrabold">{text}</span>
          </p>
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        <div
          className={`rounded-2xl border-2 border-b-[4px] transition-colors duration-200 ${inputBorder} ${
            shake ? 'motion-safe:[animation:shake_0.4s_ease-in-out]' : ''
          }`}
          onAnimationEnd={() => setShake(false)}
        >
          <textarea
            ref={inputRef}
            rows={2}
            maxLength={MAX_CHARS}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
                e.preventDefault();
                void handleCheck();
              }
            }}
            disabled={phase !== 'idle'}
            placeholder="Eshitganingizni shu yerga yozing..."
            aria-label="Eshitilgan matn javobi"
            className="w-full bg-transparent rounded-2xl p-4 text-lg font-bold text-[#3c3c3c] outline-none resize-none placeholder:text-[#cbbf9c] disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          />
          <div className="flex justify-between items-center px-4 pb-2 text-[11px] font-bold text-[#999]">
            <span>EN</span>
            <span>
              {answer.length} / {MAX_CHARS}
            </span>
          </div>
        </div>

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

      {/* Wrong banner — canonical answer + Tushuntirish + red Davom etish */}
      {isWrong && (
        <div className="space-y-3">
          <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl px-4 py-3 flex items-start gap-2">
            <XCircle size={18} className="text-[#ef4444] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p
                className="text-sm font-extrabold text-[#991b1b] leading-snug"
                style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
              >
                To&apos;g&apos;ri javob: {text}
              </p>
              {feedback && feedback !== `To'g'ri javob: ${text}` && (
                <p className="text-[11px] font-bold text-[#7a1d1d] leading-snug">
                  {feedback}
                </p>
              )}
            </div>
          </div>

          <ExplainPanel
            exerciseType="listen_type"
            question={text}
            studentAnswer={trimmed}
            correctAnswer={text}
            context={context}
          />

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

export default ListenType;
