'use client';
import { useEffect, useState, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

interface Student {
  id: string;
  name: string;
}

interface AttendanceRecord {
  studentId: string;
  status: string;
  student: { id: string; name: string };
}

type QueueStatus = 'waiting' | 'testing' | 'done' | 'absent';

interface StudentRow {
  id: string;
  name: string;
  attendance: 'present' | 'absent' | null;
  queue: QueueStatus;
}

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string; tenantId?: string };
    return payload.branchId ?? null;
  } catch {
    return null;
  }
}

function getTenantIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { tenantId?: string };
    return payload.tenantId ?? null;
  } catch {
    return null;
  }
}

const QUEUE_LABEL: Record<QueueStatus, string> = {
  waiting: 'Navbatda',
  testing: 'Topshirmoqda',
  done: 'Tugadi',
  absent: 'Kelmadi',
};

const QUEUE_COLOR: Record<QueueStatus, string> = {
  waiting: 'bg-yellow-50 border-yellow-200',
  testing: 'bg-blue-50 border-blue-200',
  done: 'bg-green-50 border-green-200',
  absent: 'bg-gray-50 border-gray-200',
};

const BADGE_COLOR: Record<QueueStatus, string> = {
  waiting: 'bg-yellow-100 text-yellow-700',
  testing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  absent: 'bg-gray-100 text-gray-500',
};

export default function TesterPage() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('accessToken') ?? '';
    const branchId = getBranchIdFromToken();
    if (!branchId) { setError('Branch topilmadi'); setLoading(false); return; }

    try {
      const [studentsRes, attendanceRes] = await Promise.all([
        apiRequest<Student[]>(`/users?branchId=${branchId}&role=student`, {}, token),
        apiRequest<AttendanceRecord[]>(`/attendance/students/${branchId}/${today}`, {}, token)
          .catch(() => ({ data: [] as AttendanceRecord[] })),
      ]);

      const attendanceMap = new Map(attendanceRes.data.map((a) => [a.studentId, a.status]));

      setRows(
        studentsRes.data.map((s) => {
          const att = attendanceMap.get(s.id);
          return {
            id: s.id,
            name: s.name,
            attendance: att === 'present' ? 'present' : att === 'absent' ? 'absent' : null,
            queue: att === 'present' ? 'waiting' : att === 'absent' ? 'absent' : 'waiting',
          };
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yuklab bo\'lmadi');
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
        body: JSON.stringify({
          date: today,
          records: [{ studentId, status: 'present', markedBy: user.id ?? '', tenantId, branchId }],
        }),
      }, token);
      setRows((prev) =>
        prev.map((r) => (r.id === studentId ? { ...r, attendance: 'present', queue: 'waiting' } : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  function setQueue(studentId: string, queue: QueueStatus) {
    setRows((prev) => prev.map((r) => (r.id === studentId ? { ...r, queue } : r)));
  }

  const arrived = rows.filter((r) => r.attendance === 'present');
  const notArrived = rows.filter((r) => r.attendance !== 'present');
  const testingNow = rows.find((r) => r.queue === 'testing');

  if (loading) {
    return (
      <div className="space-y-3 max-w-lg">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bugungi navbat</h1>
        <span className="text-sm text-gray-400">{today}</span>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {testingNow && (
        <div className="bg-blue-600 rounded-2xl p-4 text-white">
          <p className="text-blue-200 text-xs font-medium uppercase tracking-wide mb-1">Hozir topshirmoqda</p>
          <p className="text-xl font-bold">{testingNow.name}</p>
          <button
            onClick={() => setQueue(testingNow.id, 'done')}
            className="mt-3 bg-white text-blue-600 text-sm font-semibold px-4 py-1.5 rounded-lg"
          >
            Tugatdi ✓
          </button>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Kelganlar — {arrived.length}/{rows.length}
        </p>
        {arrived.length === 0 ? (
          <p className="text-sm text-gray-400">Hali hech kim kelmadi</p>
        ) : (
          <div className="space-y-2">
            {arrived.map((s) => (
              <div key={s.id} className={`rounded-xl p-3 border flex items-center gap-3 ${QUEUE_COLOR[s.queue]}`}>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{s.name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_COLOR[s.queue]}`}>
                  {QUEUE_LABEL[s.queue]}
                </span>
                {s.queue === 'waiting' && (
                  <button
                    onClick={() => setQueue(s.id, 'testing')}
                    disabled={!!testingNow}
                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-lg disabled:opacity-40"
                  >
                    Topshirsin
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Kutilmoqda — {notArrived.length} ta
        </p>
        {notArrived.length === 0 ? (
          <p className="text-sm text-gray-400">Barchasi keldi</p>
        ) : (
          <div className="space-y-2">
            {notArrived.map((s) => (
              <div key={s.id} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-3">
                <p className="flex-1 text-gray-700">{s.name}</p>
                <button
                  onClick={() => markPresent(s.id)}
                  className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg font-medium"
                >
                  Keldi
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
