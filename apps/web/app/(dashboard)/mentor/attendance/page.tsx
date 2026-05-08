'use client';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Save,
  Search,
  CheckCheck,
  X as XIcon,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken } from '@/lib/jwt';
import { tashkentToday } from '@/lib/tashkent-date';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';

type AttendanceStatus = 'present' | 'absent' | 'late';

type ApiUser = {
  id: string;
  name: string;
  role: string;
};

type StudentRow = {
  id: string;
  name: string;
  status: AttendanceStatus;
};

const STATUS_CONFIG: {
  status: AttendanceStatus;
  label: string;
  icon: React.ReactNode;
  active: string;
  hoverClass: string;
}[] = [
  {
    status: 'present',
    label: 'Keldi',
    icon: <CheckCircle2 size={14} />,
    active: 'bg-emerald-500 text-white border-emerald-500',
    hoverClass: 'hover:border-emerald-300 hover:bg-emerald-50',
  },
  {
    status: 'absent',
    label: 'Kelmadi',
    icon: <XCircle size={14} />,
    active: 'bg-rose-500 text-white border-rose-500',
    hoverClass: 'hover:border-rose-300 hover:bg-rose-50',
  },
  {
    status: 'late',
    label: 'Kechikdi',
    icon: <Clock size={14} />,
    active: 'bg-amber-500 text-white border-amber-500',
    hoverClass: 'hover:border-amber-300 hover:bg-amber-50',
  },
];

export default function MentorAttendancePage() {
  const { success, error: toastError } = useToast();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [original, setOriginal] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');
  const initialLoadRef = useRef(true);

  const branchId = getBranchIdFromToken();

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      if (!branchId)
        throw new Error("Filial topilmadi. Administrator bilan bog'laning.");
      const res = await apiRequest<ApiUser[]>(
        `/users/by-branch/${branchId}`,
        {},
        token,
      );
      const studentList = res.data
        .filter((u) => u.role === 'student')
        .map((s) => ({
          id: s.id,
          name: s.name,
          status: 'present' as AttendanceStatus,
        }));
      setStudents(studentList);
      setOriginal(studentList);
      initialLoadRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useFocusRevalidate(loadStudents);

  const isDirty = useMemo(() => {
    if (loading) return false;
    if (students.length !== original.length) return true;
    return students.some((s) => {
      const o = original.find((x) => x.id === s.id);
      return !o || s.status !== o.status;
    });
  }, [students, original, loading]);

  function setStatus(id: string, status: AttendanceStatus) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  function markAll(status: AttendanceStatus) {
    setStudents((prev) => prev.map((s) => ({ ...s, status })));
  }

  async function saveAttendance() {
    setSaving(true);
    const today = tashkentToday();
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(
        '/attendance/students',
        {
          method: 'POST',
          body: JSON.stringify({
            date: today,
            records: students.map(({ id, status }) => ({
              studentId: id,
              status,
            })),
          }),
        },
        token,
      );
      localStorage.setItem(`attendance_marked_${today}`, '1');
      setOriginal(students);
      setSaved(true);
      success('Davomat saqlandi');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const present = students.filter((s) => s.status === 'present').length;
    const absent = students.filter((s) => s.status === 'absent').length;
    const late = students.filter((s) => s.status === 'late').length;
    return { present, absent, late };
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, search]);

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-4">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
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
                Bugungi davomat
              </p>
              <p className="text-[#475569] text-[11px] font-bold mt-0.5 font-mono">
                {tashkentToday()}
              </p>
            </div>
          </div>

          {/* 3-tile counters */}
          {!loading && students.length > 0 && (
            <div className="bg-[#162032] border border-white/5 rounded-2xl p-3 grid grid-cols-3">
              <div className="text-center">
                <p className="text-emerald-400 text-2xl font-extrabold font-mono leading-none">
                  {counts.present}
                </p>
                <p className="text-[#94a3b8] text-[10px] mt-1.5 font-bold uppercase tracking-wider">
                  Keldi
                </p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-rose-400 text-2xl font-extrabold font-mono leading-none">
                  {counts.absent}
                </p>
                <p className="text-[#94a3b8] text-[10px] mt-1.5 font-bold uppercase tracking-wider">
                  Kelmadi
                </p>
              </div>
              <div className="text-center">
                <p className="text-amber-400 text-2xl font-extrabold font-mono leading-none">
                  {counts.late}
                </p>
                <p className="text-[#94a3b8] text-[10px] mt-1.5 font-bold uppercase tracking-wider">
                  Kechikdi
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3 max-w-lg mx-auto">
        {!branchId ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center">
            <p className="text-rose-600 text-sm font-bold">
              Filial topilmadi. Administrator bilan bog&apos;laning.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 flex items-center justify-between gap-3"
              >
                <Skeleton theme="light" className="h-5 flex-1 max-w-[180px]" />
                <div className="flex gap-1.5">
                  <Skeleton theme="light" className="h-8 w-16 rounded-xl" />
                  <Skeleton theme="light" className="h-8 w-16 rounded-xl" />
                  <Skeleton theme="light" className="h-8 w-20 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center space-y-3">
            <p className="text-rose-600 text-sm font-bold">{error}</p>
            <Button variant="primary" size="sm" onClick={loadStudents}>
              Qayta urinish
            </Button>
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<Users size={28} />}
              title="Bu filialda o'quvchilar topilmadi"
            />
          </div>
        ) : (
          <>
            {/* Search + bulk action */}
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
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Qidiruvni tozalash"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-1"
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => markAll('present')}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                <CheckCheck size={14} /> Hammani &quot;Keldi&quot; deb belgilash
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center">
                <p className="text-sm font-bold text-[#0f172a]">
                  Mos o&apos;quvchi topilmadi
                </p>
              </div>
            ) : (
              filtered.map((student) => (
                <div
                  key={student.id}
                  className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="font-extrabold text-[#0f172a] text-sm flex-1 truncate">
                    {student.name}
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    {STATUS_CONFIG.map(
                      ({ status, label, icon, active, hoverClass }) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setStatus(student.id, status)}
                          aria-label={label}
                          aria-pressed={student.status === status}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-extrabold border-[1.5px] transition-colors ${
                            student.status === status
                              ? active
                              : `bg-[#f7f4ef] text-[#94a3b8] border-[#ede9e1] ${hoverClass}`
                          }`}
                        >
                          {icon}
                          <span className="hidden sm:inline">{label}</span>
                        </button>
                      ),
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {/* Sticky save bar */}
      {!loading && students.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#f7f4ef] via-[#f7f4ef] to-transparent pt-4 pb-[env(safe-area-inset-bottom)] px-4 pointer-events-none">
          <div className="max-w-lg mx-auto pointer-events-auto pb-2">
            <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 shadow-lg flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full border bg-[#fffaf0] text-[#64748b] border-[#ede9e1] shrink-0">
                <Users size={11} />
                {students.length} ta
              </span>
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                disabled={saving || (!isDirty && !saved)}
                icon={saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
                onClick={saveAttendance}
                className="ml-auto"
              >
                {saved ? 'Saqlandi' : saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
