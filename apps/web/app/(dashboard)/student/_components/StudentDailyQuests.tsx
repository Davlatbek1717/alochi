'use client';
import { useEffect, useRef, useState, type FC } from 'react';
import { playSound } from '@/lib/sound';

export interface Quest {
  questType: string;
  targetValue: number;
  progress: number;
  completed: boolean;
}

interface StudentDailyQuestsProps {
  quests: Quest[];
}

const QUEST_LABELS: Record<string, string> = {
  learn_words: "Yangi so'zlar o'rgan",
  watch_video: "Videoni ko'r",
  ask_tutor: 'AI Tutor ga savol ber',
  lesson_complete: 'Darsni tamomla',
};

const QUEST_ICONS: Record<string, string> = {
  learn_words: '\u{1F524}',
  watch_video: '\u{1F4FA}',
  ask_tutor: '\u{1F916}',
  lesson_complete: '\u{1F4DA}',
};

/**
 * StudentDailyQuests — chest-card redesign of the older flat-checkbox
 * `DailyQuests` component (which is still used by the tester clone, hence
 * the fork).
 *
 * Visual metaphor: each quest is a treasure chest. Locked quests show the
 * chest closed in muted brass; the moment a quest flips to completed we
 * play `correct.mp3`, bounce-in the chest, swap it to its open/gold state and
 * show a completion indicator.
 *
 * The "rising edge" detection uses a ref — we only fire effects when a
 * quest flips false→true, never on initial mount with already-completed
 * quests (which would spam noise + animations on every re-render).
 */
export const StudentDailyQuests: FC<StudentDailyQuestsProps> = ({ quests }) => {
  const total = quests.length;
  const completed = quests.filter((q) => q.completed).length;
  const prevCompletedRef = useRef<Set<string>>(new Set());
  const [poppingKeys, setPoppingKeys] = useState<Set<string>>(new Set());
  const [floatingKeys, setFloatingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next = new Set<string>();
    const newlyCompleted: Quest[] = [];
    for (const q of quests) {
      if (q.completed) {
        next.add(q.questType);
        if (!prevCompletedRef.current.has(q.questType)) {
          newlyCompleted.push(q);
        }
      }
    }
    if (newlyCompleted.length > 0) {
      playSound('correct', 0.5);
      setPoppingKeys((s) => {
        const out = new Set(s);
        for (const q of newlyCompleted) out.add(q.questType);
        return out;
      });
      setFloatingKeys((s) => {
        const out = new Set(s);
        for (const q of newlyCompleted) out.add(q.questType);
        return out;
      });
      const popTimer = window.setTimeout(() => {
        setPoppingKeys(new Set());
      }, 600);
      const floatTimer = window.setTimeout(() => {
        setFloatingKeys(new Set());
      }, 1100);
      prevCompletedRef.current = next;
      return () => {
        window.clearTimeout(popTimer);
        window.clearTimeout(floatTimer);
      };
    }
    prevCompletedRef.current = next;
  }, [quests]);

  if (total === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#ede9e1]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#777]">
            Bugungi vazifalar
          </p>
          <p className="text-lg font-extrabold text-[#3c3c3c] leading-tight">
            Sandiqlarni och
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-[#46a302] leading-none">
            {completed}/{total}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#777] mt-0.5">
            bajarildi
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {quests.map((q) => {
          const popping = poppingKeys.has(q.questType);
          const floating = floatingKeys.has(q.questType);
          const label = QUEST_LABELS[q.questType] ?? q.questType;
          const icon = QUEST_ICONS[q.questType] ?? '\u{1F3AF}';

          return (
            <div
              key={q.questType}
              className="relative flex flex-col items-center gap-2 text-center"
            >
              <div
                className={`relative ${
                  popping
                    ? 'motion-safe:animate-[bounce-in_500ms_ease-out]'
                    : ''
                }`}
              >
                <ChestSvg open={q.completed} size={64} />
                <span
                  aria-hidden
                  className="absolute inset-0 flex items-center justify-center text-2xl pointer-events-none"
                  style={{ filter: q.completed ? 'none' : 'grayscale(0.4) opacity(0.85)' }}
                >
                  {icon}
                </span>
                {floating && (
                  <span
                    aria-hidden
                    className="absolute left-1/2 -translate-x-1/2 -top-2 text-xs font-extrabold text-[#ce82ff] motion-safe:animate-[float-up_1s_ease-out_forwards]"
                  >
                    ✓
                  </span>
                )}
              </div>
              <div className="min-h-[2.5rem]">
                <p
                  className={`text-[11px] font-bold leading-tight ${
                    q.completed ? 'text-[#46a302]' : 'text-[#3c3c3c]'
                  }`}
                >
                  {label}
                </p>
                {q.targetValue > 1 && (
                  <p className="text-[10px] text-[#888] mt-0.5">
                    {q.progress}/{q.targetValue}
                  </p>
                )}
              </div>
              {q.completed && (
                <span
                  className="inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-extrabold bg-emerald-100 text-emerald-700 border border-emerald-300"
                >
                  Bajarildi
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ChestSvg: FC<{ open: boolean; size?: number }> = ({ open, size = 64 }) => {
  // Closed: brass body + dark grey lid; Open: gold body + lid lifted with sparkle
  const body = open ? '#fbbf24' : '#a8825a';
  const lid = open ? '#f59e0b' : '#7a5e3a';
  const stroke = open ? '#b45309' : '#4d3a23';

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden
      className="drop-shadow-sm"
    >
      {/* Base body */}
      <rect
        x="8"
        y="28"
        width="48"
        height="28"
        rx="4"
        fill={body}
        stroke={stroke}
        strokeWidth="2"
      />
      {/* Body band */}
      <rect x="8" y="38" width="48" height="3" fill={stroke} opacity="0.35" />
      {/* Lock */}
      <rect
        x="28"
        y="36"
        width="8"
        height="10"
        rx="1.5"
        fill={open ? '#fde68a' : '#3c2d18'}
        stroke={stroke}
        strokeWidth="1.5"
      />
      {/* Lid — translates up + tilts when open */}
      <g transform={open ? 'translate(0,-6) rotate(-12 32 24)' : ''}>
        <rect
          x="6"
          y="20"
          width="52"
          height="14"
          rx="6"
          fill={lid}
          stroke={stroke}
          strokeWidth="2"
        />
        <rect
          x="6"
          y="28"
          width="52"
          height="3"
          fill={stroke}
          opacity="0.3"
        />
      </g>
      {open && (
        <>
          {/* Gold sparkle interior */}
          <circle cx="20" cy="34" r="2.5" fill="#fde68a" />
          <circle cx="32" cy="32" r="3" fill="#fef3c7" />
          <circle cx="44" cy="34" r="2" fill="#fde68a" />
          {/* Sparkle stars */}
          <path
            d="M52 14 L53 18 L57 19 L53 20 L52 24 L51 20 L47 19 L51 18 Z"
            fill="#fef3c7"
            opacity="0.9"
          />
          <path
            d="M14 18 L15 20.5 L17.5 21 L15 21.5 L14 24 L13 21.5 L10.5 21 L13 20.5 Z"
            fill="#fef3c7"
            opacity="0.85"
          />
        </>
      )}
    </svg>
  );
};

export default StudentDailyQuests;
