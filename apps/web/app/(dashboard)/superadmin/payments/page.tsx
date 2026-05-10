'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CreditCard, Settings, ChevronRight, Users, CheckCircle, XCircle, Lock } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import MonthPicker from '../../_components/MonthPicker';
import { Skeleton, EmptyState, useToast } from '@/components/ui';
import { formatNumber } from '@/lib/date-uz';
import { tashkentToday } from '@/lib/tashkent-date';

interface BranchPaymentSummary {
  branchId: string;
  branchName: string;
  total: number;
  paid: number;
  unpaid: number;
  blocked: number;
  totalCollected: number;
}

interface PaymentSettings {
  paymentStartDay: number;
  paymentEndDay: number;
}

function PaymentSettingsPanel() {
  const [settings, setSettings] = useState<PaymentSettings | null>(null);
  const [editing, setEditing] = useState(false);
  const [startDay, setStartDay] = useState('');
  const [endDay, setEndDay] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<PaymentSettings>('/payment-settings', {}, token)
      .then((res) => {
        setSettings(res.data);
        setStartDay(String(res.data?.paymentStartDay ?? 1));
        setEndDay(String(res.data?.paymentEndDay ?? 25));
      })
      .catch(() => {
        setStartDay('1');
        setEndDay('25');
      });
  }, []);

  async function save() {
    setSaving(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<PaymentSettings>('/payment-settings', {
        method: 'PUT',
        body: JSON.stringify({ startDay: Number(startDay), endDay: Number(endDay) }),
      }, token);
      setSettings(res.data);
      setEditing(false);
      toast.success("To'lov muddati saqlandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-[#64748b]" />
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">To&apos;lov muddati</p>
        </div>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs font-bold text-[#0f172a] hover:underline">
            Tahrirlash
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="flex gap-4">
            <div>
              <label className="block text-xs text-[#94a3b8] mb-1">Boshlanish kuni</label>
              <input
                type="number" min={1} max={28}
                value={startDay}
                onChange={(e) => setStartDay(e.target.value)}
                className="w-20 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#0f172a]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#94a3b8] mb-1">Tugash kuni</label>
              <input
                type="number" min={1} max={31}
                value={endDay}
                onChange={(e) => setEndDay(e.target.value)}
                className="w-20 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#0f172a]"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="bg-[#0f172a] text-white text-xs px-4 py-2 rounded-xl font-bold disabled:opacity-50"
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-[#64748b] px-3 py-2 rounded-xl border border-[#ede9e1] font-semibold"
            >
              Bekor
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#0f172a]">
          Har oyning <span className="font-bold text-[#0d9488]">{settings?.paymentStartDay ?? '—'}</span> dan{' '}
          <span className="font-bold text-[#0d9488]">{settings?.paymentEndDay ?? '—'}</span> gacha
        </p>
      )}
    </div>
  );
}

function currentMonth() {
  return tashkentToday().slice(0, 7);
}

function BranchCard({ summary, month }: { summary: BranchPaymentSummary; month: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/superadmin/payments/${summary.branchId}?month=${month}`)}
      className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 text-left hover:border-[#0f172a] transition-all w-full"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="font-bold text-[#0f172a] text-sm">{summary.branchName}</p>
        <ChevronRight size={16} className="text-[#94a3b8]" />
      </div>
      {summary.total === 0 ? (
        <p className="text-sm text-[#94a3b8]">O&apos;quvchilar yo&apos;q</p>
      ) : (
        <>
          <div className="flex items-center gap-1 mb-3">
            <Users size={12} className="text-[#94a3b8]" />
            <span className="text-xs text-[#64748b]">{summary.total} o&apos;quvchi</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <CheckCircle size={10} className="text-emerald-500" />
                <span className="text-emerald-600 font-bold text-sm">{summary.paid}</span>
              </div>
              <p className="text-[10px] text-[#94a3b8]">To&apos;lagan</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <XCircle size={10} className="text-[#64748b]" />
                <span className="text-[#64748b] font-bold text-sm">{summary.unpaid}</span>
              </div>
              <p className="text-[10px] text-[#94a3b8]">Qarzdor</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Lock size={10} className="text-[#e11d48]" />
                <span className="text-[#e11d48] font-bold text-sm">{summary.blocked}</span>
              </div>
              <p className="text-[10px] text-[#94a3b8]">Bloklangan</p>
            </div>
          </div>
          <div className="bg-[#0d9488]/10 border border-[#0d9488]/20 rounded-xl px-3 py-2">
            <p className="text-xs font-bold text-[#0d9488]">
              Yig&apos;ilgan: {formatNumber(summary.totalCollected)} so&apos;m
            </p>
          </div>
        </>
      )}
    </button>
  );
}

function SuperadminPaymentsContent() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [month, setMonth] = useState(searchParams.get('month') ?? currentMonth());
  const [summaries, setSummaries] = useState<BranchPaymentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);

  async function fetchSummary(selectedMonth: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setFetching(true);
    try {
      const res = await apiRequest<BranchPaymentSummary[]>(
        `/payments/summary?month=${selectedMonth}`,
        {},
        token,
      );
      setSummaries(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchSummary(month);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleMonthChange(m: string) {
    setMonth(m);
    fetchSummary(m);
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
                <CreditCard size={18} className="text-[#0d9488]" />
              </div>
              <p className="text-white font-bold text-lg">To&apos;lov Hisoboti</p>
            </div>
            <MonthPicker value={month} onChange={handleMonthChange} />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-4">
        <PaymentSettingsPanel />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
                <Skeleton className="h-5 w-32 mb-3" theme="light" />
                <Skeleton className="h-4 w-20 mb-2" theme="light" />
                <Skeleton className="h-4 w-40" theme="light" />
              </div>
            ))}
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<CreditCard size={28} />}
              title="Filiallar topilmadi"
              description="Bu oy uchun to'lov ma'lumotlari yo'q"
              theme="light"
            />
          </div>
        ) : (
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity ${fetching ? 'opacity-50' : ''}`}>
            {summaries.map((s) => (
              <BranchCard key={s.branchId} summary={s} month={month} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SuperadminPaymentsPage() {
  return (
    <Suspense fallback={null}>
      <SuperadminPaymentsContent />
    </Suspense>
  );
}
