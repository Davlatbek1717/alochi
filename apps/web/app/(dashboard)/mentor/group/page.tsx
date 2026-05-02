'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  CheckCircle2,
  XCircle,
  Save,
  ArrowLeft,
  Search,
  Sparkles,
  CheckCheck,
  Filter,
  X,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken, getGroupIdFromToken } from '@/lib/jwt';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';

type Status = 'green' | 'yellow' | 'red';

const STATUS_DOT: Record<Status, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-rose-500',
};

const STATUS_BG: Record<Status, string> = {
  green: 'bg-emerald-50 ring-emerald-300',
  yellow: 'bg-amber-50 ring-amber-300',
  red: 'bg-rose-50 ring-rose-300',
};

const STATUS_LABEL: Record<Status, string> = {
  green: 'Yaxshi',
  yellow: 'Diqqat',
  red: "E'tibor",
};

const STATUS_UZ: Record<Status, string> = {
  green: 'yashil',
  yellow: 'sariq',
  red: 'qizil',
};

type LocalStudent = {
  id: string;
  name: string;
  status: Status;
  note: string;
  attendance: boolean;
};
type ApiStudent = { id: string; name: string; role: string };

type FilterMode = 'all' | 'present' | 'absent' | 'attention';

export default function MentorGroupPage() {
  const { success, error: toastError } = useToast();
  const [students, setStudents] = useState<LocalStudent[]>([]);
  const [original, setOriginal] = useState<LocalStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const groupId = getGroupIdFromToken();
      const branchId = getBranchIdFromToken();
      if (!groupId && !branchId) throw new Error('Guruh yoki filial topilmadi');
      const path = groupId
        ? `/users/group/${groupId}`
        : `/users/by-branch/${branchId}`;
      const res = await apiRequest<ApiStudent[]>(path, {}, token);
      const list = res.data
        .filter((u) => u.role === 'student')
        .map((s) => ({
          ...s,
          status: 'green' as Status,
          note: '',
          attendance: true,
        }));
      setStudents(list);
      setOriginal(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  function updateStatus(id: string, status: Status) {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status, note: status === 'green' ? '' : s.note } : s,
      ),
    );
  }
  function updateNote(id: string, note: string) {
    setStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, note } : s)),
    );
  }
  function toggleAttendance(id: string) {
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, attendance: !s.attendance } : s,
      ),
    );
  }

  // Bulk actions for fast daily marking — the most common case is
  // "everyone showed up", and forcing the mentor to tap each row is a
  // 30-tap chore. One button handles 90% of the days.
  function markAllPresent() {
    setStudents((prev) => prev.map((s) => ({ ...s, attendance: true })));
  }
  function markAllGreen() {
    setStudents((prev) =>
      prev.map((s) => ({ ...s, status: 'green' as Status, note: '' })),
    );
  }

  async function saveAll() {
    setSaving(true);
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as {
      id?: string;
      tenantId?: string;
      branchId?: string;
    };
    const branchId = getBranchIdFromToken() ?? user.branchId ?? '';
    const today = new Date().toISOString().split('T')[0];
    try {
      await apiRequest(
        '/attendance/students',
        {
          method: 'POST',
          body: JSON.stringify({
            records: students.map((s) => ({
              studentId: s.id,
              status: s.attendance ? 'present' : 'absent',
              markedBy: user.id ?? '',
              tenantId: user.tenantId ?? '',
              branchId,
              date: today,
            })),
          }),
        },
        token,
      );
      await Promise.all(
        students.map((s) =>
          apiRequest(
            '/status/personal',
            {
              method: 'POST',
              body: JSON.stringify({
                studentId: s.id,
                date: today,
                color: STATUS_UZ[s.status],
                note: s.note || undefined,
              }),
            },
            token,
          ),
        ),
      );
      localStorage.setItem(`attendance_marked_${today}`, '1');
      setOriginal(students);
      success('Davomat saqlandi');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  }

  // Aggregate counts for the header strip + filter chip subtitles.
  const counts = useMemo(() => {
    const present = students.filter((s) => s.attendance).length;
    const absent = students.length - present;
    const green = students.filter((s) => s.attendance && s.status === 'green').length;
    const yellow = students.filter((s) => s.attendance && s.status === 'yellow').length;
    const red = students.filter((s) => s.attendance && s.status === 'red').length;
    return { present, absent, green, yellow, red };
  }, [students]);

  const isDirty = useMemo(() => {
    if (loading) return false;
    if (students.length !== original.length) return true;
    return students.some((s) => {
      const o = original.find((x) => x.id === s.id);
      if (!o) return true;
      return (
        s.status !== o.status ||
        s.note !== o.note ||
        s.attendance !== o.attendance
      );
    });
  }, [students, original, loading]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q)) return false;
      if (filterMode === 'present' && !s.attendance) return false;
      if (filterMode === 'absent' && s.attendance) return false;
      if (
        filterMode === 'attention' &&
        !(s.attendance && s.status !== 'green')
      )
        return false;
      return true;
    });
  }, [students, search, filterMode]);

  const filters: { key: FilterMode; label: string; count: number }[] = [
    { key: 'all', label: 'Hammasi', count: students.length },
    { key: 'present', label: 'Keldi', count: counts.present },
    { key: 'absent', label: 'Kelmadi', count: counts.absent },
    { key: 'attention', label: "E'tibor", count: counts.yellow + counts.red },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-5">
          <Skeleton className="h-3 w-16 mb-1" />
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        </div>
        <div className="px-4 pt-5 pb-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4"
            >
              <div className="flex items-center gap-3">
                <Skeleton theme="light" className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton theme="light" className="h-4 w-1/2" />
                  <Skeleton theme="light" className="h-3 w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center max-w-sm w-full space-y-3">
          <p className="text-rose-500 text-sm font-bold">{error}</p>
          <Button variant="primary" onClick={loadStudents}>
            Qayta urinish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] pb-32">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
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
              <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">
                Mentor
              </p>
              <p className="text-white text-lg font-extrabold leading-tight">
                Guruh boshqaruvi
              </p>
            </div>
          </div>

          {/* Header stats — present/absent + green/yellow/red */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#162032] border border-white/5 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Users size={11} className="text-emerald-400" />
                <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">
                  Davomat
                </p>
              </div>
              <p className="text-white text-xl font-extrabold leading-tight font-mono">
                {counts.present}
                <span className="text-[#475569] text-base"> / {students.length}</span>
              </p>
              <p className="text-[#475569] text-[10px] mt-0.5 font-bold">
                {counts.absent} kelmadi
              </p>
            </div>
            <div className="bg-[#162032] border border-white/5 rounded-2xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles size={11} className="text-amber-400" />
                <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">
                  Holat
                </p>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-extrabold font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  {counts.green}
                </span>
                <span className="inline-flex items-center gap-1 text-amber-400 text-xs font-extrabold font-mono">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {counts.yellow}
                </span>
                <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-extrabold font-mono">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  {counts.red}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3 max-w-lg mx-auto">
        {/* Search + bulk actions */}
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 space-y-3">
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
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#0f172a]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Qidiruvni tozalash"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllPresent}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors"
            >
              <CheckCheck size={14} /> Hamma keldi
            </button>
            <button
              type="button"
              onClick={markAllGreen}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-[#0f172a] bg-[#f7f4ef] border border-[#ede9e1] px-3 py-2 rounded-xl hover:bg-[#ede9e1] transition-colors"
            >
              <Sparkles size={14} className="text-emerald-500" />
              Hammasi yashil
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 w-max">
            {filters.map((f) => {
              const isActive = filterMode === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilterMode(f.key)}
                  className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full border transition-colors ${
                    isActive
                      ? 'bg-[#0f172a] text-white border-[#0f172a]'
                      : 'bg-white text-[#64748b] border-[#ede9e1] hover:bg-[#fffaf0]'
                  }`}
                >
                  {f.key === 'attention' && <Filter size={11} />}
                  {f.label}
                  <span className={isActive ? 'text-white/80' : 'text-[#94a3b8]'}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Student list */}
        {students.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<Users size={28} />}
              title="Guruhda o'quvchilar yo'q"
              description="Bu filialda o'quvchilar topilmadi"
            />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center">
            <p className="text-sm font-bold text-[#0f172a]">
              Filtrga mos o&apos;quvchi topilmadi
            </p>
            <p className="text-xs text-[#64748b] mt-1">
              Qidiruv yoki filtrni o&apos;zgartirib ko&apos;ring
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredStudents.map((student) => (
              <StudentCard
                key={student.id}
                student={student}
                onAttendance={() => toggleAttendance(student.id)}
                onStatus={(s) => updateStatus(student.id, s)}
                onNote={(n) => updateNote(student.id, n)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#f7f4ef] via-[#f7f4ef] to-transparent pt-4 pb-[env(safe-area-inset-bottom)] px-4 pointer-events-none">
        <div className="max-w-lg mx-auto pointer-events-auto pb-2">
          <div
            className={`rounded-2xl border-[1.5px] p-3 shadow-lg transition-all ${
              isDirty
                ? 'bg-white border-[#f59e0b]/40'
                : 'bg-white border-[#ede9e1]'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full border shrink-0 ${
                  isDirty
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isDirty ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                {isDirty ? "O'zgarish bor" : 'Saqlangan'}
              </span>
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                disabled={!isDirty || saving}
                icon={<Save size={14} />}
                onClick={saveAll}
                className="ml-auto"
              >
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentCard({
  student,
  onAttendance,
  onStatus,
  onNote,
}: {
  student: LocalStudent;
  onAttendance: () => void;
  onStatus: (s: Status) => void;
  onNote: (note: string) => void;
}) {
  const initials = student.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <li
      className={`bg-white rounded-2xl border-[1.5px] p-3 transition-opacity ${
        student.attendance ? 'border-[#ede9e1]' : 'border-[#ede9e1] opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Attendance toggle — colored avatar */}
        <button
          type="button"
          onClick={onAttendance}
          aria-label={
            student.attendance ? 'Kelmagan deb belgilash' : 'Kelgan deb belgilash'
          }
          aria-pressed={student.attendance}
          className={`relative w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-white font-extrabold text-sm transition-colors ${
            student.attendance
              ? 'bg-gradient-to-br from-emerald-400 to-emerald-600'
              : 'bg-[#94a3b8]'
          }`}
        >
          {initials}
          <span
            className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
              student.attendance ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          >
            {student.attendance ? (
              <CheckCircle2 size={10} className="text-white" />
            ) : (
              <XCircle size={10} className="text-white" />
            )}
          </span>
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-extrabold text-[#0f172a] truncate">
            {student.name}
          </p>
          <Link
            href={`/mentor/students/${student.id}`}
            className="text-[11px] text-[#0d9488] font-bold inline-flex items-center gap-1"
          >
            <Sparkles size={10} /> AI xato tahlili
          </Link>
        </div>

        {/* Status segmented control */}
        <div className="flex gap-1 shrink-0">
          {(['green', 'yellow', 'red'] as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStatus(s)}
              aria-label={STATUS_LABEL[s]}
              aria-pressed={student.status === s}
              title={STATUS_LABEL[s]}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                student.status === s
                  ? `ring-2 ${STATUS_BG[s]}`
                  : 'bg-[#f7f4ef] hover:bg-[#ede9e1]'
              }`}
            >
              <span className={`w-3 h-3 rounded-full ${STATUS_DOT[s]}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Note input — only shown for non-green status, where context matters */}
      {student.status !== 'green' && student.attendance && (
        <input
          type="text"
          placeholder="Izoh (ixtiyoriy)..."
          aria-label={`${student.name} uchun izoh`}
          value={student.note}
          onChange={(e) => onNote(e.target.value)}
          className="mt-3 w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
        />
      )}
    </li>
  );
}
