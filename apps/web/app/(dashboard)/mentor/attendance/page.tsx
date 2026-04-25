'use client';
import { useState } from 'react';
import { apiRequest } from '@/lib/api';

interface Student {
  id: string;
  name: string;
  status: 'present' | 'late' | 'absent' | null;
}

interface User {
  id: string;
  tenantId: string;
}

const MOCK_STUDENTS: Student[] = [
  { id: 'mock-1', name: 'Sardor Rahimov', status: null },
  { id: 'mock-2', name: 'Malika Yusupova', status: null },
  { id: 'mock-3', name: 'Jasur Mirzayev', status: null },
];

function formatDate(date: Date): string {
  const months = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
  ];
  return `${date.getDate()}-${months[date.getMonth()]} ${date.getFullYear()}`;
}

function toISODateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function MentorAttendancePage() {
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const today = new Date();
  const formattedDate = formatDate(today);
  const isoDate = toISODateString(today);

  function setStatus(studentId: string, status: 'present' | 'late' | 'absent') {
    setStudents((prev) =>
      prev.map((s) => s.id === studentId ? { ...s, status } : s),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const user: User = JSON.parse(localStorage.getItem('user') ?? '{}');

      const records = students.map((s) => ({
        studentId: s.id,
        status: s.status ?? 'absent',
        markedBy: user.id,
        tenantId: user.tenantId,
        branchId: user.tenantId,
        date: isoDate,
      }));

      await apiRequest('/attendance/students/bulk', {
        method: 'POST',
        body: JSON.stringify({ records }),
      }, token);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bugungi Davomat</h1>
          <p className="text-gray-500 mt-1">{formattedDate}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="space-y-3">
        {students.map((student) => (
          <div
            key={student.id}
            className="bg-white rounded-xl shadow-sm px-5 py-4 flex items-center justify-between"
          >
            <span className="font-medium text-gray-900">{student.name}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus(student.id, 'present')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  student.status === 'present'
                    ? 'bg-green-500 text-white'
                    : 'bg-green-50 text-green-700 hover:bg-green-100'
                }`}
              >
                ✓ Keldi
              </button>
              <button
                onClick={() => setStatus(student.id, 'late')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  student.status === 'late'
                    ? 'bg-yellow-400 text-white'
                    : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                }`}
              >
                ⏰ Kech
              </button>
              <button
                onClick={() => setStatus(student.id, 'absent')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  student.status === 'absent'
                    ? 'bg-red-500 text-white'
                    : 'bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                ✗ Kelmadi
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
        {saved && (
          <span className="text-green-600 font-medium">✅ Saqlandi</span>
        )}
      </div>
    </div>
  );
}
