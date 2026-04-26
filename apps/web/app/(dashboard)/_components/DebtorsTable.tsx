'use client';
import { useState } from 'react';

export interface BranchStudent {
  id: string;
  name: string;
  status: string;
  hasPaid: boolean;
  payment: { amount: number; paidAt: string } | null;
}

interface DebtorsTableProps {
  students: BranchStudent[];
  readOnly: boolean;
  onMarkPaid?: (studentId: string, amount: number) => Promise<void>;
  loading: boolean;
}

type FilterTab = 'all' | 'unpaid' | 'blocked';
type SortDir = 'asc' | 'desc' | null;

const TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'unpaid', label: "To'lamagan" },
  { key: 'blocked', label: 'Bloklangan' },
];

export default function DebtorsTable({ students, readOnly, onMarkPaid, loading }: DebtorsTableProps) {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');

  const filtered = students.filter((s) => {
    if (filter === 'unpaid') return !s.hasPaid && s.status !== 'blocked_payment';
    if (filter === 'blocked') return s.status === 'blocked_payment';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (!sortDir) return 0;
    const aAmt = a.payment?.amount ?? -1;
    const bAmt = b.payment?.amount ?? -1;
    return sortDir === 'asc' ? aAmt - bAmt : bAmt - aAmt;
  });

  async function handlePay(studentId: string) {
    const val = parseInt(amountInput);
    if (!Number.isFinite(val) || val <= 0) {
      setPayError("To'g'ri summa kiriting");
      return;
    }
    setPayError('');
    setPaying(true);
    try {
      await onMarkPaid?.(studentId, val);
      setSelectedId(null);
      setAmountInput('');
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "To'lovda xatolik");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="divide-y">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4 animate-pulse">
            <div className="space-y-2">
              <div className="h-4 w-36 bg-gray-200 rounded" />
              <div className="h-3 w-24 bg-gray-100 rounded" />
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 px-5 py-3 border-b border-gray-100 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))}
          className="ml-auto px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          Summa {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="px-5 py-8 text-sm text-center text-gray-400">Qarzdorlar topilmadi</p>
      ) : (
        <div className="divide-y">
          {sorted.map((s) => (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p
                    className={`text-sm ${
                      s.hasPaid
                        ? 'text-green-600'
                        : s.status === 'blocked_payment'
                        ? 'text-red-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {s.hasPaid
                      ? `✅ ${s.payment!.amount.toLocaleString()} so'm · ${s.payment!.paidAt.slice(0, 10)}`
                      : s.status === 'blocked_payment'
                      ? '🔒 Bloklangan'
                      : "⏳ Hali to'lamagan"}
                  </p>
                </div>
                {!readOnly && !s.hasPaid && (
                  <button
                    onClick={() => {
                      setSelectedId(s.id);
                      setAmountInput('');
                      setPayError('');
                    }}
                    className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 shrink-0"
                  >
                    To&apos;lov qabul
                  </button>
                )}
              </div>
              {selectedId === s.id && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={amountInput}
                      onChange={(e) => setAmountInput(e.target.value)}
                      placeholder="Summa (so'm)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => handlePay(s.id)}
                      disabled={paying}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      {paying ? '...' : 'Saqlash'}
                    </button>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100"
                    >
                      ✕
                    </button>
                  </div>
                  {payError && <p className="text-red-500 text-sm">{payError}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
