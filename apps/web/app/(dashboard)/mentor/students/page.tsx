'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  GraduationCap,
  ChevronRight,
  Sparkles,
  Search,
  X as XIcon,
  Users,
  Activity,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { fetchMyBranchId, fetchMyGroupId } from '@/lib/jwt';
import { EmptyState, Skeleton } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';

type Student = { id: string; name: string; role: string };
type StatusColor = '' | 'yashil' | 'sariq' | 'qizil';

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
type StatusRow = {
  studentId?: string;
  student?: { id?: string };
  englishStatus?: string;
  personalStatus?: string;
  criticalStatus?: string;
};

function worstFromRow(r: StatusRow): StatusColor {
  const order: StatusColor[] = ['qizil', 'sariq', 'yashil'];
  for (const want of order) {
    if (
      r.englishStatus === want ||
      r.personalStatus === want ||
      r.criticalStatus === want
    ) {
      return want;
    }
  }
  return '';
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Cycle through 5 gradient tints so the avatar grid reads as a colourful
 * roster instead of a sea of identical violet squares. Same name always
 * lands on the same tint (string-hash → index) so a given student stays
 * recognisable across reloads.
 */
const AVATAR_TINTS: ReadonlyArray<string> = [
  'from-violet-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

function avatarTintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}

export default function MentorStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [statusByStudent, setStatusByStudent] = useState<Record<string, StatusColor>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'yashil' | 'sariq' | 'qizil'>('all');
  const [snapshot, setSnapshot] = useState<SnapshotEntry[]>([]);
  const [snapshotActiveCount, setSnapshotActiveCount] = useState(0);

  const load = useCallback(async () => {
    const token = localStorage.getItem('accessToken') ?? '';
    const [groupId, branchId] = await Promise.all([
      fetchMyGroupId(),
      fetchMyBranchId(),
    ]);
    if (!groupId && !branchId) {
      setError("Filial yoki guruh topilmadi. Administrator bilan bog'laning.");
      setLoading(false);
      return;
    }
    setError('');
    const path = groupId
      ? `/users/group/${groupId}`
      : `/users/by-branch/${branchId}`;
    try {
      const [list, redRes, yellowRes] = await Promise.all([
        apiRequest<Student[]>(path, {}, token),
        apiRequest<StatusRow[]>('/status/red-students', {}, token).catch(() => ({ data: [] as StatusRow[] })),
        apiRequest<StatusRow[]>('/status/yellow-students', {}, token).catch(() => ({ data: [] as StatusRow[] })),
      ]);
      setStudents((list.data ?? []).filter((u) => u.role === 'student'));

      const map: Record<string, StatusColor> = {};
      for (const r of redRes.data ?? []) {
        const id = r.student?.id ?? r.studentId;
        if (id) map[id] = worstFromRow(r);
      }
      for (const r of yellowRes.data ?? []) {
        const id = r.student?.id ?? r.studentId;
        // Don't downgrade an already-red row to yellow.
        if (id && !map[id]) map[id] = worstFromRow(r);
      }
      setStatusByStudent(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'quvchilarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live snapshot: poll every 30s while the tab is open.
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
        // best-effort — silently ignore
      }
    }
    fetchSnapshot();
    const id = setInterval(fetchSnapshot, 30_000);
    return () => clearInterval(id);
  }, []);

  useFocusRevalidate(load);
  useRevalidateOnEvent(['status:updated'], load);

  const statusCounts = useMemo(() => {
    let yashil = 0;
    let sariq = 0;
    let qizil = 0;
    for (const s of students) {
      const colour = statusByStudent[s.id] ?? 'yashil';
      if (colour === 'qizil') qizil++;
      else if (colour === 'sariq') sariq++;
      else yashil++;
    }
    return { yashil, sariq, qizil };
  }, [students, statusByStudent]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (statusFilter !== 'all') {
        const colour = statusByStudent[s.id] ?? 'yashil';
        if (colour !== statusFilter) return false;
      }
      return true;
    });
  }, [students, search, statusFilter, statusByStudent]);

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-4">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-15 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <Link
              href="/mentor"
              aria-label="Orqaga"
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="inline-flex items-center gap-1.5 text-violet-400 text-[10px] font-bold uppercase tracking-widest">
                <GraduationCap size={11} /> O&apos;quvchilar
              </p>
              <p className="text-white text-lg font-extrabold leading-tight">
                AI xato tahlili
              </p>
              <p className="text-[#94a3b8] text-[11px] font-bold mt-0.5">
                O&apos;quvchini tanlang — Gemini tahlilini ko&apos;ring
              </p>
            </div>
          </div>

          {!loading && students.length > 0 && (
            <div className="bg-[#162032] border border-white/5 rounded-2xl px-3 py-2.5 flex items-center gap-2">
              <Users size={14} className="text-violet-400" />
              <p className="text-white text-sm font-extrabold">
                {students.length}
              </p>
              <p className="text-[#94a3b8] text-[11px] font-bold">
                ta o&apos;quvchi guruhda
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3 max-w-lg mx-auto">

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
                    {s.isActive ? timeAgo(s.lastPingAt) : s.lastPingAt ? timeAgo(s.lastPingAt) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Search */}
        {!loading && students.length > 0 && (
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="O'quvchini qidirish..."
              className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Qidiruvni tozalash"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-1"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        )}

        {/* Status filter — surfaces yellow/red students fast without making
            the mentor click into /mentor/group first. */}
        {!loading && students.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'all',    label: 'Hammasi', count: students.length, dot: 'bg-[#94a3b8]' },
              { key: 'yashil', label: 'Yashil',  count: statusCounts.yashil, dot: 'bg-emerald-500' },
              { key: 'sariq',  label: 'Sariq',   count: statusCounts.sariq, dot: 'bg-amber-500' },
              { key: 'qizil',  label: 'Qizil',   count: statusCounts.qizil, dot: 'bg-rose-500' },
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
                <span className="text-[10px] opacity-70 font-mono">{s.count}</span>
              </button>
            ))}
          </div>
        )}

        {error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
            <p className="text-rose-800 text-sm font-bold">{error}</p>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2 rounded-xl text-sm font-extrabold transition-colors"
            >
              Qayta urinish
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 border-[1.5px] border-[#ede9e1] flex items-center gap-3"
              >
                <Skeleton theme="light" className="w-11 h-11 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton theme="light" className="h-4 w-1/2" />
                  <Skeleton theme="light" className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<GraduationCap size={28} />}
              title="O'quvchilar topilmadi"
              description="Bu filialda hali o'quvchilar yo'q"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<Users size={28} />}
              title="Mos o'quvchi topilmadi"
              description="Qidiruvni o'zgartirib ko'ring"
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((student) => {
              const tint = avatarTintFor(student.name);
              return (
                <li key={student.id}>
                  <Link
                    href={`/mentor/students/${student.id}`}
                    className="block bg-white rounded-2xl px-4 py-3.5 border-[1.5px] border-[#ede9e1] hover:border-violet-300 hover:bg-violet-50/30 transition-colors flex items-center gap-3"
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${tint} flex items-center justify-center text-white text-sm font-extrabold shrink-0`}
                    >
                      {getInitials(student.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#0f172a] font-extrabold text-sm truncate">
                        {student.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Sparkles size={10} className="text-violet-500" />
                        <span className="text-[11px] text-violet-700 font-bold">
                          AI tahlilini ko&apos;rish
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-[#94a3b8] shrink-0"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
