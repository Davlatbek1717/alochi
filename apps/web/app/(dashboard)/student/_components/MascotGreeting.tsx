'use client';
import { type FC } from 'react';
import { Mascot, type MascotExpression } from '@/components/ui';

interface MascotGreetingProps {
  firstName?: string;
  streak: number;
  /** Optional override; otherwise picked from streak. */
  expression?: MascotExpression;
}

/**
 * MascotGreeting — the warm cream-gradient hero card shown at the top of
 * the student dashboard. This is the first thing the user sees on landing,
 * so it carries the personality of the whole product.
 *
 * Greeting copy is localised (Uzbek) and personalised:
 *   - "Salom, {firstName}!" if we know their name
 *   - falls back to a friendly generic greeting
 * Subtitle adapts to streak depth — beginners get encouragement, longer
 * streaks get celebration.
 */
export const MascotGreeting: FC<MascotGreetingProps> = ({
  firstName,
  streak,
  expression,
}) => {
  const name = (firstName ?? '').trim();
  const greeting = name ? `Salom, ${name}!` : 'Salom, do‘stim!';
  const subtitle = pickSubtitle(streak);
  const mascotExpression: MascotExpression =
    expression ?? (streak >= 3 ? 'happy' : 'idle');

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[#f3e8c7] shadow-sm motion-safe:animate-[bounce-in_500ms_ease-out]"
      style={{
        background:
          'linear-gradient(135deg, #fffaf0 0%, #fef3c7 60%, #fde68a 100%)',
      }}
    >
      {/* Sun ray accent */}
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-44 h-44 rounded-full opacity-60 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(251,191,36,0.55) 0%, transparent 70%)',
        }}
      />
      <div className="relative z-10 flex items-center gap-4 p-5">
        <div className="shrink-0">
          <Mascot expression={mascotExpression} size={104} animated />
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className="text-2xl sm:text-3xl font-extrabold leading-tight text-[#3c3c3c] truncate"
            style={{ fontFamily: 'var(--font-display, var(--font-nunito))' }}
          >
            {greeting}
          </h1>
          <p className="mt-1 text-sm sm:text-base font-semibold text-[#7a5e2c] leading-snug">
            {subtitle}
          </p>
        </div>
      </div>
    </div>
  );
};

function pickSubtitle(streak: number): string {
  if (streak >= 30) {
    return `${streak} kunlik afsonaviy zanjir! Davom etamiz \u{1F451}`;
  }
  if (streak >= 14) {
    return `${streak} kunlik olov! O‘qishni davom ettiraylik \u{1F525}`;
  }
  if (streak >= 7) {
    return `${streak} kunlik zanjiringizni davom ettiraylik \u{1F525}`;
  }
  if (streak >= 3) {
    return `${streak} kun ketma-ket! Zo‘r boshlanish, davom etamiz`;
  }
  if (streak === 1 || streak === 2) {
    return `Yaxshi ish — bugun ${streak}-kun. Zanjirni saqlab qolaylik!`;
  }
  return 'Bugun yangi qadam tashlaymiz!';
}

export default MascotGreeting;
