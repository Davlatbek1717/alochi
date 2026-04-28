'use client';
import { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Clock, UserX, PlayCircle, Users, BookOpen, X, ChevronDown } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface Student { id: string; name: string; }
interface AttendanceRecord { studentId: string; status: string; student: { id: string; name: string }; }
interface Lesson { id: string; title: string; orderNumber: number; hasExam: boolean; }
type QueueStatus = 'waiting' | 'testing' | 'done' | 'absent';
interface StudentRow { id: string; name: string; attendance: 'present' | 'absent' | null; queue: QueueStatus; activeExamId?: string; }

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    return payload.branchId ?? null;
  } catch { return null; }
}

function getTenantIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { tenantId?: string };
    return payload.tenantId ?? null;
  } catch { return null; }
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const QUEUE_LABEL: Record<QueueStatus, string> = {
  waiting: 'Navbatda', testing: 'Topshirmoqda', done: 'Tugadi', absent: 'Kelmadi',
};

export default function TesterPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);

  // Grant modal state
  const [grantModal, setGrantModal] = useState<{ studentId: string; name: string } | null>(null);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [granting, setGranting] = useState(false);
  const [grantError, setGrantError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken') ?? '';
    const branchId = getBranchIdFromToken();
    if (!branchId) { setError('Branch topilmadi'); setLoading(false); return; }

    try {
      const [studentsRes, attendanceRes, lessonsRes] = await Promise.all([
        apiRequest<Student[]>(`/users?branchId=${branchId}&role=student`, {}, token),
        apiRequest<AttendanceRecord[]>(`/attendance/students/${branchId}/${today}`, {}, token)
          .catch(() => ({ data: [] as AttendanceRecord[] })),
        apiRequest<Lesson[]>('/lessons', {}, token).catch(() => ({ data: [] as Lesson[] })),
      ]);

      const attendanceMap = new Map(attendanceRes.data.map((a) => [a.studentId, a.status]));
      setLessons(lessonsRes.data.filter((l) => l.hasExam));
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
    const branchId = getBranchIdFromToken();
    const tenantId = getTenantIdFromToken();
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string };
    try {
      await apiRequest('/attendance/students/bulk', {
        method: 'POST',
        body: JSON.stringify({ date: today, records: [{ studentId, status: 'present', markedBy: user.id ?? '', tenantId, branchId }] }),
      }, token);
      setRows((prev) => prev.map((r) => r.id === studentId ? { ...r, attendance: 'present', queue: 'waiting' } : r));
    } catch (err) { setError(err instanceof Error ? err.message : 'Xatolik'); }
  }

  function openGrantModal(student: StudentRow) {
    setGrantModal({ studentId: student.id, name: student.name });
    setSelectedLesson(lessons[0]?.id ?? '');
    setGrantError('');
  }

  async function handleGrant() {
    if (!grantModal || !selectedLesson) return;
    setGranting(true);
    setGrantError('');
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest('/exams/grant', {
        method: 'POST',
        body: JSON.stringify({ studentId: grantModal.studentId, lessonId: selectedLesson }),
      }, token);
      setRows((prev) => prev.map((r) =>
        r.id === grantModal.studentId ? { ...r, queue: 'testing' } : r,
      ));
      setGrantModal(null);
    } catch (err) {
      setGrantError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setGranting(false);
    }
  }

  function setDone(studentId: string) {
    setRows((prev) => prev.map((r) => r.id === studentId ? { ...r, queue: 'done' } : r));
  }

  const arrived = rows.filter((r) => r.attendance === 'present');
  const notArrived = rows.filter((r) => r.attendance !== 'present');
  const testingNow = rows.find((r) => r.queue === 'testing');
  const doneCount = rows.filter((r) => r.queue === 'done').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="relative z-10 mb-5">
          <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Tester paneli</p>
          <p className="text-white text-xl font-bold">Bugungi navbat</p>
          <p className="text-[#475569] text-xs mt-1 font-mono">{today}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 relative z-10">
          <div className="bg-[#162032] rounded-[14px] p-3">
            <Users size={14} className="text-[#0d9488] mb-1" />
            <p className="text-white text-xl font-black font-mono">{arrived.length}</p>
            <p className="text-[#94a3b8] text-[10px] mt-0.5">Keldi</p>
          </div>
          <div className="bg-[#162032] rounded-[14px] p-3">
            <CheckCircle size={14} className="text-emerald-400 mb-1" />
            <p className="text-white text-xl font-black font-mono">{doneCount}</p>
            <p className="text-[#94a3b8] text-[10px] mt-0.5">Topshirdi</p>
          </div>
          <div className="bg-[#162032] rounded-[14px] p-3">
            <Clock size={14} className="text-[#f59e0b] mb-1" />
            <p className="text-white text-xl font-black font-mono">{arrived.length - doneCount}</p>
            <p className="text-[#94a3b8] text-[10px] mt-0.5">Kutmoqda</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-8 pb-6 space-y-5">
        {error && <p className="text-rose-500 text-sm">{error}</p>}

        {testingNow && (
          <div className="bg-gradient-to-br from-[#1e3a5f] to-[#1e293b] rounded-[18px] p-4 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-2">
              <PlayCircle size={14} className="text-blue-400" />
              <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Hozir topshirmoqda</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-300 font-black text-sm shrink-0">
                {getInitials(testingNow.name)}
              </div>
              <p className="text-white text-lg font-bold flex-1">{testingNow.name}</p>
              <button onClick={() => setDone(testingNow.id)}
                className="bg-emerald-500 text-white text-sm font-bold px-4 py-2 rounded-xl">
                Tugatdi
              </button>
            </div>
          </div>
        )}

        {arrived.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
              Kelganlar — {arrived.length}/{rows.length}
            </p>
            <div className="space-y-2">
              {arrived.map((s) => {
                const isDone = s.queue === 'done';
                const isTesting = s.queue === 'testing';
                const isWaiting = s.queue === 'waiting';
                return (
                  <div key={s.id} className={`bg-white rounded-[14px] px-4 py-3 border-[1.5px] flex items-center gap-3 ${
                    isDone ? 'border-emerald-100' : isTesting ? 'border-blue-200' : 'border-[#ede9e1]'
                  }`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      isDone ? 'bg-emerald-100 text-emerald-700' : isTesting ? 'bg-blue-100 text-blue-700' : 'bg-[#f7f4ef] text-[#0f172a]'
                    }`}>
                      {isDone ? <CheckCircle size={16} /> : getInitials(s.name)}
                    </div>
                    <p className={`flex-1 text-sm font-semibold ${isDone ? 'text-[#94a3b8] line-through' : 'text-[#0f172a]'}`}>{s.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isDone ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                      isTesting ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                      'bg-[#f7f4ef] text-[#64748b] border border-[#ede9e1]'
                    }`}>{QUEUE_LABEL[s.queue]}</span>
                    {isWaiting && (
                      <button
                        onClick={() => openGrantModal(s)}
                        disabled={!!testingNow || lessons.length === 0}
                        className="bg-[#0f172a] text-white text-xs font-bold px-3 py-1.5 rounded-xl disabled:opacity-30 flex items-center gap-1"
                      >
                        <BookOpen size={12} /> Boshlash
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {notArrived.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
              Kutilmoqda — {notArrived.length} ta
            </p>
            <div className="space-y-2">
              {notArrived.map((s) => (
                <div key={s.id} className="bg-white rounded-[14px] px-4 py-3 border-[1.5px] border-[#ede9e1] flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#94a3b8] shrink-0">
                    <UserX size={16} />
                  </div>
                  <p className="flex-1 text-sm text-[#94a3b8]">{s.name}</p>
                  <button onClick={() => markPresent(s.id)}
                    className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl">
                    Keldi
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {rows.length === 0 && !error && (
          <div className="bg-white rounded-[18px] p-10 text-center border-[1.5px] border-[#ede9e1]">
            <Users size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-[#0f172a] font-semibold">O&apos;quvchilar topilmadi</p>
          </div>
        )}
      </div>

      {/* Grant exam modal */}
      {grantModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-0">
          <div className="bg-white rounded-t-[24px] w-full max-w-lg p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-[#0f172a] font-bold text-lg">Imtihon ruxsati</p>
              <button onClick={() => setGrantModal(null)} className="w-8 h-8 flex items-center justify-center text-[#94a3b8]">
                <X size={20} />
              </button>
            </div>

            <div className="bg-[#f7f4ef] rounded-xl px-4 py-3">
              <p className="text-xs text-[#94a3b8] mb-0.5">O&apos;quvchi</p>
              <p className="text-[#0f172a] font-semibold">{grantModal.name}</p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Dars tanlang</p>
              <div className="relative">
                <select
                  value={selectedLesson}
                  onChange={(e) => setSelectedLesson(e.target.value)}
                  className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm font-medium focus:outline-none focus:border-[#0f172a] pr-10"
                >
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      #{l.orderNumber} — {l.title}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
              </div>
            </div>

            {grantError && (
              <p className="text-rose-500 text-sm">{grantError}</p>
            )}

            <button
              onClick={handleGrant}
              disabled={granting || !selectedLesson}
              className="w-full bg-[#0f172a] text-white py-4 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {granting
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <BookOpen size={16} />}
              {granting ? 'Berilmoqda...' : "Imtihon ruxsatini ber"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
