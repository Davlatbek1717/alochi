'use client';
import { useState } from 'react';

const REASON_TYPES = [
  { value: 'not_prepared', label: 'Darsga tayyorlanmagan' },
  { value: 'no_homework', label: 'Vazifalarni bajarmagan' },
  { value: 'discipline', label: 'Intizom buzilishi' },
  { value: 'other', label: 'Boshqa' },
];

export default function WarningsPage() {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [reasonType, setReasonType] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reasonText.trim()) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2000);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Ogohlantirish Berish</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">O&apos;quvchi *</label>
          <select
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          >
            <option value="">Tanlang...</option>
            <option value="s1">Sardor Rahimov</option>
            <option value="s2">Malika Yusupova</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Turi *</label>
          <div className="space-y-2">
            {REASON_TYPES.map((r) => (
              <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reasonType"
                  value={r.value}
                  checked={reasonType === r.value}
                  onChange={() => setReasonType(r.value)}
                  className="text-indigo-600"
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Izoh (majburiy) *</label>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={3}
            required
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Ogohlantirish sababi..."
          />
        </div>

        <button
          type="submit"
          className="w-full bg-red-600 text-white py-3 rounded-xl font-medium"
        >
          {submitted ? '✅ Berildi' : 'Ogohlantirish Berish'}
        </button>
      </form>
    </div>
  );
}
