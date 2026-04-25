'use client';
import { useState } from 'react';

type StudentPayment = {
  id: string;
  name: string;
  status: string;
  paid: boolean;
  amount?: number;
  paidAt?: string;
};

const INITIAL_STUDENTS: StudentPayment[] = [
  { id: 's1', name: 'Sardor Rahimov', status: 'blocked_payment', paid: false },
  { id: 's2', name: 'Malika Yusupova', status: 'active', paid: true, amount: 500000, paidAt: '2026-05-03' },
  { id: 's3', name: 'Jasur Mirzayev', status: 'active', paid: false },
];

export default function PaymentsPage() {
  const [students, setStudents] = useState<StudentPayment[]>(INITIAL_STUDENTS);
  const [selected, setSelected] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  function markPaid(id: string) {
    if (!amount) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, paid: true, status: 'active', amount: parseInt(amount), paidAt: 'Bugun' }
          : s,
      ),
    );
    setSelected(null);
    setAmount('');
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">To&apos;lov Holati — 2026-may</h1>

      <div className="space-y-2">
        {students.map((s) => (
          <div key={s.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className={`text-sm ${s.paid ? 'text-green-600' : s.status === 'blocked_payment' ? 'text-red-600' : 'text-gray-500'}`}>
                  {s.paid
                    ? `✅ To'ladi — ${s.amount?.toLocaleString()} so'm (${s.paidAt})`
                    : s.status === 'blocked_payment'
                    ? "🔒 Bloklangan — to'lov kutilmoqda"
                    : "⏳ Hali to'lamagan"}
                </p>
              </div>
              {!s.paid && (
                <button
                  onClick={() => setSelected(s.id)}
                  className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm"
                >
                  To&apos;lov qabul
                </button>
              )}
            </div>

            {selected === s.id && (
              <div className="mt-3 flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Summa (so'm)"
                  className="flex-1 border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={() => markPaid(s.id)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Saqlash
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
