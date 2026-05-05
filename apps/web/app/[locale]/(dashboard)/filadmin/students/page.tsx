'use client';
import { useEffect, useMemo, useState } from 'react';
import { Users, Search, Filter, GraduationCap } from 'lucide-react';
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (q && !u.name.toLowerCase().includes(q)) return false;
      if (filter === 'all') return true;
      return u.role === filter;
    });
  }, [users, query, filter]);

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
        <div className="space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ism boʻyicha qidirish..."
              className="w-full bg-white border border-[#ede9e1] rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
            />
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <Filter size={14} className="text-[#94a3b8]" />
            {(['student', 'mentor', 'manager', 'tester', 'all'] as RoleFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  filter === f
                    ? 'bg-[#0f172a] text-white'
                    : 'bg-white text-[#64748b] border border-[#ede9e1]'
                }`}
              >
                {ROLE_LABEL[f]}
                <span className="ml-1 text-[10px] opacity-70">({counts[f]})</span>
              </button>
            ))}
          </div>
        </div>

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
              description="Filtrlarni oʻzgartiring"
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              {filtered.length} ta natija
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
