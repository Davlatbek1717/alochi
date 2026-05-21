'use client';
import { useEffect, useMemo, useState } from 'react';
import { Users, Search, GraduationCap, X, Activity } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken } from '@/lib/jwt';
import { EmptyState, Skeleton, useToast } from '@/components/ui';
import { UserCard, type UserStatusColor } from '../../_components/UserCard';

type BranchUser = {
  id: string;
  name: string;
  role: string;
  status?: string;
  login?: string;
};

type SnapshotEntry = {
  id: string;
  name: string;
  isActive: boolean;
  secondsToday: number;
  lastPingAt: string | null;
  currentLessonId: string | null;
  currentLessonTitle: string | null;
};

function timeAgo(pingAt: string | null): string {
  if (!pingAt) return '';
  const secs = Math.floor((Date.now() - new Date(pingAt).getTime()) / 1000);
  if (secs < 75) return 'hozirgina';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}d oldin`;
  return `${Math.floor(mins / 60)}s oldin`;
}

type RoleFilter = 'student' | 'mentor' | 'manager' | 'tester' | 'all';

const ROLE_LABEL: Record<RoleFilter, string> = {
  student: "O'quvchilar",
  mentor: 'Mentorlar',
  manager: 'Menejerlar',
  tester: 'Testerlar',
  all: 'Hammasi',
};

type StatusRow = {
  studentId: string;
  student: { id: string };
  englishStatus: string;
  personalStatus: string;
  criticalStatus: string;
};

function worstFromRow(row: StatusRow): UserStatusColor {
  const order: UserStatusColor[] = ['qizil', 'sariq', 'yashil'];
  for (const want of order) {
    if (
      row.englishStatus === want ||
      row.personalStatus === want ||
      row.criticalStatus === want
    ) {
      return want;
    }
  }
  return '';
}

export default function FiladminStudentsPage() {
  const toast = useToast();
  const [users, setUsers] = useState<BranchUser[]>([]);
  const [statusByStudent, setStatusByStudent] = useState<Record<string, UserStatusColor>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RoleFilter>('student');
  const [query, setQuery] = useState('');
  // Status filter only visible when the role filter is on 'student' —
  // mentors/menejerlar/testers don't have english/personal/critical chips.
  const [statusFilter, setStatusFilter] = useState<'all' | 'yashil' | 'sariq' | 'qizil'>('all');
  const [snapshot, setSnapshot] = useState<SnapshotEntry[]>([]);
  const [snapshotActiveCount, setSnapshotActiveCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    // Prefer the JWT-decoded branchId — it survives stale `user`
    // objects in localStorage left over from before login responses
    // started returning the branch field. Fall back to the user blob
    // for safety.
    let branchId = getBranchIdFromToken() ?? '';
    if (!branchId) {
      try {
        const u = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
        branchId = u.branchId ?? '';
      } catch { /* ignore */ }
    }

    async function load() {
      if (!branchId) {
        setLoading(false);
        return;
      }
      try {
        const [list, redRes, yellowRes] = await Promise.all([
          apiRequest<BranchUser[]>(`/users/by-branch/${branchId}`, {}, token),
          apiRequest<StatusRow[]>('/status/red-students', {}, token).catch(() => ({ data: [] as StatusRow[] })),
          apiRequest<StatusRow[]>('/status/yellow-students', {}, token).catch(() => ({ data: [] as StatusRow[] })),
        ]);
        setUsers(list.data ?? []);
        const map: Record<string, UserStatusColor> = {};
        for (const s of redRes.data ?? []) map[s.student?.id ?? s.studentId] = worstFromRow(s);
        for (const s of yellowRes.data ?? []) {
          const id = s.student?.id ?? s.studentId;
          if (!map[id]) map[id] = worstFromRow(s);
        }
        setStatusByStudent(map);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Yuklab boʻlmadi');
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live snapshot polling (30s interval)
  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    async function fetchSnapshot() {
      try {
        const res = await apiRequest<{ activeCount: number; students: SnapshotEntry[] }>(
          '/study-time/scope/snapshot',
          {},
          token,
        );
        setSnapshotActiveCount(res.data.activeCount);
        setSnapshot(res.data.students);
      } catch {
        // best-effort
      }
    }
    fetchSnapshot();
    const id = setInterval(fetchSnapshot, 30_000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        // Match either name or login so filadmins can search by either.
        const hay = `${u.name} ${u.login ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filter !== 'all' && u.role !== filter) return false;
      // Status filter only applies to students; mentors etc. don't have a
      // colour assigned so we never want to hide them via the colour chip.
      if (filter === 'student' && statusFilter !== 'all') {
        const colour = statusByStudent[u.id] ?? 'yashil';
        if (colour !== statusFilter) return false;
      }
      return true;
    });
  }, [users, query, filter, statusFilter, statusByStudent]);

  const counts = useMemo(() => ({
    student: users.filter((u) => u.role === 'student').length,
    mentor: users.filter((u) => u.role === 'mentor').length,
    manager: users.filter((u) => u.role === 'manager').length,
    tester: users.filter((u) => u.role === 'tester').length,
    all: users.length,
  }), [users]);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <GraduationCap size={20} className="text-violet-400" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Filadmin</p>
            <p className="text-white text-lg font-bold">Foydalanuvchilar</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">

        {/* Live snapshot panel */}
        {snapshot.length > 0 && (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-[#f0ece4]">
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-emerald-500" />
                <span className="text-xs font-extrabold text-[#0f172a]">Hozir aktiv</span>
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                  style={{
                    background: snapshotActiveCount > 0 ? '#dcfce7' : '#f1f5f9',
                    color: snapshotActiveCount > 0 ? '#15803d' : '#64748b',
                  }}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${snapshotActiveCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
                  />
                  {snapshotActiveCount} / {snapshot.length}
                </span>
              </div>
            </div>
            <ul className="divide-y divide-[#f7f4ef]">
              {snapshot.map((s) => (
                <li key={s.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${s.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-[#0f172a] truncate">{s.name}</span>
                    {s.currentLessonTitle && (
                      <span className="block text-[11px] text-[#64748b] font-semibold truncate">
                        {s.currentLessonTitle}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: s.isActive ? '#15803d' : '#94a3b8' }}>
                    {s.lastPingAt ? timeAgo(s.lastPingAt) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Ism yoki login boʻyicha qidirish"
            placeholder="Ism yoki login boʻyicha qidirish..."
            className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200 placeholder:text-[#94a3b8]"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Qidiruvni tozalash"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg hover:bg-[#f7f4ef] flex items-center justify-center text-[#94a3b8]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Role chips */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Rol</p>
          <div className="flex gap-1.5 flex-wrap">
            {(['student', 'mentor', 'manager', 'tester', 'all'] as RoleFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-3 py-1.5 min-h-[32px] rounded-full text-xs font-bold transition-colors border ${
                  filter === f
                    ? 'bg-violet-600 text-white border-violet-600'
                    : 'bg-white text-[#0f172a] border-[#ede9e1] hover:border-violet-300 hover:bg-violet-50'
                }`}
              >
                {ROLE_LABEL[f]}
                <span className="ml-1.5 text-[10px] opacity-70 font-mono">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Status chips (only meaningful for students) */}
        {filter === 'student' && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Holat</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: 'all',   label: 'Hammasi', dot: 'bg-[#94a3b8]' },
                { key: 'yashil', label: 'Yashil',  dot: 'bg-emerald-500' },
                { key: 'sariq',  label: 'Sariq',   dot: 'bg-amber-500' },
                { key: 'qizil',  label: 'Qizil',   dot: 'bg-rose-500' },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusFilter(s.key as typeof statusFilter)}
                  aria-pressed={statusFilter === s.key}
                  className={`px-3 py-1.5 min-h-[32px] rounded-full text-xs font-bold transition-colors border inline-flex items-center gap-1.5 ${
                    statusFilter === s.key
                      ? 'bg-[#0f172a] text-white border-[#0f172a]'
                      : 'bg-white text-[#0f172a] border-[#ede9e1] hover:border-[#0f172a]/40'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 rounded-[14px]" theme="light" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<Users size={28} />}
              title="Foydalanuvchi yoʻq"
              description={
                query
                  ? `"${query}" bo‘yicha hech narsa topilmadi`
                  : 'Filtrlarni o‘zgartiring'
              }
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              {filtered.length === users.length
                ? `${users.length} ta natija`
                : `${filtered.length} / ${users.length} ta natija`}
            </p>
            {filtered.map((u) => (
              <UserCard
                key={u.id}
                id={u.id}
                name={u.name}
                subtitle={ROLE_LABEL[(u.role as RoleFilter)] ?? u.role}
                status={u.role === 'student' ? statusByStudent[u.id] ?? 'yashil' : ''}
                href={u.role === 'student' ? `/filadmin/students/${u.id}` : undefined}
                trailing={u.role === 'student' ? undefined : <span className="w-4" />}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
