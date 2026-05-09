'use client';
import { Crown, Trophy, Medal, Flame, BookOpen } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { Skeleton, EmptyState } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';

export type LeaderboardRow = {
  rank: number;
  id: string;
  name: string;
  completedLessons: number;
  currentStreak: number;
  weeklyCompletedLessons?: number;
  groupName?: string | null;
};

interface Props {
  /** API endpoint returning LeaderboardRow[] */
  endpoint: string;
  /** Highlight this row (typically the viewer's own id when applicable) */
  highlightId?: string;
  /** Show group column (true for filadmin branch view). */
  showGroup?: boolean;
}

const RANK_STYLES = [
  // rank 1 — gold
  'bg-gradient-to-br from-[#fde68a] to-[#f59e0b] border-[#f59e0b]',
  // rank 2 — silver
  'bg-gradient-to-br from-[#e2e8f0] to-[#94a3b8] border-[#94a3b8]',
  // rank 3 — bronze
  'bg-gradient-to-br from-[#fed7aa] to-[#d97706] border-[#d97706]',
];

const RANK_ROW_BG = [
  'bg-gradient-to-r from-[#fffbeb] to-[#fef3c7] border-[#fde68a]',
  'bg-gradient-to-r from-[#f8fafc] to-[#f1f5f9] border-[#cbd5e1]',
  'bg-gradient-to-r from-[#fff7ed] to-[#ffedd5] border-[#fed7aa]',
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div
        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center border ${RANK_STYLES[0]}`}
      >
        <Crown size={15} className="text-white drop-shadow" fill="white" />
      </div>
    );
  if (rank === 2)
    return (
      <div
        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center border ${RANK_STYLES[1]}`}
      >
        <Trophy size={14} className="text-white drop-shadow" fill="white" />
      </div>
    );
  if (rank === 3)
    return (
      <div
        className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center border ${RANK_STYLES[2]}`}
      >
        <Medal size={14} className="text-white drop-shadow" fill="white" />
      </div>
    );
  return (
    <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-[#f7f4ef] border border-[#ede9e1]">
      <span className="text-xs font-extrabold text-[#64748b]">{rank}</span>
    </div>
  );
}

function LeaderboardRowItem({
  row,
  highlightId,
  showGroup,
}: {
  row: LeaderboardRow;
  highlightId?: string;
  showGroup?: boolean;
}) {
  const isHighlighted = highlightId ? row.id === highlightId : false;
  const rowBg =
    row.rank <= 3
      ? RANK_ROW_BG[row.rank - 1]
      : isHighlighted
        ? 'bg-[#ede9ff] border-[#6d28d9]'
        : 'bg-white border-[#ede9e1]';

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-3 py-2.5 transition-colors ${rowBg} ${isHighlighted ? 'ring-2 ring-[#6d28d9]/20 shadow-sm' : ''}`}
    >
      <RankBadge rank={row.rank} />

      {/* Name + group */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-extrabold text-[#0f172a] truncate">
          {row.name}
          {isHighlighted && (
            <span className="ml-1.5 text-[9px] font-extrabold text-white bg-[#6d28d9] px-1.5 py-0.5 rounded-full uppercase tracking-wider align-middle">
              Siz
            </span>
          )}
        </p>
        {showGroup && row.groupName && (
          <p className="text-[10px] text-[#94a3b8] font-semibold mt-0.5 truncate">
            {row.groupName}
          </p>
        )}
      </div>

      {/* Chips */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        {/* Weekly completed lessons badge */}
        {typeof row.weeklyCompletedLessons === 'number' && row.weeklyCompletedLessons > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            +{row.weeklyCompletedLessons} dars/hafta
          </span>
        )}

        {/* Streak chip */}
        {row.currentStreak > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#ef4444]">
            <Flame size={12} />
            {row.currentStreak}
          </span>
        )}

        {/* Total completed lessons chip */}
        <span className="inline-flex items-center gap-1 text-[13px] font-extrabold text-[#0ea5e9] tabular-nums">
          <BookOpen size={13} />
          {row.completedLessons.toLocaleString()} dars
        </span>
      </div>
    </div>
  );
}

export default function LeaderboardTable({
  endpoint,
  highlightId,
  showGroup,
}: Props) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    setLoading(true);
    const token =
      typeof window !== 'undefined'
        ? (localStorage.getItem('accessToken') ?? '')
        : '';
    apiRequest<LeaderboardRow[]>(endpoint, {}, token)
      .then((res) => setRows(res.data ?? []))
      .catch((err) =>
        setLoadError(
          err instanceof Error ? err.message : 'Reyting yuklanmadi',
        ),
      )
      .finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);
  useRevalidateOnEvent(['cert:earned'], load);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 animate-pulse"
          >
            <div className="flex items-center gap-3">
              <Skeleton theme="light" className="w-9 h-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton theme="light" className="h-4 w-1/2" />
                <Skeleton theme="light" className="h-3 w-1/4" />
              </div>
              <Skeleton theme="light" className="h-5 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
        <p className="text-rose-700 text-sm font-semibold">{loadError}</p>
        <button
          type="button"
          onClick={load}
          className="text-rose-700 font-extrabold text-xs underline hover:no-underline shrink-0"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] overflow-hidden">
        <EmptyState
          theme="light"
          icon={<Trophy size={28} />}
          title="Reyting hali boʻsh"
          description="O'quvchilar dars tugatib, reytingga qoʻshilishadi."
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <LeaderboardRowItem
          key={row.id}
          row={row}
          highlightId={highlightId}
          showGroup={showGroup}
        />
      ))}
    </div>
  );
}
