'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  AlertTriangle,
  AlertCircle,
  CreditCard,
  CheckCircle2,
  History,
  ShieldOff,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Modal, useToast } from '@/components/ui';
import { formatDateNumeric } from '@/lib/date-uz';

interface UserInfo {
  id: string;
  name: string;
  role: string;
  status: string;
  login: string;
  branchId: string | null;
  groupId: string | null;
  phone: string | null;
}

interface StudentStatus {
  englishStatus: string;
  personalStatus: string;
  criticalStatus: string;
}

interface WarningRow {
  id: string;
  reasonType: string;
  reasonText: string;
  isCancelled: boolean;
  createdAt: string;
}

interface PaymentRow {
  id: string;
  month: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'overdue';
  paidAt: string | null;
}

type StatusColor = 'green' | 'yellow' | 'red' | 'unknown';

function statusColor(value: string): StatusColor {
  if (value === 'yashil') return 'green';
  if (value === 'sariq') return 'yellow';
  if (value === 'qizil') return 'red';
  return 'unknown';
}

const STATUS_CLASSES: Record<StatusColor, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-rose-50 text-rose-700 border-rose-200',
  unknown: 'bg-[#f7f4ef] text-[#94a3b8] border-[#ede9e1]',
};

const STATUS_LABELS: Record<StatusColor, string> = {
  green: 'Yashil',
  yellow: 'Sariq',
  red: 'Qizil',
  unknown: '—',
};

const REASON_OPTIONS = [
  'davomatga kelmadi',
  'xulq-atvor',
  "o'zlashtirish past",
  "to'lov muddati o'tdi",
  'boshqa',
];

