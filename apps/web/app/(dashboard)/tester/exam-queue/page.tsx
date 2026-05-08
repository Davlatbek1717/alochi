'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckCircle,
  Clock,
  UserX,
  PlayCircle,
  Users,
  BookOpen,
  ChevronDown,
  GraduationCap,
  Search,
  X as XIcon,
  CheckCheck,
  ArrowLeft,
  Timer,
  XCircle,
  History,
  FlaskConical,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken } from '@/lib/jwt';
import { tashkentToday } from '@/lib/tashkent-date';
import { Button, EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

interface Student { id: string; name: string; }
interface AttendanceRecord { studentId: string; status: string; student: { id: string; name: string }; }
interface Lesson { id: string; title: string; orderNumber: number; hasExam: boolean; }
interface CatalogueExam {
  id: string;
  title: string;
  description: string | null;
  passThreshold: number;
  timeLimitMinutes: number | null;
  _count: { questions: number };
}
type ExamSource = 'lesson' | 'catalogue';
type QueueStatus = 'waiting' | 'testing' | 'done' | 'absent';
interface StudentRow {
  id: string;
  name: string;
  attendance: 'present' | 'absent' | null;
  queue: QueueStatus;
  activeExamId?: string;
}

// Track granted exams for history footer
interface GrantedEntry {
  studentId: string;
  studentName: string;
  subjectTitle: string;
  subjectKind: 'Katalog' | 'Dars';
  grantedAt: Date;
  result: 'Hisoblanmoqda' | 'Tugatdi';
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// Elapsed-time hook: returns "MM:SS" string, updates every second
function useElapsedTimer(startTime: Date | null): string {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startTime) { setElapsed(0); return; }
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type ChipFilter = 'all' | 'arrived' | 'waiting' | 'done';

const QUEUE_LABEL: Record<QueueStatus, string> = {
  waiting: 'Navbatda', testing: 'Topshirmoqda', done: 'Tugadi', absent: 'Kelmadi',
};

export default function TesterExamQueuePage() {
  const { error: toastError, success } = useToast();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [catalogueExams, setCatalogueExams] = useState<CatalogueExam[]>([]);

  // Search + filter state
  const [search, setSearch] = useState('');
  const [chipFilter, setChipFilter] = useState<ChipFilter>('all');

  // Bulk "mark all present" loading
  const [bulkLoading, setBulkLoading] = useState(false);

  // Active session state
  const [testingStartTime, setTestingStartTime] = useState<Date | null>(null);
  const [testingSubjectTitle, setTestingSubjectTitle] = useState('');
  const [testingSubjectKind, setTestingSubjectKind] = useState<'Katalog' | 'Dars'>('Katalog');
  const [testingQuestionCount, setTestingQuestionCount] = useState<number | null>(null);
  const elapsed = useElapsedTimer(testingStartTime);

  // Granted history
  const [grantedHistory, setGrantedHistory] = useState<GrantedEntry[]>([]);

  // Grant modal state
  const [grantModal, setGrantModal] = useState<{ studentId: string; name: string } | null>(null);
  const [grantSource, setGrantSource] = useState<ExamSource>('lesson');
  const [selectedLesson, setSelectedLesson] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState('');

  // Per-student action in-flight tracking (A9)
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  const today = tashkentToday();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken') ?? '';
    const branchId = getBranchIdFromToken();
    if (!branchId) { setError('Branch topilmadi'); setLoading(false); return; }

    try {
      const [studentsRes, attendanceRes, lessonsRes, examsRes] = await Promise.all([
        apiRequest<Student[]>(`/users?branchId=${branchId}&role=student`, {}, token),
        apiRequest<AttendanceRecord[]>(`/attendance/students/${branchId}/${today}`, {}, token)
          .catch(() => ({ data: [] as AttendanceRecord[] })),
        apiRequest<Lesson[]>('/lessons', {}, token).catch(() => ({ data: [] as Lesson[] })),
        apiRequest<CatalogueExam[]>('/exams/available', {}, token).catch(() => ({ data: [] as CatalogueExam[] })),
      ]);

      const attendanceMap = new Map(attendanceRes.data.map((a) => [a.studentId, a.status]));
      setLessons(lessonsRes.data.filter((l) => l.hasExam));
      setCatalogueExams(examsRes.data);
      setRows(studentsRes.data.map((s) => {
        const att = attendanceMap.get(s.id);
        return {
          id: s.id, name: s.name,
          attendance: att === 'present' ? 'present' : att === 'absent' ? 'absent' : null,
          queue: att === 'absent' ? 'absent' : 'waiting',
        };
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  async function markPresent(studentId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest('/attendance/students', {
        method: 'POST',
        body: JSON.stringify({ date: today, records: [{ studentId, status: 'present' }] }),
      }, token);
      setRows((prev) => prev.map((r) => r.id === studentId ? { ...r, attendance: 'present', queue: 'waiting' } : r));
      success('Davomat belgilandi');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  async function markAllPresent() {
    const notArrived = rows.filter((r) => r.attendance !== 'present');
    if (notArrived.length === 0) return;
    setBulkLoading(true);
    const token = localStorage.getItem('accessToken') ?? '';
    // A3: use Promise.allSettled so a single failure doesn't abort all UI updates
    const results = await Promise.allSettled(
      notArrived.map((s) =>
        apiRequest('/attendance/students', {
          method: 'POST',
          body: JSON.stringify({ date: today, records: [{ studentId: s.id, status: 'present' }] }),
        }, token),
      ),
    );

    const succeeded = notArrived.filter((_, i) => results[i].status === 'fulfilled');
    const failedCount = notArrived.length - succeeded.length;

    if (succeeded.length > 0) {
      const succeededIds = new Set(succeeded.map((s) => s.id));
      setRows((prev) => prev.map((r) =>
        succeededIds.has(r.id) ? { ...r, attendance: 'present', queue: 'waiting' } : r,
      ));
      success(`${succeeded.length} ta o'quvchi keldi deb belgilandi`);
    }
    if (failedCount > 0) {
      toastError(`${failedCount} ta o'quvchi saqlanmadi — qayta urinib ko'ring`);
    }
    setBulkLoading(false);
  }

  function openGrantModal(student: StudentRow) {
    setGrantModal({ studentId: student.id, name: student.name });
    const defaultSource: ExamSource = catalogueExams.length > 0 ? 'catalogue' : 'lesson';
    setGrantSource(defaultSource);
    setSelectedLesson(lessons[0]?.id ?? '');
    setSelectedExam(catalogueExams[0]?.id ?? '');
    setGrantError('');
  }

  async function handleGrant() {
    if (!grantModal) return;
    const targetId = grantSource === 'lesson' ? selectedLesson : selectedExam;
    if (!targetId) return;
    setGranting(true);
    setGrantError('');
    const token = localStorage.getItem('accessToken') ?? '';

    // Resolve the human-readable subject info before the API call
    const subjectTitle = grantSource === 'lesson'
      ? (lessons.find((l) => l.id === targetId)?.title ?? 'Dars imtihoni')
      : (catalogueExams.find((e) => e.id === targetId)?.title ?? 'Katalog imtihoni');
    const subjectKind: 'Katalog' | 'Dars' = grantSource === 'catalogue' ? 'Katalog' : 'Dars';
    const questionCount = grantSource === 'catalogue'
      ? (catalogueExams.find((e) => e.id === targetId)?._count.questions ?? null)
      : null;

    try {
      const body =
        grantSource === 'lesson'
          ? { studentId: grantModal.studentId, lessonId: targetId }
          : { studentId: grantModal.studentId, examId: targetId };
      const grantRes = await apiRequest<{ id: string }>(
        '/exams/grant',
        { method: 'POST', body: JSON.stringify(body) },
        token,
      );

      const activeExamId = grantRes.data?.id;
      const now = new Date();
      setRows((prev) => prev.map((r) =>
        r.id === grantModal.studentId ? { ...r, queue: 'testing', activeExamId } : r,
      ));
      setTestingStartTime(now);
      setTestingSubjectTitle(subjectTitle);
      setTestingSubjectKind(subjectKind);
      setTestingQuestionCount(questionCount);

      // Add to history
      setGrantedHistory((prev) => [
        {
          studentId: grantModal.studentId,
          studentName: grantModal.name,
          subjectTitle,
          subjectKind,
          grantedAt: now,
          result: 'Hisoblanmoqda',
        },
        ...prev.slice(0, 4),
      ]);

      success("Imtihon ruxsati berildi");
      setGrantModal(null);
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setGranting(false);
    }
  }

  async function setDone(studentId: string) {
    const row = rows.find((r) => r.id === studentId);
    if (!row?.activeExamId) {
      // No activeExamId stored (e.g. page was refreshed) — just update local state
      setRows((prev) => prev.map((r) => r.id === studentId ? { ...r, queue: 'done' } : r));
      setGrantedHistory((prev) => {
        const idx = prev.findIndex((e) => e.studentId === studentId && e.result === 'Hisoblanmoqda');
        if (idx === -1) return prev;
        return prev.map((e, i) => i === idx ? { ...e, result: 'Tugatdi' as const } : e);
      });
      setTestingStartTime(null);
      return;
    }

    const token = localStorage.getItem('accessToken') ?? '';
    setPendingActions((prev) => new Set(prev).add(studentId));
    try {
      await apiRequest(`/exams/${row.activeExamId}/cancel`, { method: 'PATCH' }, token);
      setRows((prev) => prev.map((r) => r.id === studentId ? { ...r, queue: 'done', activeExamId: undefined } : r));
      setGrantedHistory((prev) => {
        const idx = prev.findIndex((e) => e.studentId === studentId && e.result === 'Hisoblanmoqda');
        if (idx === -1) return prev;
        return prev.map((e, i) => i === idx ? { ...e, result: 'Tugatdi' as const } : e);
      });
      setTestingStartTime(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Serverda xatolik — qayta urinib ko'ring");
    } finally {
      setPendingActions((prev) => { const s = new Set(prev); s.delete(studentId); return s; });
    }
  }

  async function cancelTesting(studentId: string) {
    const row = rows.find((r) => r.id === studentId);
    if (!row?.activeExamId) {
      // No activeExamId stored — just reset locally
      setRows((prev) => prev.map((r) => r.id === studentId ? { ...r, queue: 'waiting' } : r));
      setTestingStartTime(null);
      return;
    }

    const token = localStorage.getItem('accessToken') ?? '';
    setPendingActions((prev) => new Set(prev).add(studentId));
    try {
      await apiRequest(`/exams/${row.activeExamId}/cancel`, { method: 'PATCH' }, token);
      setRows((prev) => prev.map((r) => r.id === studentId ? { ...r, queue: 'waiting', activeExamId: undefined } : r));
      setTestingStartTime(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Serverda xatolik — qayta urinib ko'ring");
    } finally {
      setPendingActions((prev) => { const s = new Set(prev); s.delete(studentId); return s; });
    }
  }

  // Computed groups
  const arrived = rows.filter((r) => r.attendance === 'present');
  const notArrived = rows.filter((r) => r.attendance !== 'present');
  const testingNow = rows.find((r) => r.queue === 'testing');
  const doneCount = rows.filter((r) => r.queue === 'done').length;
  const waitingCount = arrived.filter((r) => r.queue === 'waiting').length;

  // Chips
  const chipCounts = {
    all: rows.length,
    arrived: arrived.length,
    waiting: waitingCount,
    done: doneCount,
  };

  // Filter rows for the lists
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (chipFilter === 'arrived') return r.attendance === 'present';
      if (chipFilter === 'waiting') return r.queue === 'waiting';
      if (chipFilter === 'done') return r.queue === 'done';
      return true;
    });
  }, [rows, search, chipFilter]);

  const filteredArrived = filteredRows.filter((r) => r.attendance === 'present');
  const filteredNotArrived = filteredRows.filter((r) => r.attendance !== 'present');

  const chips: { key: ChipFilter; label: string }[] = [
    { key: 'all', label: 'Hammasi' },
    { key: 'arrived', label: 'Kelganlar' },
    { key: 'waiting', label: 'Kutmoqda' },
    { key: 'done', label: 'Tugatdi' },
  ];

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-10">
      {/* Header — dark navy + amber accent (staff theme) */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-15 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 space-y-4">
          {/* Back + title row */}
          <div className="flex items-center gap-3">
            <Link
              href="/tester"
              aria-label="Orqaga"
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">Tester</p>
              <p className="text-white text-lg font-extrabold leading-tight">Bugungi navbat</p>
              <p className="text-[#475569] text-[11px] font-bold mt-0.5 font-mono">{today}</p>
            </div>
          </div>

          {/* Stats grid — 4 tiles */}
          {loading ? (
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[#162032] rounded-[14px] p-3 space-y-1">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-6 w-8" />
                  <Skeleton className="h-2.5 w-10" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <StatTile icon={<Users size={13} className="text-[#f59e0b]" />} value={arrived.length} label="Keldi" />
              <StatTile icon={<CheckCircle size={13} className="text-emerald-400" />} value={doneCount} label="Topshirdi" />
              <StatTile icon={<Clock size={13} className="text-blue-400" />} value={waitingCount} label="Kutmoqda" />
              <StatTile icon={<FlaskConical size={13} className="text-rose-400" />} value={rows.length} label="Jami" />
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-4 max-w-lg mx-auto">
        {error && (
          <div className="bg-rose-50 border-[1.5px] border-rose-200 rounded-2xl px-4 py-3">
            <p className="text-rose-700 text-sm font-bold">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] px-4 py-3 flex items-center gap-3">
                <Skeleton theme="light" className="w-9 h-9 rounded-xl shrink-0" />
                <Skeleton theme="light" className="h-4 flex-1" />
                <Skeleton theme="light" className="h-8 w-20 rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Search bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
              <input
                id="exam-queue-search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="O'quvchi ismi bo'yicha qidirish..."
                aria-label="O'quvchi ismi bo'yicha qidirish"
                className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 focus:border-[#0f172a]"
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

            {/* Filter chips */}
            <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-0.5">
              {chips.map((c) => {
                const isActive = chipFilter === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setChipFilter(c.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-[#0f172a] text-white border-[#0f172a]'
                        : 'bg-white text-[#64748b] border-[#ede9e1] hover:bg-[#fffaf0]'
                    }`}
                  >
                    {c.label}
                    <span className={isActive ? 'text-white/80' : 'text-[#94a3b8]'}>
                      {chipCounts[c.key]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active session card */}
            {testingNow && (
              <div className="bg-gradient-to-br from-[#1a2e4a] to-[#1e293b] rounded-2xl p-4 border border-amber-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <PlayCircle size={14} className="text-amber-400" />
                  <span className="text-amber-400 text-xs font-extrabold uppercase tracking-widest">Hozir topshirmoqda</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-300 font-black text-sm shrink-0">
                    {getInitials(testingNow.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-base font-extrabold truncate">{testingNow.name}</p>
                    {testingSubjectTitle && (
                      <p className="text-[#94a3b8] text-xs font-bold truncate">
                        <span className="text-amber-400">{testingSubjectKind}</span> · {testingSubjectTitle}
                      </p>
                    )}
                  </div>
                  {/* Elapsed timer */}
                  <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1.5 shrink-0">
                    <Timer size={12} className="text-amber-400" />
                    <span className="text-amber-300 text-xs font-extrabold font-mono">{elapsed}</span>
                  </div>
                </div>
                {testingQuestionCount !== null && (
                  <p className="text-[#64748b] text-xs mb-3">
                    Topshirayapti — <span className="text-white font-bold">{testingQuestionCount} ta savol bor</span>
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    icon={<CheckCircle size={14} />}
                    onClick={() => setDone(testingNow.id)}
                    disabled={pendingActions.has(testingNow.id)}
                    className="flex-1"
                  >
                    {pendingActions.has(testingNow.id) ? 'Saqlanmoqda...' : 'Tugatdi'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => cancelTesting(testingNow.id)}
                    disabled={pendingActions.has(testingNow.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#94a3b8] bg-white/10 border border-white/10 px-3 py-2 rounded-xl hover:bg-white/15 transition-colors disabled:opacity-60"
                  >
                    <XCircle size={13} />
                    Bekor qilish
                  </button>
                </div>
              </div>
            )}

            {/* Arrived list */}
            {filteredArrived.length > 0 && (
              <div>
                <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
                  Kelganlar — {arrived.length}/{rows.length}
                </p>
                <div className="space-y-2">
                  {filteredArrived.map((s) => {
                    const isDone = s.queue === 'done';
                    const isTesting = s.queue === 'testing';
                    const isWaiting = s.queue === 'waiting';
                    return (
                      <div key={s.id} className={`bg-white rounded-2xl px-4 py-3 border-[1.5px] flex items-center gap-3 ${
                        isDone ? 'border-emerald-100' : isTesting ? 'border-amber-200' : 'border-[#ede9e1]'
                      }`}>
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                          isDone ? 'bg-emerald-100 text-emerald-700' : isTesting ? 'bg-amber-100 text-amber-700' : 'bg-[#f7f4ef] text-[#0f172a]'
                        }`}>
                          {isDone ? <CheckCircle size={16} /> : getInitials(s.name)}
                        </div>
                        <p className={`flex-1 text-sm font-extrabold truncate ${isDone ? 'text-[#94a3b8] line-through' : 'text-[#0f172a]'}`}>
                          {s.name}
                        </p>
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border shrink-0 ${
                          isDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          isTesting ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]'
                        }`}>
                          {QUEUE_LABEL[s.queue]}
                        </span>
                        {isWaiting && (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<BookOpen size={12} />}
                            disabled={!!testingNow || (lessons.length === 0 && catalogueExams.length === 0)}
                            onClick={() => openGrantModal(s)}
                          >
                            Boshlash
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Not-arrived list */}
            {filteredNotArrived.length > 0 && (
              <div>
                <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest mb-2.5 px-1">
                  Kutilmoqda — {notArrived.length} ta
                </p>
                {/* Bulk "mark all present" — only when not arrived exist */}
                {notArrived.length > 0 && chipFilter !== 'arrived' && chipFilter !== 'done' && (
                  <button
                    type="button"
                    onClick={markAllPresent}
                    disabled={bulkLoading}
                    className="w-full mb-2 inline-flex items-center justify-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2.5 rounded-xl hover:bg-emerald-100 transition-colors disabled:opacity-60"
                  >
                    {bulkLoading ? (
                      <span className="inline-flex items-center gap-1.5"><Clock size={13} className="animate-spin" /> Belgilanmoqda...</span>
                    ) : (
                      <><CheckCheck size={13} /> Hammani Keldi deb belgilash</>
                    )}
                  </button>
                )}
                <div className="space-y-2">
                  {filteredNotArrived.map((s) => (
                    <div key={s.id} className="bg-white rounded-2xl px-4 py-3 border-[1.5px] border-[#ede9e1] flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#94a3b8] shrink-0">
                        <UserX size={16} />
                      </div>
                      <p className="flex-1 text-sm text-[#94a3b8] font-bold truncate">{s.name}</p>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => markPresent(s.id)}
                      >
                        Keldi
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {rows.length === 0 && !error && (
              <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1]">
                <EmptyState
                  theme="light"
                  icon={<Users size={28} />}
                  title="O'quvchilar topilmadi"
                  description="Bu filialda o'quvchilar ro'yxatga olinmagan"
                />
              </div>
            )}

            {/* No filter results */}
            {rows.length > 0 && filteredRows.length === 0 && (
              <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center">
                <p className="text-sm font-extrabold text-[#0f172a]">Natija topilmadi</p>
                <p className="text-xs text-[#64748b] mt-1">Qidiruv yoki filtrni o&apos;zgartiring</p>
              </div>
            )}

            {/* Granted history footer */}
            {grantedHistory.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <History size={13} className="text-[#64748b]" />
                  <p className="text-xs font-extrabold text-[#0f172a] uppercase tracking-widest">Bugungi tarix</p>
                </div>
                <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] divide-y divide-[#ede9e1]">
                  {grantedHistory.map((entry, i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 font-black text-[10px] shrink-0">
                        {getInitials(entry.studentName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-extrabold text-[#0f172a] truncate">{entry.studentName}</p>
                        <p className="text-[11px] text-[#64748b] font-bold truncate">
                          <span className="text-amber-700">{entry.subjectKind}</span> · {entry.subjectTitle}
                        </p>
                      </div>
                      <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border shrink-0 ${
                        entry.result === 'Tugatdi'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-[#f7f4ef] text-[#64748b] border-[#ede9e1]'
                      }`}>
                        {entry.result}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Grant exam modal */}
      <Modal
        open={!!grantModal}
        onClose={() => setGrantModal(null)}
        title="Imtihon ruxsati"
        size="sm"
        theme="dark"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGrantModal(null)}>Bekor qilish</Button>
            <Button
              variant="primary"
              loading={granting}
              disabled={
                grantSource === 'lesson' ? !selectedLesson : !selectedExam
              }
              icon={<BookOpen size={16} />}
              onClick={handleGrant}
            >
              {granting ? 'Berilmoqda...' : "Ruxsat berish"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-[#162032] border border-white/10 rounded-xl px-4 py-3">
            <p className="text-xs text-[#94a3b8] mb-0.5">O&apos;quvchi</p>
            <p className="text-white font-semibold">{grantModal?.name}</p>
          </div>

          {(lessons.length > 0 || catalogueExams.length > 0) && (
            <div className="flex bg-[#162032] border border-white/10 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setGrantSource('catalogue')}
                disabled={catalogueExams.length === 0}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg transition-colors ${
                  grantSource === 'catalogue'
                    ? 'bg-[#15803d]/20 text-[#15803d] border border-[#15803d]/40'
                    : 'text-[#94a3b8] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <GraduationCap size={12} />
                Katalog imtihoni ({catalogueExams.length})
              </button>
              <button
                type="button"
                onClick={() => setGrantSource('lesson')}
                disabled={lessons.length === 0}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg transition-colors ${
                  grantSource === 'lesson'
                    ? 'bg-[#15803d]/20 text-[#15803d] border border-[#15803d]/40'
                    : 'text-[#94a3b8] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                <BookOpen size={12} />
                Dars imtihoni ({lessons.length})
              </button>
            </div>
          )}

          {grantSource === 'lesson' ? (
            <div className="space-y-2">
              <label
                htmlFor="grant-lesson-select"
                className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-widest"
              >
                Dars tanlang
              </label>
              {lessons.length === 0 ? (
                <p className="text-[#94a3b8] text-xs">
                  Imtihonli darslar mavjud emas. Superadmin darsda &quot;Imtihon&quot; flagini yoqishi kerak.
                </p>
              ) : (
                <div className="relative">
                  <select
                    id="grant-lesson-select"
                    value={selectedLesson}
                    onChange={(e) => setSelectedLesson(e.target.value)}
                    className="w-full appearance-none bg-[#162032] border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-[#15803d] pr-10"
                  >
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        #{l.orderNumber} — {l.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label
                htmlFor="grant-exam-select"
                className="block text-xs font-semibold text-[#94a3b8] uppercase tracking-widest"
              >
                Imtihon tanlang
              </label>
              {catalogueExams.length === 0 ? (
                <p className="text-[#94a3b8] text-xs">
                  Nashr qilingan katalog imtihonlari mavjud emas. Superadmin /superadmin/exams sahifasida nashr qilishi kerak.
                </p>
              ) : (
                <>
                  <div className="relative">
                    <select
                      id="grant-exam-select"
                      value={selectedExam}
                      onChange={(e) => setSelectedExam(e.target.value)}
                      className="w-full appearance-none bg-[#162032] border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-medium focus:outline-none focus:border-[#15803d] pr-10"
                    >
                      {catalogueExams.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title} — {e._count.questions} ta savol · {e.passThreshold}% o&apos;tish
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
                  </div>
                  {(() => {
                    const picked = catalogueExams.find((e) => e.id === selectedExam);
                    if (!picked?.description) return null;
                    return (
                      <p className="text-xs text-[#94a3b8] bg-[#162032] border border-white/10 rounded-lg px-3 py-2 line-clamp-3 overflow-hidden">
                        {picked.description}
                      </p>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {grantError && (
            <p className="text-rose-400 text-sm">{grantError}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

// Small stat tile for the header
function StatTile({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-[#162032] rounded-[14px] p-3">
      <div className="mb-1">{icon}</div>
      <p className="text-white text-xl font-extrabold font-mono leading-none">{value}</p>
      <p className="text-[#94a3b8] text-[10px] mt-0.5 font-bold truncate">{label}</p>
    </div>
  );
}
