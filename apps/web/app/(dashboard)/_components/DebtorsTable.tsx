'use client';
import { useState } from 'react';
import { CheckCircle, Lock, Clock, CreditCard } from 'lucide-react';
import { formatNumber } from '@/lib/date-uz';
import { EmptyState, Skeleton } from '@/components/ui';

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
      <div className="divide-y divide-[#ede9e1]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4 gap-3">
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton theme="light" className="h-4 w-36" />
              <Skeleton theme="light" className="h-3 w-24" />
            </div>
            <Skeleton theme="light" className="h-8 w-20 rounded-xl shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2 px-5 py-3 border-b border-[#ede9e1] flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-[#0f172a] text-white'
                : 'bg-[#f7f4ef] text-[#64748b] hover:bg-[#ede9e1]'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'))}
          className="ml-auto px-3 py-1 rounded-full text-sm font-medium bg-[#f7f4ef] text-[#64748b] hover:bg-[#ede9e1]"
        >
          Summa {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={28} />}
          title="Qarzdorlar topilmadi"
          theme="light"
        />
      ) : (
        <div className="divide-y divide-[#ede9e1]">
          {sorted.map((s) => (
            <div key={s.id} className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#0f172a] truncate">{s.name}</p>
                  <p
                    className={`text-sm flex items-center gap-1 ${
                      s.hasPaid
                        ? 'text-[#15803d]'
                        : s.status === 'blocked_payment'
                        ? 'text-rose-700'
                        : 'text-[#64748b]'
                    }`}
                  >
                    {s.hasPaid ? (
                      <><CheckCircle size={14} className="shrink-0" /> {formatNumber(s.payment!.amount)} so&apos;m · {s.payment!.paidAt.slice(0, 10)}</>
                    ) : s.status === 'blocked_payment' ? (
                      <><Lock size={14} className="shrink-0" /> Bloklangan</>
                    ) : (
                      <><Clock size={14} className="shrink-0" /> Hali to&apos;lamagan</>
                    )}
                  </p>
                </div>
                {!readOnly && !s.hasPaid && (
                  <button
                    onClick={() => {
                      setSelectedId(s.id);
                      setAmountInput('');
                      setPayError('');
                    }}
                    className="bg-[#0d9488] text-white px-3 py-1 rounded-xl text-sm hover:bg-[#0f766e] shrink-0 min-w-0 transition-colors"
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
                      className="flex-1 border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a]"
                    />
                    <button
                      onClick={() => handlePay(s.id)}
                      disabled={paying}
                      className="bg-[#0d9488] text-white px-4 py-2 rounded-xl text-sm hover:bg-[#0f766e] disabled:opacity-50 transition-colors"
                    >
                      {paying ? '...' : 'Saqlash'}
                    </button>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="px-3 py-2 rounded-xl text-sm text-[#64748b] hover:bg-[#f7f4ef]"
                    >
                      ✕
                    </button>
                  </div>
                  {payError && <p className="text-rose-700 text-sm">{payError}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
