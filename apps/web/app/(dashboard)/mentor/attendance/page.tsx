'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

type AttendanceStatus = 'present' | 'absent' | 'late';

type ApiStudent = {
  id: string;
  name: string;
};

type StudentRow = {
  id: string;
  name: string;
  status: AttendanceStatus;
};

function getGroupIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { groupId?: string };
    return typeof payload.groupId === 'string' ? payload.groupId : null;
  } catch {
    return null;
  }
}

const TODAY = new Date().toISOString().split('T')[0];

const STATUS_CONFIG: {
  status: AttendanceStatus;
  label: string;
  active: string;
  inactive: string;
}[] = [
  {
    status: 'present',
    label: '✅ Keldi',
    active: 'bg-green-500 text-white',
    inactive: 'bg-gray-100 text-gray-500',
  },
  {
    status: 'absent',
    label: '❌ Kelmadi',
    active: 'bg-red-500 text-white',
    inactive: 'bg-gray-100 text-gray-500',
  },
  {
    status: 'late',
    label: '⏰ Kechikdi',
    active: 'bg-yellow-500 text-white',
    inactive: 'bg-gray-100 text-gray-500',
  },
];

export default function MentorAttendancePage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const groupId = getGroupIdFromToken();
      if (!groupId) throw new Error("Guruh topilmadi. Administrator bilan bog'laning.");
      const res = await apiRequest<ApiStudent[]>(`/users/group/${groupId}`, {}, token);
      setStudents(res.data.map((s) => ({ ...s, status: 'present' as AttendanceStatus })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  function setStatus(id: string, status: AttendanceStatus) {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  async function saveAttendance() {
    setSaving(true);
    setSaveError('');
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
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4 h-16 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900">Bugungi Davomat</h1>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <p className="text-red-500 mb-3">{error}</p>
          <button
            onClick={loadStudents}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bugungi Davomat</h1>
          <p className="text-gray-500 mt-1">{TODAY}</p>
        </div>
        <button
          onClick={saveAttendance}
          disabled={saving}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : saved ? (
            '✅ Saqlandi'
          ) : (
            'Saqlash'
          )}
        </button>
      </div>

      {saveError && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{saveError}</div>
      )}

      <div className="space-y-3">
        {students.map((student) => (
          <div
            key={student.id}
            className="bg-white rounded-xl shadow-sm px-5 py-4 flex items-center justify-between"
          >
            <span className="font-medium text-gray-900">{student.name}</span>
            <div className="flex gap-2">
              {STATUS_CONFIG.map(({ status, label, active, inactive }) => (
                <button
                  key={status}
                  onClick={() => setStatus(student.id, status)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium min-h-[44px] transition-colors ${
                    student.status === status ? active : inactive
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
