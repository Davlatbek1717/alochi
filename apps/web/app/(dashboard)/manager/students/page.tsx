'use client';
import { useEffect, useMemo, useState } from 'react';
import { Users, Search, X } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Skeleton, useToast } from '@/components/ui';
import { getBranchIdFromToken, getGroupIdFromToken } from '@/lib/jwt';
import { UserCard, type UserStatusColor } from '../../_components/UserCard';

type Student = {
  id: string;
  name: string;
  role: string;
  status?: string;
};

type StatusRow = {
  studentId: string;
  englishStatus?: string;
  personalStatus?: string;
  criticalStatus?: string;
};

type StatusFilter = 'all' | 'yashil' | 'sariq' | 'qizil';

const FILTER_LABEL: Record<StatusFilter, string> = {
  all: 'Hammasi',
  yashil: 'Yashil',
  sariq: 'Sariq',
  qizil: 'Qizil',
};

function worstStatus(row?: StatusRow): UserStatusColor {
  if (!row) return '';
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

export default function ManagerStudentsPage() {
  const toast = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [statusByStudent, setStatusByStudent] = useState<Record<string, UserStatusColor>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const groupId = getGroupIdFromToken();
    const branchId = getBranchIdFromToken();

    async function load() {
      try {
        const list = groupId
          ? await apiRequest<Student[]>(`/users/group/${groupId}`, {}, token)
          : branchId
            ? await apiRequest<Student[]>(`/users/by-branch/${branchId}`, {}, token)
            : { data: [] as Student[] };

        const onlyStudents = (list.data ?? []).filter((u) => u.role === 'student');
        setStudents(onlyStudents);

        // Pull current statuses (bulk endpoint not strictly required —
        // we fall back to red/yellow lists which the manager dashboard already uses).
        const [redRes, yellowRes] = await Promise.all([
          apiRequest<Array<{ studentId: string; student: { id: string }; englishStatus: string; personalStatus: string; criticalStatus: string }>>(
            '/status/red-students',
            {},
            token,
          ).catch(() => ({ data: [] })),
          apiRequest<Array<{ studentId: string; student: { id: string }; englishStatus: string; personalStatus: string; criticalStatus: string }>>(
            '/status/yellow-students',
            {},
            token,
          ).catch(() => ({ data: [] })),
        ]);

        const map: Record<string, UserStatusColor> = {};
        for (const s of redRes.data ?? []) {
          map[s.student?.id ?? s.studentId] = worstStatus(s);
        }
        for (const s of yellowRes.data ?? []) {
          const id = s.student?.id ?? s.studentId;
          if (!map[id]) map[id] = worstStatus(s);
        }
        // Default everyone else green (no flag).
        for (const u of onlyStudents) {
          if (!map[u.id]) map[u.id] = 'yashil';
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
    return students.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (filter === 'all') return true;
      return statusByStudent[s.id] === filter;
    });
  }, [students, statusByStudent, query, filter]);

  const counts = useMemo(() => {
    const c = { yashil: 0, sariq: 0, qizil: 0 };
    for (const s of students) {
      const st = statusByStudent[s.id];
      if (st === 'yashil') c.yashil++;
      else if (st === 'sariq') c.sariq++;
      else if (st === 'qizil') c.qizil++;
    }
    return c;
  }, [students, statusByStudent]);

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0d9488]/15 border border-[#0d9488]/30 flex items-center justify-center">
            <Users size={20} className="text-[#0d9488]" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">Manager</p>
            <p className="text-white text-lg font-bold">Oʻquvchilar</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Ism boʻyicha qidirish"
            placeholder="Ism boʻyicha qidirish..."
            className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0d9488] focus:ring-2 focus:ring-[#0d9488]/20 placeholder:text-[#94a3b8]"
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

        {/* Status filter chips — matches the unified design language */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest">Holat</p>
          <div className="flex flex-wrap gap-1.5">
            {([
              { key: 'all',    label: 'Hammasi', count: students.length, dot: 'bg-[#94a3b8]' },
              { key: 'yashil', label: 'Yashil',  count: counts.yashil,   dot: 'bg-emerald-500' },
              { key: 'sariq',  label: 'Sariq',   count: counts.sariq,    dot: 'bg-amber-500' },
              { key: 'qizil',  label: 'Qizil',   count: counts.qizil,    dot: 'bg-rose-500' },
            ] as { key: StatusFilter; label: string; count: number; dot: string }[]).map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setFilter(s.key)}
                aria-pressed={filter === s.key}
                className={`px-3 py-1.5 min-h-[32px] rounded-full text-xs font-bold transition-colors border inline-flex items-center gap-1.5 ${
                  filter === s.key
                    ? 'bg-[#0f172a] text-white border-[#0f172a]'
                    : 'bg-white text-[#0f172a] border-[#ede9e1] hover:border-[#0f172a]/40'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                {s.label}
                <span className="text-[10px] opacity-70 font-mono">{s.count}</span>
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
              title="Oʻquvchi yoʻq"
              description={query || filter !== 'all' ? 'Filtrlarni oʻzgartiring' : 'Guruhda hali oʻquvchi yoʻq'}
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              {filtered.length === students.length
                ? `${students.length} ta oʻquvchi`
                : `${filtered.length} / ${students.length} ta oʻquvchi`}
            </p>
            {filtered.map((s) => (
              <UserCard
                key={s.id}
                id={s.id}
                name={s.name}
                status={statusByStudent[s.id] ?? ''}
                href={`/manager/students/${s.id}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
