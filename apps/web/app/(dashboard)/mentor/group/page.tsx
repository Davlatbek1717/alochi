'use client';
import { useState } from 'react';

const MOCK_STUDENTS = [
  { id: '1', name: 'Sardor Rahimov', status: 'green' as Status, attendance: true },
  { id: '2', name: 'Malika Yusupova', status: 'yellow' as Status, attendance: false },
  { id: '3', name: 'Jasur Mirzayev', status: 'red' as Status, attendance: true },
];

type Status = 'green' | 'yellow' | 'red';

const STATUS_COLORS: Record<Status, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red: 'bg-red-100 text-red-700',
};

export default function MentorGroupPage() {
  const [students, setStudents] = useState(MOCK_STUDENTS);
  const [saved, setSaved] = useState(false);

  function updateStatus(id: string, status: Status) {
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, status } : s));
  }

  function toggleAttendance(id: string) {
    setStudents((prev) => prev.map((s) => s.id === id ? { ...s, attendance: !s.attendance } : s));
  }

  async function saveAll() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">5A Guruh</h1>
        <button
          onClick={saveAll}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium"
        >
          {saved ? '✅ Saqlandi' : 'Saqlash'}
        </button>
      </div>

      <div className="space-y-2">
        {students.map((student) => (
          <div key={student.id} className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-4">
            <button
              onClick={() => toggleAttendance(student.id)}
              className={`w-10 h-10 rounded-full border-2 font-bold text-sm ${
                student.attendance ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-400'
              }`}
            >
              {student.attendance ? '✓' : '✗'}
            </button>

            <div className="flex-1">
              <p className="font-medium">{student.name}</p>
            </div>

            <div className="flex gap-1">
              {(['green', 'yellow', 'red'] as Status[]).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(student.id, s)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    student.status === s
                      ? STATUS_COLORS[s] + ' ring-2 ring-offset-1'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s === 'green' ? '🟢' : s === 'yellow' ? '🟡' : '🔴'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
