'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

type Status = 'green' | 'yellow' | 'red';

const STATUS_COLORS: Record<Status, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
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

type ApiStudent = {
  id: string;
  name: string;
  role: string;
};

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    return payload.branchId ?? null;
  } catch {
    return null;
  }
}

export default function MentorGroupPage() {
  const [students, setStudents] = useState<LocalStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const branchId = getBranchIdFromToken();
      if (!branchId) throw new Error('Filial topilmadi');
      const res = await apiRequest<ApiStudent[]>(`/users/by-branch/${branchId}`, {}, token);
      const studentList = res.data
        .filter((u) => u.role === 'student')
        .map((s) => ({ ...s, status: 'green' as Status, note: '', attendance: true }));
      setStudents(studentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  function updateStatus(id: string, status: Status) {
    setStudents((prev) =>
      prev.map((s) => s.id === id ? { ...s, status, note: status === 'green' ? '' : s.note } : s),
    );
  }

  function updateNote(id: string, note: string) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, note } : s)));
  }

  function toggleAttendance(id: string) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, attendance: !s.attendance } : s)));
  }

  async function saveAll() {
    setSaveError('');
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { id?: string; tenantId?: string; branchId?: string };
    const branchId = getBranchIdFromToken() ?? user.branchId ?? '';
    const today = new Date().toISOString().split('T')[0];

    try {
      await apiRequest('/attendance/students/bulk', {
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
      }, token);

      await Promise.all(
        students.map((s) =>
          apiRequest('/status', {
            method: 'POST',
            body: JSON.stringify({
              studentId: s.id,
              date: today,
              personalStatus: STATUS_UZ[s.status],
              personalNote: s.note || undefined,
            }),
          }, token),
        ),
      );

      localStorage.setItem(`attendance_marked_${today}`, '1');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-9 w-20 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Guruh</h1>
        <div className="bg-white rounded-xl p-6 text-center">
          <p className="text-red-500 mb-3">{error}</p>
          <button onClick={loadStudents} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium">
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Guruh</h1>
        <button onClick={saveAll} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium">
          {saved ? '✅ Saqlandi' : 'Saqlash'}
        </button>
      </div>

      {saveError && <p className="text-red-500 text-sm">{saveError}</p>}

      <div className="space-y-2">
        {students.map((student) => (
          <div key={student.id} className="bg-white rounded-xl p-4 shadow-sm space-y-2">
            <div className="flex items-center gap-4">
              <button
                onClick={() => toggleAttendance(student.id)}
                className={`w-10 h-10 rounded-full border-2 font-bold text-sm shrink-0 ${
                  student.attendance ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-400'
                }`}
              >
                {student.attendance ? '✓' : '✗'}
              </button>

              <div className="flex-1">
                <p className="font-medium">{student.name}</p>
                <Link href={`/mentor/students/${student.id}`} className="text-xs text-indigo-600 font-medium">
                  Xato tahlili →
                </Link>
              </div>

              <div className="flex gap-1">
                {(['green', 'yellow', 'red'] as Status[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(student.id, s)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                      student.status === s ? STATUS_COLORS[s] + ' ring-2 ring-offset-1' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {s === 'green' ? '🟢' : s === 'yellow' ? '🟡' : '🔴'}
                  </button>
                ))}
              </div>
            </div>

            {student.status !== 'green' && (
              <input
                type="text"
                placeholder="Izoh (ixtiyoriy)..."
                value={student.note}
                onChange={(e) => updateNote(student.id, e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
