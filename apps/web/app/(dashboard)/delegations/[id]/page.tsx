'use client';

const MOCK_TIMELINE = [
  { time: '3-may 09:14', icon: '📤', actor: 'Nodira', action: 'delegatsiya yaratdi', detail: 'Sabab: "Filadmin ta\'tilda"' },
  { time: '3-may 09:31', icon: '✅', actor: 'Alisher', action: 'qabul qildi', detail: '"Tushundim, bajaraman"' },
  { time: '4-may 11:20', icon: '⚠️', actor: 'Alisher', action: 'ogohlantirish berdi', detail: "O'quvchi: Sardor Rahimov — Darsga tayyorlanmagan" },
  { time: '5-may 14:05', icon: '💳', actor: 'Alisher', action: "to'lov belgiladi", detail: "Malika Yusupova • 450,000 so'm" },
];

export default function DelegationDetailPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <a href="/delegations" className="text-gray-400 hover:text-gray-600">←</a>
        <div>
          <h1 className="text-xl font-bold">Nodira → Alisher</h1>
          <p className="text-sm text-gray-500">3–10 may • 🟢 Faol</p>
        </div>
        <div className="ml-auto">
          <button className="text-indigo-600 text-sm border border-indigo-200 px-3 py-1 rounded-lg">
            📄 PDF
          </button>
        </div>
      </div>

      <div className="bg-indigo-50 rounded-xl p-4 text-sm space-y-1">
        <p><span className="font-medium">Sabab:</span> &quot;Filadmin ta&apos;tilda&quot;</p>
        <p><span className="font-medium">Ruxsatlar:</span> Ogohlantirish, To&apos;lov, Xodim boshqaruv</p>
      </div>

      <div className="space-y-1">
        {MOCK_TIMELINE.map((event, i) => (
          <div key={i} className="flex gap-3 py-3 border-b last:border-0">
            <div className="text-2xl">{event.icon}</div>
            <div>
              <p className="text-xs text-gray-400">{event.time}</p>
              <p className="font-medium">{event.actor} — {event.action}</p>
              <p className="text-sm text-gray-500">{event.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
