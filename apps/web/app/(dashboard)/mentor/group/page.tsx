'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Users, CheckCircle, XCircle, Save } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken, getGroupIdFromToken } from '@/lib/jwt';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';

type Status = 'green' | 'yellow' | 'red';

const STATUS_DOT: Record<Status, string> = {
  green:  'bg-emerald-500',
  yellow: 'bg-amber-400',
  red:    'bg-rose-500',
};

const STATUS_ARIA: Record<Status, string> = {
  green:  'Yaxshi',
  yellow: "Ogohlantirishga muhtoj",
  red:    'Muammo bor',
};

const STATUS_RING: Record<Status, string> = {
  green:  'ring-emerald-400',
  yellow: 'ring-amber-400',
  red:    'ring-rose-400',
};

const STATUS_UZ: Record<Status, string> = {
  green: 'yashil', yellow: 'sariq', red: 'qizil',
};

type LocalStudent = { id: string; name: string; status: Status; note: string; attendance: boolean };
type ApiStudent   = { id: string; name: string; role: string };


export default function MentorGroupPage() {
  const { success, error: toastError } = useToast();
  const [students, setStudents] = useState<LocalStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const groupId = getGroupIdFromToken();
      const branchId = getBranchIdFromToken();
      // Group-scoped roster takes precedence; fall back to branch when JWT
      // carries no groupId (older tokens, manager users).
      if (!groupId && !branchId) throw new Error('Guruh yoki filial topilmadi');
      const path = groupId
        ? `/users/group/${groupId}`
        : `/users/by-branch/${branchId}`;
      const res = await apiRequest<ApiStudent[]>(path, {}, token);
      setStudents(
        res.data.filter((u) => u.role === 'student')
          .map((s) => ({ ...s, status: 'green' as Status, note: '', attendance: true })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  function updateStatus(id: string, status: Status) {
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, status, note: status === 'green' ? '' : s.note } : s));
  }
  function updateNote(id: string, note: string) {
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, note } : s));
  }
  function toggleAttendance(id: string) {
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, attendance: !s.attendance } : s));
  }

  async function saveAll() {
    setSaving(true);
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string; tenantId?: string; branchId?: string };
    const branchId = getBranchIdFromToken() ?? user.branchId ?? '';
    const today = new Date().toISOString().split('T')[0];
    try {
      await apiRequest('/attendance/students', {
        method: 'POST',
        body: JSON.stringify({
          records: students.map((s) => ({
            studentId: s.id,
            status: s.attendance ? 'present' : 'absent',
            markedBy: user.id ?? '', tenantId: user.tenantId ?? '', branchId, date: today,
          })),
        }),
      }, token);
      await Promise.all(students.map((s) =>
        apiRequest('/status/personal', {
          method: 'POST',
          body: JSON.stringify({ studentId: s.id, date: today, color: STATUS_UZ[s.status], note: s.note || undefined }),
        }, token),
      ));
      localStorage.setItem(`attendance_marked_${today}`, '1');
      success('Davomat saqlandi');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        {/* Header skeleton */}
        <div className="bg-[#0f172a] px-5 pt-5 pb-5">
          <div className="mb-5">
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-[14px]" />
            <Skeleton className="h-16 rounded-[14px]" />
          </div>
        </div>
        <div className="px-4 pt-8 pb-6 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-[14px] border-[1.5px] border-[#ede9e1] p-4">
              <div className="flex items-center gap-3">
                <Skeleton theme="light" className="w-9 h-9 rounded-xl shrink-0" />
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
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center max-w-sm w-full space-y-3">
          <p className="text-rose-500 text-sm">{error}</p>
          <Button variant="primary" onClick={loadStudents}>Qayta urinish</Button>
        </div>
      </div>
    );
  }

  const present = students.filter((s) => s.attendance).length;

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative">
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 mb-5 flex items-start justify-between">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Mentor</p>
            <p className="text-white text-xl font-bold">Guruh</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 relative z-10">
          <div className="bg-[#162032] rounded-[14px] p-3">
            <Users size={14} className="text-[#0d9488] mb-1" />
            <p className="text-white text-xl font-black font-mono">{present}</p>
            <p className="text-[#94a3b8] text-[10px] mt-0.5">Keldi</p>
          </div>
          <div className="bg-[#162032] rounded-[14px] p-3">
            <Users size={14} className="text-[#94a3b8] mb-1" />
            <p className="text-white text-xl font-black font-mono">{students.length}</p>
            <p className="text-[#94a3b8] text-[10px] mt-0.5">Jami</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-8 pb-6 space-y-4">
        {students.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<Users size={28} />}
              title="Guruhda o'quvchilar yo'q"
              description="Bu filialda o'quvchilar topilmadi"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {students.map((student) => (
              <div key={student.id} className={`bg-white rounded-[14px] border-[1.5px] p-4 space-y-3 ${
                student.attendance ? 'border-[#ede9e1]' : 'border-[#ede9e1] opacity-60'
              }`}>
                <div className="flex items-center gap-3">
                  {/* Attendance toggle */}
                  <button
                    onClick={() => toggleAttendance(student.id)}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      student.attendance ? 'bg-emerald-100 text-emerald-600' : 'bg-[#f7f4ef] text-[#94a3b8]'
                    }`}
                  >
                    {student.attendance ? <CheckCircle size={18} /> : <XCircle size={18} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0f172a]">{student.name}</p>
                    <Link href={`/mentor/students/${student.id}`} className="text-xs text-[#0d9488] font-medium">
                      Xato tahlili →
                    </Link>
                  </div>

                  {/* Status dots */}
                  <div className="flex gap-1.5">
                    {(['green', 'yellow', 'red'] as Status[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(student.id, s)}
                        aria-label={STATUS_ARIA[s]}
                        aria-pressed={student.status === s}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          student.status === s ? `bg-[#f7f4ef] ring-2 ring-offset-1 ${STATUS_RING[s]}` : 'bg-[#f7f4ef]'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${STATUS_DOT[s]}`} />
                      </button>
                    ))}
                  </div>
                </div>

                {student.status !== 'green' && (
                  <input
                    type="text"
                    placeholder="Izoh (ixtiyoriy)..."
                    aria-label={`${student.name} uchun izoh`}
                    value={student.note}
                    onChange={(e) => updateNote(student.id, e.target.value)}
                    className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        <Button
          variant="primary"
          fullWidth
          size="lg"
          loading={saving}
          icon={<Save size={16} />}
          onClick={saveAll}
        >
          Saqlash
        </Button>
      </div>
    </div>
  );
}
