'use client';
import { useCallback, useEffect, useState } from 'react';
import { Trophy, Users, ChevronLeft } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken } from '@/lib/jwt';
import { Skeleton } from '@/components/ui';
import LeaderboardTable from '../../_components/LeaderboardTable';

type GroupItem = { id: string; name: string };
type ViewMode = 'branch' | 'group';

export default function FiladminLeaderboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('branch');
  const [selectedGroup, setSelectedGroup] = useState<GroupItem | null>(null);

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState('');

  const loadGroups = useCallback(async () => {
    const branchId = getBranchIdFromToken();
    if (!branchId) return;
    setGroupsLoading(true);
    setGroupsError('');
    const token =
      typeof window !== 'undefined'
        ? (localStorage.getItem('accessToken') ?? '')
        : '';
    try {
      const res = await apiRequest<GroupItem[]>(
        `/groups?branchId=${branchId}`,
        {},
        token,
      );
      setGroups(res.data ?? []);
    } catch (err) {
      setGroupsError(
        err instanceof Error ? err.message : 'Guruhlarni yuklab boʻlmadi',
      );
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  function handleTabSwitch(mode: ViewMode) {
    setViewMode(mode);
    if (mode === 'branch') setSelectedGroup(null);
  }

  function handleGroupClick(g: GroupItem) {
    setSelectedGroup(g);
  }

  function handleBackToGroups() {
    setSelectedGroup(null);
  }

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
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center shrink-0">
              <Trophy size={20} className="text-[#fbbf24]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">
                Filadmin
              </p>
              <h1 className="text-white text-lg font-extrabold leading-tight">
                Filial reytingi
              </h1>
              <p className="text-[#475569] text-[11px] font-bold mt-0.5">
                Eng faol o&apos;quvchilar (tugatilgan darslar bo&apos;yicha)
              </p>
            </div>
          </div>

          {/* Toggle tabs */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleTabSwitch('branch')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[40px] rounded-xl text-sm font-extrabold transition-all border-[1.5px] ${
                viewMode === 'branch'
                  ? 'bg-white text-[#0f172a] border-white'
                  : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/15'
              }`}
            >
              <Trophy size={14} />
              Filial bo&apos;yicha
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('group')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 min-h-[40px] rounded-xl text-sm font-extrabold transition-all border-[1.5px] ${
                viewMode === 'group'
                  ? 'bg-white text-[#0f172a] border-white'
                  : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/15'
              }`}
            >
              <Users size={14} />
              Guruhlar
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-3 max-w-2xl mx-auto">
        {viewMode === 'branch' ? (
          <LeaderboardTable
            endpoint="/gamification/leaderboard/branch"
            showGroup
          />
        ) : selectedGroup ? (
          /* Drill-down: group leaderboard */
          <>
            <button
              type="button"
              onClick={handleBackToGroups}
              className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#6d28d9] hover:underline"
            >
              <ChevronLeft size={16} />
              {selectedGroup.name}
            </button>
            <LeaderboardTable
              endpoint={`/gamification/leaderboard/group/${selectedGroup.id}`}
              showGroup={false}
            />
          </>
        ) : (
          /* Group list */
          <GroupPicker
            groups={groups}
            loading={groupsLoading}
            error={groupsError}
            onRetry={loadGroups}
            onSelect={handleGroupClick}
          />
        )}
      </div>
    </div>
  );
}

function GroupPicker({
  groups,
  loading,
  error,
  onRetry,
  onSelect,
}: {
  groups: GroupItem[];
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (g: GroupItem) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} theme="light" className="h-14 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl px-4 py-4 flex items-center justify-between gap-3">
        <p className="text-rose-700 text-sm font-semibold">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="text-rose-700 font-extrabold text-xs underline hover:no-underline shrink-0"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center">
        <Users size={28} className="text-[#94a3b8] mx-auto mb-2" />
        <p className="text-[#0f172a] font-bold text-sm">Guruhlar yoʻq</p>
        <p className="text-[#64748b] text-xs mt-1">
          Bu filialda hali guruh yaratilmagan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-extrabold text-[#94a3b8] uppercase tracking-widest px-1">
        Guruhni tanlang
      </p>
      {groups.map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onSelect(g)}
          className="w-full text-left flex items-center gap-3 bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-4 py-3 hover:border-[#6d28d9]/40 hover:bg-[#f5f3ff] transition-colors group"
        >
          <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center shrink-0">
            <Users size={16} className="text-violet-600" />
          </div>
          <span className="text-[#0f172a] font-extrabold text-sm flex-1 truncate">
            {g.name}
          </span>
          <Trophy
            size={14}
            className="text-[#94a3b8] group-hover:text-[#6d28d9] transition-colors shrink-0"
          />
        </button>
      ))}
    </div>
  );
}
