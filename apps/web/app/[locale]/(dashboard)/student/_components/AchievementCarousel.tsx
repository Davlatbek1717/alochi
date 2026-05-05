'use client';
import { type ReactNode } from 'react';

export interface Achievement {
  id: string;
  title: string;
  icon: ReactNode;
  rarity: 'common' | 'rare' | 'legendary';
}

interface AchievementCarouselProps {
  items: Achievement[];
}

/**
 * AchievementCarousel — horizontal scroll list of badges. Legendary badges
 * get a slowly rotating gold ring. Common badges have a soft cream tile and
 * rare ones a violet/blue gradient. Snap-x for momentum scrolling on touch.
 */
export function AchievementCarousel({ items }: AchievementCarouselProps) {
  if (items.length === 0) {
    return (
      <p className="text-xs text-[#94a3b8] italic">Hali yutuq yoʻq</p>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
      {items.map((a) => (
        <div
          key={a.id}
          className="shrink-0 snap-start flex flex-col items-center"
          style={{ width: 84 }}
        >
          <div className="relative w-16 h-16">
            {a.rarity === 'legendary' && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-full motion-safe:animate-spin"
                style={{
                  background:
                    'conic-gradient(from 0deg, #fbbf24, #fde68a, #f59e0b, #fbbf24)',
                  animationDuration: '6s',
                }}
              />
            )}
            <div
              className={`absolute inset-[3px] rounded-full flex items-center justify-center text-2xl ${
                a.rarity === 'legendary'
                  ? 'bg-gradient-to-br from-[#fffbeb] to-[#fde68a] text-[#92400e]'
                  : a.rarity === 'rare'
                    ? 'bg-gradient-to-br from-[#ede9fe] to-[#c4b5fd] text-[#5b21b6]'
                    : 'bg-[#fffaf0] border-[1.5px] border-[#ede9e1] text-[#0f172a]'
              }`}
            >
              {a.icon}
            </div>
          </div>
          <p className="mt-1.5 text-[10px] font-bold text-[#0f172a] text-center leading-tight line-clamp-2">
            {a.title}
          </p>
        </div>
      ))}
    </div>
  );
}

export default AchievementCarousel;
