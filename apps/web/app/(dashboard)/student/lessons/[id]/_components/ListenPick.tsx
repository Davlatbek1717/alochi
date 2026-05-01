'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Volume2, VolumeX, XCircle } from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { getTtsAudio } from '@/lib/exercises';
import { XpFloater } from './XpFloater';
import type { ListenPickConfig } from './exercise-types';

interface ListenPickProps {
  config: ListenPickConfig;
  onPassed: () => void;
  onFailed: () => void;
}

type Phase = 'idle' | 'checking' | 'correct' | 'wrong';
type AudioState = 'idle' | 'loading' | 'playing' | 'error';

/**
 * Pass 3 (B) — Listen & Pick:
 *   - Big circular play-audio button at the top fetches /ai/tts on first
 *     tap (and auto-plays once on mount). Subsequent taps replay the cached
 *     `HTMLAudioElement` so the student isn't punished by a re-fetch.
 *   - Below: 4 option tiles in a 2-column grid. Tiles render an image when
 *     `imageUrl` is provided, otherwise a centered bold label.
 *   - Select-then-check pattern via the sticky duo CTA. Strict client-side
 *     grade against `correctOptionId`.
 *   - Correct: green flash, +10 XP floater, chime, auto-advance after ~1.3s.
 *   - Wrong: red shake, buzz, correct option highlighted, secondary red
 *     "Davom etish" button → `onFailed`.
 *   - Defensive: malformed configs (<2 options or unknown correctOptionId)
 *     short-circuit to a SkipPanel so the lesson can't get stuck.
 */
