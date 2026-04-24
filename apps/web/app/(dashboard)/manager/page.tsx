'use client';

const RED_STUDENTS = [
  { id: '1', name: 'Sardor Rahimov', note: '3 kun kelmadi', days: 3 },
  { id: '2', name: 'Anvar Karimov', note: 'Status qizil 5 kun', days: 5 },
];

const YELLOW_STUDENTS = [
  { id: '3', name: 'Dilnoza Ergasheva', note: 'Dars bajarish pastlashdi', days: 2 },
];

export default function ManagerDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manager Paneli</h1>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <h2 className="font-semibold text-red-700">🔴 Qizil O&apos;quvchilar ({RED_STUDENTS.length})</h2>
        </div>
        <div className="divide-y">
          {RED_STUDENTS.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500">{s.note}</p>
              </div>
              <button className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-sm">
                1:1 Sessiya
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
          <h2 className="font-semibold text-yellow-700">🟡 Sariq O&apos;quvchilar ({YELLOW_STUDENTS.length})</h2>
        </div>
        <div className="divide-y">
          {YELLOW_STUDENTS.map((s) => (
            <div key={s.id} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-gray-500">{s.note}</p>
              </div>
              <button className="bg-yellow-600 text-white px-3 py-1 rounded-lg text-sm">
                Kuzatish
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
