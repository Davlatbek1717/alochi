'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Trophy, ArrowLeft, Users } from 'lucide-react';
import { fetchMyGroupId } from '@/lib/jwt';
import LeaderboardTable from '../../_components/LeaderboardTable';

export default function MentorLeaderboardPage() {
  const [groupId, setGroupId] = useState<string | null | undefined>(undefined);

  const resolveGroup = useCallback(async () => {
    const id = await fetchMyGroupId();
    setGroupId(id);
  }, []);

  useEffect(() => {
    resolveGroup();
  }, [resolveGroup]);

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-4">
      {/* Dark header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <Link
            href="/mentor"
            aria-label="Orqaga"
            className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">
              Mentor
            </p>
            <h1 className="text-white text-lg font-extrabold leading-tight flex items-center gap-2">
              <Trophy size={16} className="text-[#fbbf24] shrink-0" />
              Guruh reytingi
            </h1>
            <p className="text-[#475569] text-[11px] font-bold mt-0.5">
              Sizning guruhingiz o&apos;quvchilari
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-3 max-w-lg mx-auto">
        {groupId === undefined ? (
          /* resolving group — show placeholder skeleton */
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 h-14 animate-pulse"
              />
            ))}
          </div>
        ) : groupId === null ? (
          /* no group assigned */
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center mx-auto">
              <Users size={22} className="text-rose-500" />
            </div>
            <p className="text-rose-800 font-extrabold text-sm">
              Guruh biriktirilmagan
            </p>
            <p className="text-rose-700 text-xs">
              Filadmin orqali sizga guruh tayinlanishi kerak.
            </p>
            <button
              type="button"
              onClick={resolveGroup}
              className="mt-2 text-rose-700 font-extrabold text-xs underline hover:no-underline"
            >
              Qayta tekshirish
            </button>
          </div>
        ) : (
          <LeaderboardTable
            endpoint={`/gamification/leaderboard/group/${groupId}`}
            showGroup={false}
          />
        )}
      </div>
    </div>
  );
}