export default function FiladminStudentDetailPage() {
  const router = useRouter();
  const { id: studentId } = useParams<{ id: string }>();
  const toast = useToast();

  const [student, setStudent] = useState<UserInfo | null>(null);
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  // Issue-warning modal
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningReason, setWarningReason] = useState(REASON_OPTIONS[0]);
  const [warningNote, setWarningNote] = useState('');
  const [savingWarning, setSavingWarning] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    const token = localStorage.getItem('accessToken') ?? '';

    async function load() {
      try {
        const userRes = await apiRequest<UserInfo>(`/users/${studentId}`, {}, token);
        setStudent(userRes.data);

        const [statusRes, warningsRes, paymentsRes] = await Promise.all([
          apiRequest<StudentStatus>(`/status/${studentId}`, {}, token).catch(
            () => ({ data: null as StudentStatus | null }),
          ),
          apiRequest<WarningRow[]>(`/warnings/${studentId}`, {}, token).catch(
            () => ({ data: [] as WarningRow[] }),
          ),
          apiRequest<PaymentRow[]>(`/payments/${studentId}/status`, {}, token).catch(
            () => ({ data: [] as PaymentRow[] }),
          ),
        ]);

        setStatus(statusRes.data);
        setWarnings(warningsRes.data ?? []);
        setPayments(paymentsRes.data ?? []);
      } catch (err) {
        setFatalError(err instanceof Error ? err.message : 'Yuklab boʻlmadi');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [studentId]);

  async function submitWarning() {
    if (!studentId) return;
    setSavingWarning(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<WarningRow>(
        `/warnings/${studentId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            reasonType: warningReason,
            reasonText: warningNote.trim() || warningReason,
          }),
        },
        token,
      );
      setWarnings((prev) => [res.data, ...prev]);
      setWarningModalOpen(false);
      setWarningNote('');
      toast.success("Ogohlantirish yuborildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Saqlab boʻlmadi');
    } finally {
      setSavingWarning(false);
    }
  }

  async function cancelWarning(warningId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        `/warnings/${warningId}/cancel`,
        {
          method: 'PATCH',
          body: JSON.stringify({ reason: 'Filadmin tomonidan bekor qilindi' }),
        },
        token,
      );
      setWarnings((prev) =>
        prev.map((w) => (w.id === warningId ? { ...w, isCancelled: true } : w)),
      );
      toast.success("Bekor qilindi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    }
  }

  if (fatalError) {
    return (
      <div className="min-h-full bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-6 text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
            <AlertCircle size={24} className="text-rose-600" />
          </div>
          <h1 className="text-rose-600 font-bold text-lg">Xato yuz berdi</h1>
          <p className="text-sm text-[#64748b]">{fatalError}</p>
          <button
            onClick={() => router.push('/filadmin/students')}
            className="bg-[#0f172a] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1e293b] transition-colors"
          >
            Roʻyxatga qaytish
          </button>
        </div>
      </div>
    );
  }

  const activeWarnings = warnings.filter((w) => !w.isCancelled);
  const isBlocked = student?.status === 'blocked_warning' || student?.status === 'blocked_payment';
  const unpaid = payments.filter((p) => p.status !== 'paid').length;

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/filadmin/students')}
            className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} /> Roʻyxat
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
              <User size={20} className="text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              {loading ? (
                <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
              ) : (
                <p className="text-white font-bold text-lg truncate">
                  {student?.name ?? 'Nomaʼlum'}
                </p>
              )}
              <p className="text-[#94a3b8] text-xs font-semibold flex items-center gap-2 mt-0.5">
                <span>{student?.login ? `@${student.login}` : ''}</span>
                {isBlocked && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300">
                    <ShieldOff size={10} /> Bloklangan
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 pt-5 pb-6 space-y-4">
        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setWarningReason(REASON_OPTIONS[0]);
              setWarningNote('');
              setWarningModalOpen(true);
            }}
            disabled={!student}
            className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-[#f7f4ef] disabled:opacity-50 transition-colors"
          >
            <AlertTriangle size={18} className="text-amber-600" />
            <span className="text-xs font-bold text-[#0f172a]">Ogohlantirish</span>
          </button>
          <Link
            href={`/filadmin/students/${studentId}/history`}
            className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-[#f7f4ef] transition-colors"
          >
            <History size={18} className="text-[#0d9488]" />
            <span className="text-xs font-bold text-[#0f172a]">Tarix</span>
          </Link>
          <Link
            href="/filadmin/payments"
            className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-3 flex flex-col items-center justify-center gap-1.5 hover:bg-[#f7f4ef] transition-colors"
          >
            <CreditCard size={18} className="text-blue-600" />
            <span className="text-xs font-bold text-[#0f172a]">Toʻlovlar</span>
          </Link>
        </div>

        {/* Status pills */}
        <section className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-5">
          <p className="text-xs font-bold text-[#64748b] uppercase tracking-widest mb-3">Holat</p>
          {loading ? (
            <p className="text-sm text-[#94a3b8]">Yuklanmoqda...</p>
          ) : status ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { label: 'Ingliz tili', value: status.englishStatus },
                  { label: 'Shaxsiy', value: status.personalStatus },
                  { label: 'Tanqidiy', value: status.criticalStatus },
                ] as const
              ).map(({ label, value }) => {
                const c = statusColor(value);
                return (
                  <span
                    key={label}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${STATUS_CLASSES[c]}`}
                  >
                    {label}: {STATUS_LABELS[c]}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#94a3b8]">Status hali belgilanmagan</p>
          )}
        </section>

        {/* Warnings */}
        <section className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#ede9e1] flex items-center justify-between">
            <p className="text-xs font-bold text-[#64748b] uppercase tracking-widest">
              Ogohlantirishlar
            </p>
            {activeWarnings.length >= 3 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                <ShieldOff size={11} /> Blokda ({activeWarnings.length})
              </span>
            ) : activeWarnings.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle size={11} /> {activeWarnings.length}/3
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck size={11} /> Toza
              </span>
            )}
          </div>
          {loading ? (
            <p className="px-5 py-4 text-sm text-[#94a3b8]">Yuklanmoqda...</p>
          ) : warnings.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#94a3b8] text-center">
              Hech qanday ogohlantirish yoʻq
            </p>
          ) : (
            <ul className="divide-y divide-[#ede9e1]">
              {warnings.map((w) => (
                <li key={w.id} className="px-5 py-3 flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      w.isCancelled
                        ? 'bg-[#f7f4ef] text-[#94a3b8]'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {w.isCancelled ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-bold truncate ${
                        w.isCancelled ? 'text-[#94a3b8] line-through' : 'text-[#0f172a]'
                      }`}
                    >
                      {w.reasonText || w.reasonType}
                    </p>
                    <p className="text-[11px] font-bold text-[#94a3b8] mt-0.5">
                      {formatDateNumeric(w.createdAt)} · {w.reasonType}
                    </p>
                  </div>
                  {!w.isCancelled && (
                    <button
                      type="button"
                      onClick={() => cancelWarning(w.id)}
                      className="text-[11px] font-bold text-[#0d9488] hover:underline shrink-0"
                    >
                      Bekor qilish
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Payments — last 6 months */}
        <section className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#ede9e1] flex items-center justify-between">
            <p className="text-xs font-bold text-[#64748b] uppercase tracking-widest">
              Toʻlov tarixi
            </p>
            {unpaid > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                <CreditCard size={11} /> {unpaid} ta toʻlanmagan
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 size={11} /> Hammasi toʻlangan
              </span>
            )}
          </div>
          {loading ? (
            <p className="px-5 py-4 text-sm text-[#94a3b8]">Yuklanmoqda...</p>
          ) : payments.length === 0 ? (
            <p className="px-5 py-6 text-sm text-[#94a3b8] text-center">
              Toʻlov yozuvlari yoʻq
            </p>
          ) : (
            <ul className="divide-y divide-[#ede9e1]">
              {payments.slice(0, 6).map((p) => (
                <li
                  key={p.id}
                  className="px-5 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0f172a]">{p.month}</p>
                    <p className="text-[11px] font-bold text-[#94a3b8]">
                      {p.paidAt ? `Toʻlandi: ${formatDateNumeric(p.paidAt)}` : 'Toʻlanmagan'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-[#0f172a] font-mono">
                      {Math.round(p.amount).toLocaleString('uz-UZ')}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        p.status === 'paid'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : p.status === 'overdue'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {p.status === 'paid'
                        ? 'Paid'
                        : p.status === 'overdue'
                          ? 'Overdue'
                          : 'Unpaid'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Issue-warning modal */}
      <Modal
        open={warningModalOpen}
        onClose={() => !savingWarning && setWarningModalOpen(false)}
        title="Ogohlantirish berish"
        description={`${student?.name ?? 'Oʻquvchi'} uchun yangi ogohlantirish`}
        footer={
          <>
            <button
              onClick={() => setWarningModalOpen(false)}
              disabled={savingWarning}
              className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={submitWarning}
              disabled={savingWarning}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {savingWarning ? '...' : (
                <>
                  <AlertTriangle size={14} /> Yuborish
                </>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Sabab turi
            </label>
            <select
              value={warningReason}
              onChange={(e) => setWarningReason(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-amber-500"
            >
              {REASON_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">
              Izoh (ixtiyoriy)
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={warningNote}
              onChange={(e) => setWarningNote(e.target.value)}
              placeholder="Qoʻshimcha tafsilot..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:border-amber-500"
            />
          </div>
          {activeWarnings.length >= 2 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={14} className="text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-rose-800 leading-snug">
                Diqqat: bu {activeWarnings.length + 1}-ogohlantirish boʻladi.
                {activeWarnings.length + 1 >= 3 && ' Hisob avtomatik bloklanadi.'}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