export function ListenPick({ config, onPassed, onFailed }: ListenPickProps) {
  const text = config?.text ?? '';
  const options = Array.isArray(config?.options) ? config.options : [];
  const correctOptionId = config?.correctOptionId ?? '';
  const correctIndex = options.findIndex((o) => o.id === correctOptionId);
  const malformed = !text || options.length < 2 || correctIndex === -1;

  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [audioErrorVisible, setAudioErrorVisible] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [shake, setShake] = useState(false);
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const autoplayedRef = useRef(false);
  const mountedRef = useRef(true);

  // Cleanup any cached audio on unmount so we don't leak Audio nodes when
  // the lesson runner advances to the next step.
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

  // Auto-play once on mount (after a small delay so the page lays out first).
  useEffect(() => {
    if (malformed || autoplayedRef.current) return;
    autoplayedRef.current = true;
    const t = setTimeout(() => {
      void playAudio();
    }, 500);
    return () => clearTimeout(t);
    // playAudio is stable enough; don't include to avoid re-firing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [malformed]);

  async function playAudio() {
    if (audioState === 'loading') return;
    // Replay path — cached element. Reset to start so taps always replay
    // from the beginning.
    if (audioElementRef.current) {
      try {
        audioElementRef.current.currentTime = 0;
        await audioElementRef.current.play();
      } catch {
        /* user-gesture restrictions etc. — silent */
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
        if (mountedRef.current) setAudioState('idle');
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

  if (malformed) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#e8e0d0] p-6 text-center space-y-3">
        <AlertTriangle size={28} className="text-[#fbbf24] mx-auto" />
        <p
          className="text-[#3c3c3c] font-extrabold text-base"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          Bu mashq sozlanmagan
        </p>
        <p className="text-[#777] text-sm font-semibold">
          Eshitish topshirig&apos;ida yetarli variant yoki to&apos;g&apos;ri javob yo&apos;q.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  function handleSelect(id: string) {
    if (phase !== 'idle') return;
    setSelectedId(id);
  }

  function handleCheck() {
    if (!selectedId || phase !== 'idle') return;
    const correct = selectedId === correctOptionId;
    if (correct) {
      setPhase('correct');
      playSound('correct');
      setShowFloater(true);
      setFloaterKey((k) => k + 1);
      setTimeout(() => onPassed(), 1300);
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
  const canSubmit = selectedId !== null && phase === 'idle';
  const isPlaying = audioState === 'playing';
  const isLoading = audioState === 'loading';

  return (
    <div className="space-y-4">
      {/* Header — Aloqush + eyebrow */}
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
            Eshiting va to&apos;g&apos;risini tanlang
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            Ovozni tinglang, mos rasmni yoki so&apos;zni tanlang
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

      {/* Audio fallback banner — keeps the lesson playable when /ai/tts isn't
          configured (e.g. dev without Azure creds). */}
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

      {/* 2-column option grid */}
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const isCorrectOpt = opt.id === correctOptionId;

          let tileStyle =
            'bg-white border-[#e8e0d0] text-[#3c3c3c] hover:border-[#c8b890]';
          if (phase === 'idle' && isSelected) {
            tileStyle = 'bg-[#ddf4ff] border-[#1cb0f6] text-[#0c6c8f]';
          }
          if (isCorrect && isCorrectOpt) {
            tileStyle =
              'bg-[#dcfce7] border-[#10b981] text-[#065f46] motion-safe:[animation:pop_500ms_ease-out]';
          } else if (isWrong && isSelected && !isCorrectOpt) {
            tileStyle =
              'bg-[#fee2e2] border-[#ef4444] text-[#991b1b] motion-safe:[animation:shake_0.4s_ease-in-out]';
          } else if (isWrong && isCorrectOpt) {
            // Reveal the correct one with a soft green when student got it wrong.
            tileStyle = 'bg-[#dcfce7] border-[#10b981] text-[#065f46]';
          } else if (phase !== 'idle' && !isCorrectOpt && !isSelected) {
            tileStyle = 'bg-white border-[#e8e0d0] text-[#9ca3af] opacity-70';
          }

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              disabled={phase !== 'idle'}
              aria-pressed={isSelected}
              aria-label={opt.label}
              onAnimationEnd={() => setShake(false)}
              className={`relative min-h-[120px] flex flex-col items-center justify-center gap-2 px-3 py-4 rounded-2xl border-2 border-b-[4px] font-bold text-base text-center transition-all duration-150 ${tileStyle} ${
                phase === 'idle' ? 'active:translate-y-[2px] active:border-b-2' : ''
              } ${
                shake && isWrong && isSelected
                  ? 'motion-safe:[animation:shake_0.4s_ease-in-out]'
                  : ''
              } disabled:cursor-default`}
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              {opt.imageUrl ? (
                <>
                  <span className="relative w-16 h-16 overflow-hidden rounded-xl bg-[#f7f4ef] border border-[#e8e0d0]">
                    <Image
                      src={opt.imageUrl}
                      alt={opt.label}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                  <span className="text-sm font-extrabold leading-tight">
                    {opt.label}
                  </span>
                </>
              ) : (
                <span className="text-xl font-extrabold leading-tight">
                  {opt.label}
                </span>
              )}
              {isCorrect && isCorrectOpt && (
                <CheckCircle2
                  size={18}
                  className="absolute top-2 right-2 text-[#10b981]"
                />
              )}
              {isWrong && isSelected && !isCorrectOpt && (
                <XCircle
                  size={18}
                  className="absolute top-2 right-2 text-[#ef4444]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* +10 XP floater */}
      {showFloater && (
        <div className="relative h-0">
          <div className="absolute right-3 -top-3 pointer-events-none">
            <XpFloater
              key={floaterKey}
              amount={10}
              onDone={() => setShowFloater(false)}
            />
          </div>
        </div>
      )}

      {/* Correct banner */}
      {isCorrect && (
        <div className="bg-[#dcfce7] border-[1.5px] border-[#bbf7d0] rounded-2xl px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-[#10b981] shrink-0" />
          <p
            className="text-sm font-extrabold text-[#065f46]"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Ajoyib! +10 XP
          </p>
        </div>
      )}

      {/* Wrong banner + red Davom etish */}
      {isWrong && (
        <div className="space-y-3">
          <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl px-4 py-3 flex items-start gap-2">
            <XCircle size={18} className="text-[#ef4444] shrink-0 mt-0.5" />
            <p
              className="text-sm font-extrabold text-[#991b1b] leading-snug"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              To&apos;g&apos;ri javob: {options[correctIndex]?.label}
            </p>
          </div>
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

      {/* Sticky CTA */}
      {!isWrong && !isCorrect && (
        <Button
          variant="duo"
          size="lg"
          fullWidth
          disabled={!canSubmit}
          onClick={handleCheck}
        >
          TEKSHIRISH
        </Button>
      )}
    </div>
  );
}

export default ListenPick;
