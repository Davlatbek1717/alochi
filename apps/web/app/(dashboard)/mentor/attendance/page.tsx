'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Users, Save } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';

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

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    return typeof payload.branchId === 'string' ? payload.branchId : null;
  } catch {
    return null;
  }
}

const TODAY = new Date().toISOString().split('T')[0];

const STATUS_CONFIG: {
  status: AttendanceStatus;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
  inactiveClass: string;
}[] = [
  {
    status: 'present',
    label: 'Keldi',
    icon: <CheckCircle2 size={14} />,
    activeClass: 'bg-emerald-500 text-white border-emerald-500',
    inactiveClass: 'bg-[#f7f4ef] text-[#94a3b8] border-[#ede9e1]',
  },
  {
    status: 'absent',
    label: 'Kelmadi',
    icon: <XCircle size={14} />,
    activeClass: 'bg-[#e11d48] text-white border-[#e11d48]',
    inactiveClass: 'bg-[#f7f4ef] text-[#94a3b8] border-[#ede9e1]',
  },
  {
    status: 'late',
    label: 'Kechikdi',
    icon: <Clock size={14} />,
    activeClass: 'bg-[#f59e0b] text-white border-[#f59e0b]',
    inactiveClass: 'bg-[#f7f4ef] text-[#94a3b8] border-[#ede9e1]',
  },
];

export default function MentorAttendancePage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const branchId = getBranchIdFromToken();

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      if (!branchId) throw new Error("Filial topilmadi. Administrator bilan bog'laning.");
      const res = await apiRequest<ApiUser[]>(`/users/by-branch/${branchId}`, {}, token);
      const studentList = res.data
        .filter((u) => u.role === 'student')
        .map((s) => ({ id: s.id, name: s.name, status: 'present' as AttendanceStatus }));
      setStudents(studentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  function setStatus(id: string, status: AttendanceStatus) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  async function saveAttendance() {
    setSaving(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(
        '/attendance/students/bulk',
        {
          method: 'POST',
          body: JSON.stringify({
            date: TODAY,
            records: students.map(({ id, status }) => ({ studentId: id, status })),
          }),
        },
        token,
      );
      setSaved(true);
      success('Davomat saqlandi');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  }

  const presentCount = students.filter((s) => s.status === 'present').length;
  const absentCount = students.filter((s) => s.status === 'absent').length;
  const lateCount = students.filter((s) => s.status === 'late').length;

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.push('/mentor')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Mentor
          </button>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
                <Users size={18} className="text-[#0d9488]" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">Bugungi Davomat</p>
                <p className="text-[#64748b] text-xs font-mono">{TODAY}</p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              loading={saving}
              disabled={students.length === 0}
              icon={saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
              onClick={saveAttendance}
            >
              {saved ? 'Saqlandi' : 'Saqlash'}
            </Button>
          </div>

          {/* Stats row */}
          {!loading && students.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-emerald-400 text-xl font-black font-mono">{presentCount}</p>
                <p className="text-[#94a3b8] text-xs">Keldi</p>
              </div>
              <div className="text-center border-x border-white/10">
                <p className="text-[#e11d48] text-xl font-black font-mono">{absentCount}</p>
                <p className="text-[#94a3b8] text-xs">Kelmadi</p>
              </div>
              <div className="text-center">
                <p className="text-[#f59e0b] text-xl font-black font-mono">{lateCount}</p>
                <p className="text-[#94a3b8] text-xs">Kechikdi</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-8 pb-6 space-y-3">
        {!branchId ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center">
            <p className="text-[#e11d48] text-sm">Filial topilmadi. Administrator bilan bog&apos;laning.</p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex items-center justify-between gap-3">
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
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center">
            <p className="text-[#e11d48] mb-3 text-sm">{error}</p>
            <Button variant="primary" size="sm" onClick={loadStudents}>Qayta urinish</Button>
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<Users size={28} />}
              title="Bu filialda o'quvchilar topilmadi"
            />
          </div>
        ) : (
          students.map((student) => (
            <div
              key={student.id}
              className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] px-4 py-3 flex items-center justify-between gap-3"
            >
              <span className="font-semibold text-[#0f172a] text-sm flex-1 truncate">{student.name}</span>
              <div className="flex gap-1.5">
                {STATUS_CONFIG.map(({ status, label, icon, activeClass, inactiveClass }) => (
                  <button
                    key={status}
                    onClick={() => setStatus(student.id, status)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border-[1.5px] transition-all ${
                      student.status === status ? activeClass : inactiveClass
                    }`}
                  >
                    {icon}
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
