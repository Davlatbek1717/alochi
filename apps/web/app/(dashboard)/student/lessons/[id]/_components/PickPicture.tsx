'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ImageOff,
  Loader2,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { Button, Mascot } from '@/components/ui';
import { playSound } from '@/lib/sound';
import { getTtsAudio } from '@/lib/exercises';
import { getSpeechCapabilities, speak, stopSpeaking } from '@/lib/speech';
import { XpFloater } from './XpFloater';
import { ExplainPanel } from './ExplainPanel';
import type { PickPictureConfig } from './exercise-types';

interface PickPictureProps {
  config: PickPictureConfig;
  onPassed: () => void;
  onFailed: () => void;
}

type Phase = 'idle' | 'correct' | 'wrong';
type AudioState = 'idle' | 'loading' | 'playing' | 'error';

/**
 * Pass 4 (E) — Pick the matching picture:
 *   - Big centered English word + small TTS play button (English voice).
 *   - 2×2 grid of image cards using next/image (unoptimized — config images
 *     are arbitrary external URLs from the lesson author).
 *   - Each card has the same 3D press chrome as other exercises. Selected
 *     card gets a blue ring + slight scale; on TEKSHIRISH:
 *       - Correct → green flash + chime + +XP floater + auto-advance ~1.3s.
 *       - Wrong → red shake + correct image revealed with green border;
 *         secondary red "Davom etish" → onFailed.
 *   - On image load failure each card falls back to a grey "Rasm yuklanmadi"
 *     placeholder so a single broken URL doesn't kill the exercise.
 *   - Defensive: <2 options OR correctOptionId not in options OR any imageUrl
 *     missing → SkipPanel.
 */
