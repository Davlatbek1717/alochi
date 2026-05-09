'use client';
import { Crown } from 'lucide-react';

export interface PodiumEntry {
  id: string;
  name: string;
  completedLessons: number;
  rank: number;
}

interface PodiumProps {
  /** Up to 3 entries — ordered by rank ascending. Missing slots are rendered as placeholders. */
  entries: PodiumEntry[];
  /** Highlight the current user's row when their id matches. */
  myId?: string;
}

const PILLAR_HEIGHTS = {
  1: 'h-24',
  2: 'h-20',
  3: 'h-16',
} as const;

const PILLAR_BG = {
  1: 'bg-gradient-to-b from-[#fbbf24] to-[#d97706]',
  2: 'bg-gradient-to-b from-[#cbd5e1] to-[#64748b]',
  3: 'bg-gradient-to-b from-[#fbbf24]/70 to-[#92400e]',
} as const;

const ORDER: Array<1 | 2 | 3> = [2, 1, 3]; // visual left-to-right podium order

/**
 * Podium — Duolingo-style leaderboard top 3 display with gold/silver/bronze
 * pillars and avatars sitting on top. The 1st place pillar is taller and
 * gets a crown overlay. Avatars use the first letter of the entry name as a
 * fallback initial.
 */
export function Podium({ entries, myId }: PodiumProps) {
  const byRank = new Map<number, PodiumEntry>();
  for (const e of entries) byRank.set(e.rank, e);

  return (
    <div className="flex items-end justify-center gap-3 py-6">
      {ORDER.map((rank) => {
        const entry = byRank.get(rank);
        const isMe = entry && myId && entry.id === myId;
        return (
          <div key={rank} className="flex flex-col items-center w-20">
            {/* Avatar */}
            <div className="relative mb-2">
              {rank === 1 && (
                <Crown
                  size={20}
                  className="absolute -top-3 left-1/2 -translate-x-1/2 text-[#fbbf24] drop-shadow"
                  fill="#fbbf24"
                />
              )}
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-white text-lg border-[3px] ${
                  isMe ? 'border-[#58cc02]' : 'border-white'
                } shadow-lg ${
                  rank === 1
                    ? 'bg-gradient-to-br from-[#fbbf24] to-[#d97706]'
                    : rank === 2
                      ? 'bg-gradient-to-br from-[#94a3b8] to-[#475569]'
                      : 'bg-gradient-to-br from-[#a16207] to-[#78350f]'
                }`}
              >
                {entry ? entry.name.charAt(0).toUpperCase() : '?'}
              </div>
            </div>

            {/* Name */}
            <p className="text-[11px] font-bold text-[#0f172a] truncate w-full text-center">
              {entry ? entry.name : '—'}
            </p>
            <p className="text-[10px] text-[#f59e0b] font-mono font-extrabold tabular-nums">
              {entry ? `#${entry.rank}` : ''}
            </p>

            {/* Pillar */}
            <div
              className={`mt-1 w-full ${PILLAR_HEIGHTS[rank]} ${PILLAR_BG[rank]} rounded-t-2xl flex items-start justify-center pt-2 text-white font-extrabold text-2xl shadow-inner`}
            >
              {rank}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Podium;