export function PickPicture({ config, onPassed, onFailed }: PickPictureProps) {
  const word = (config?.word ?? '').trim();
  const options = Array.isArray(config?.options) ? config.options : [];
  const correctOptionId = config?.correctOptionId ?? '';
  const correctIndex = options.findIndex((o) => o.id === correctOptionId);
  const malformed =
    !word ||
    options.length < 2 ||
    correctIndex === -1 ||
    options.some((o) => !o || !o.imageUrl);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [shake, setShake] = useState(false);
  const [showFloater, setShowFloater] = useState(false);
  const [floaterKey, setFloaterKey] = useState(0);
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());

  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [audioErrorVisible, setAudioErrorVisible] = useState(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        stopSpeaking();
      } catch {
        /* ignore */
      }
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

  // Auto-play pronunciation on mount so the student hears the English word
  // as soon as the exercise renders. Wrapped in a small delay to let the
  // SpeechSynthesis voice list populate on first paint in some browsers.
  useEffect(() => {
    if (malformed || !word) return;
    if (!getSpeechCapabilities().tts) return;
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      setAudioState('playing');
      speak(word, { lang: 'en-US', rate: 0.9 })
        .then(() => {
          if (mountedRef.current) setAudioState('idle');
        })
        .catch(() => {
          if (mountedRef.current) setAudioState('idle');
        });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word, malformed]);

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
          Rasm topshirig&apos;ida yetarli variant yoki rasm yo&apos;q.
        </p>
        <Button variant="duo" size="md" onClick={onPassed}>
          Davom etish
        </Button>
      </div>
    );
  }

  async function playAudio() {
    if (audioState === 'loading' || audioState === 'playing') return;
    // Browser TTS first — works offline, no Azure credit needed.
    if (getSpeechCapabilities().tts) {
      setAudioState('playing');
      try {
        await speak(word, { lang: 'en-US', rate: 0.9 });
        if (mountedRef.current) setAudioState('idle');
        return;
      } catch {
        if (mountedRef.current) setAudioState('idle');
      }
    }
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
      const res = await getTtsAudio(word, 'en', token);
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
            Bu so&apos;z qaysi rasm?
          </p>
          <p className="text-xs text-[#777] font-semibold mt-0.5">
            Mos rasmni tanlang va tekshiring
          </p>
        </div>
      </div>

      {/* Big word + small play button */}
      <div className="flex flex-col items-center gap-2 py-1">
        <p
          className="text-4xl font-extrabold text-[#3c3c3c] leading-tight tracking-tight text-center"
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {word}
        </p>
        <button
          type="button"
          onClick={playAudio}
          disabled={isLoading}
          aria-label={isPlaying ? 'Audio o‘ynamoqda' : 'Talaffuzini eshitish'}
          className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold border-2 border-b-[3px] active:translate-y-[1px] active:border-b-2 transition-all duration-150 disabled:opacity-80 disabled:cursor-wait ${
            audioState === 'error'
              ? 'bg-[#f3f4f6] border-[#9ca3af] text-[#6b7280]'
              : 'bg-white border-[#e8e0d0] text-[#7a5e2c] hover:border-[#c8b890]'
          }`}
          style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
        >
          {isLoading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : audioState === 'error' ? (
            <VolumeX size={14} />
          ) : (
            <Volume2 size={14} />
          )}
          <span>Tinglash</span>
        </button>
      </div>

      {/* TTS fallback banner */}
      {audioErrorVisible && (
        <div className="bg-[#fef3c7] border-[1.5px] border-[#fde68a] rounded-2xl px-4 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="text-[#d97706] shrink-0 mt-0.5" />
          <p
            className="text-[11px] font-bold text-[#78350f] leading-snug"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            Talaffuz audio yuklab bo&apos;lmadi.
          </p>
        </div>
      )}

      {/* 2×2 image grid */}
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isSelected = selectedId === opt.id;
          const isCorrectOpt = opt.id === correctOptionId;
          const isBroken = brokenIds.has(opt.id);

          let tileStyle =
            'bg-white border-[#e8e0d0] hover:border-[#c8b890]';
          if (phase === 'idle' && isSelected) {
            tileStyle =
              'bg-[#ddf4ff] border-[#1cb0f6] ring-2 ring-[#1cb0f6]/40 scale-[1.02]';
          }
          if (isCorrect && isCorrectOpt) {
            tileStyle =
              'bg-[#dcfce7] border-[#10b981] motion-safe:[animation:pop_500ms_ease-out]';
          } else if (isWrong && isSelected && !isCorrectOpt) {
            tileStyle = 'bg-[#fee2e2] border-[#ef4444]';
          } else if (isWrong && isCorrectOpt) {
            tileStyle = 'bg-[#dcfce7] border-[#10b981]';
          } else if (phase !== 'idle' && !isCorrectOpt && !isSelected) {
            tileStyle = 'bg-white border-[#e8e0d0] opacity-60';
          }

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              disabled={phase !== 'idle'}
              aria-pressed={isSelected}
              aria-label={`Variant ${opt.id}`}
              onAnimationEnd={() => setShake(false)}
              className={`relative aspect-square overflow-hidden rounded-2xl border-2 border-b-[4px] transition-all duration-150 ${tileStyle} ${
                phase === 'idle' ? 'active:translate-y-[2px] active:border-b-2' : ''
              } ${
                shake && isWrong && isSelected
                  ? 'motion-safe:[animation:shake_0.4s_ease-in-out]'
                  : ''
              } disabled:cursor-default`}
            >
              {isBroken ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[#f3eedf] text-[#9ca3af]">
                  <ImageOff size={28} />
                  <p
                    className="text-[10px] font-bold leading-tight px-2 text-center"
                    style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
                  >
                    Rasm yuklanmadi
                  </p>
                </div>
              ) : (
                <Image
                  src={opt.imageUrl}
                  alt={`Variant ${opt.id}`}
                  fill
                  sizes="(max-width: 480px) 50vw, 200px"
                  className="object-cover"
                  unoptimized
                  onError={() =>
                    setBrokenIds((prev) => {
                      if (prev.has(opt.id)) return prev;
                      const next = new Set(prev);
                      next.add(opt.id);
                      return next;
                    })
                  }
                />
              )}
              {isCorrect && isCorrectOpt && (
                <span className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md">
                  <CheckCircle2 size={18} className="text-[#10b981]" />
                </span>
              )}
              {isWrong && isSelected && !isCorrectOpt && (
                <span className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md">
                  <XCircle size={18} className="text-[#ef4444]" />
                </span>
              )}
              {isWrong && isCorrectOpt && (
                <span className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md">
                  <CheckCircle2 size={18} className="text-[#10b981]" />
                </span>
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
            Ajoyib!
          </p>
        </div>
      )}

      {/* Wrong banner + ExplainPanel + red Davom etish */}
      {isWrong && (
        <div className="space-y-3">
          <div className="bg-[#fee2e2] border-[1.5px] border-[#fecaca] rounded-2xl px-4 py-3 flex items-start gap-2">
            <XCircle size={18} className="text-[#ef4444] shrink-0 mt-0.5" />
            <p
              className="text-sm font-extrabold text-[#991b1b] leading-snug"
              style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
            >
              To&apos;g&apos;ri rasm yashil ramka bilan belgilangan.
            </p>
          </div>
          <ExplainPanel
            exerciseType="pick_picture"
            question={`Bu so'z qaysi rasm: ${word}`}
            studentAnswer={
              selectedId ? `Variant ${selectedId}` : '(no selection)'
            }
            correctAnswer={`Variant ${correctOptionId} (${word})`}
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

export default PickPicture;
