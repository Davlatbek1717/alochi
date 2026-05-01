'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  BookX,
  FileX,
  ShieldAlert,
  HelpCircle,
  History,
  Undo2,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  Button,
  EmptyState,
  Modal,
  Skeleton,
  useToast,
} from '@/components/ui';
import { formatDateNumeric } from '@/lib/date-uz';

const REASON_TYPES = [
  { value: 'not_prepared', label: 'Darsga tayyorlanmagan', icon: <BookX size={18} /> },
  { value: 'no_homework', label: 'Vazifalarni bajarmagan', icon: <FileX size={18} /> },
  { value: 'discipline', label: 'Intizom buzilishi', icon: <ShieldAlert size={18} /> },
  { value: 'other', label: 'Boshqa', icon: <HelpCircle size={18} /> },
];

const REASON_LABEL: Record<string, string> = Object.fromEntries(
  REASON_TYPES.map((r) => [r.value, r.label]),
);

type Student = { id: string; name: string };

type Warning = {
  id: string;
  studentId: string;
  reasonType: string;
  reasonText: string;
  isCancelled: boolean;
  createdAt: string;
  student?: { name: string };
};

function getTokenPayload(): {
  userId: string;
  branchId: string;
  tenantId: string;
} {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as {
      sub?: string;
      branchId?: string;
      tenantId?: string;
    };
    return {
      userId: payload.sub ?? '',
      branchId: payload.branchId ?? '',
      tenantId: payload.tenantId ?? '',
    };
  } catch {
    return { userId: '', branchId: '', tenantId: '' };
  }
}

export default function WarningsPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const me = useMemo(() => getTokenPayload(), []);
  const [tab, setTab] = useState<'give' | 'history'>('give');

  // Give form
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [reasonType, setReasonType] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // History
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Warning | null>(null);
  const [cancelText, setCancelText] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    if (!me.branchId) {
      setLoadingStudents(false);
      return;
    }
    apiRequest<{ id: string; name: string; role: string }[]>(
      `/users/by-branch/${me.branchId}`,
      {},
      token(),
    )
      .then((res) => {
        setStudents(res.data.filter((u) => u.role === 'student'));
      })
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, [me.branchId]);

  function loadHistory() {
    if (!me.branchId) return;
    setLoadingHistory(true);
    apiRequest<Warning[]>(
      `/warnings/by-branch/${me.branchId}`,
      {},
      token(),
    )
      .then((res) => setWarnings(res.data))
      .catch((err) =>
        toastError(err instanceof Error ? err.message : 'Xatolik'),
      )
      .finally(() => setLoadingHistory(false));
  }

  useEffect(() => {
    if (tab === 'history') loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reasonText.trim() || !reasonType || !selectedStudent) return;
    setSubmitting(true);
    try {
      await apiRequest(
        `/warnings/${selectedStudent}`,
        {
          method: 'POST',
          body: JSON.stringify({
            tenantId: me.tenantId,
            givenBy: me.userId,
            reasonType,
            reasonText,
          }),
        },
        token(),
      );
      success('Ogohlantirish berildi');
      setSelectedStudent('');
      setReasonType('');
      setReasonText('');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  async function doCancel() {
    if (!cancelTarget) return;
    if (!cancelText.trim()) {
      toastError('Bekor qilish sababi majburiy');
      return;
    }
    setCancelling(true);
    try {
      await apiRequest(
        `/warnings/${cancelTarget.id}/cancel`,
        {
          method: 'PATCH',
          body: JSON.stringify({ reason: cancelText.trim() }),
        },
        token(),
      );
      success('Ogohlantirish bekor qilindi');
      setCancelTarget(null);
      setCancelText('');
      loadHistory();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #e11d48 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/filadmin')}
            className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm"
          >
            <ArrowLeft size={16} /> Filadmin
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#e11d48]/20 flex items-center justify-center">
              <AlertTriangle size={18} className="text-[#e11d48]" />
            </div>
            <p className="text-white font-bold text-lg">Ogohlantirishlar</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {(['give', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 rounded-xl text-sm font-bold transition-colors ${
                tab === t
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-white text-[#64748b] border border-[#ede9e1]'
              }`}
            >
              {t === 'give' ? 'Berish' : 'Tarix'}
            </button>
          ))}
        </div>

        {tab === 'give' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                O&apos;quvchi *
              </p>
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                aria-label="O'quvchini tanlang"
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm font-medium focus:outline-none focus:border-[#0f172a]"
                required
                disabled={loadingStudents}
              >
                <option value="">
                  {loadingStudents
                    ? 'Yuklanmoqda...'
                    : "O'quvchi tanlang..."}
                </option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                Turi *
              </p>
              <div className="grid grid-cols-2 gap-2">
                {REASON_TYPES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReasonType(r.value)}
                    className={`p-3 rounded-xl border-[1.5px] flex items-center gap-2 text-left transition-all ${
                      reasonType === r.value
                        ? 'border-[#e11d48] bg-[#e11d48]/5 text-[#e11d48]'
                        : 'border-[#ede9e1] bg-[#f7f4ef] text-[#64748b] hover:border-[#0f172a]'
                    }`}
                  >
                    <span className="shrink-0">{r.icon}</span>
                    <span className="text-xs font-semibold leading-tight">
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
              <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
                Izoh (majburiy) *
              </p>
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                rows={3}
                required
                aria-label="Ogohlantirish sababi"
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] resize-none"
                placeholder="Ogohlantirish sababi..."
              />
            </div>

            <Button
              type="submit"
              variant="danger"
              fullWidth
              size="lg"
              loading={submitting}
              icon={<AlertTriangle size={18} />}
            >
              Ogohlantirish Berish
            </Button>
          </form>
        ) : loadingHistory ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-[18px]" theme="light" />
            ))}
          </div>
        ) : warnings.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<History size={28} />}
              title="Faol ogohlantirishlar yo‘q"
              description="Bu filialda hozircha hech kim ogohlantirilmagan"
              theme="light"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">
              {warnings.length} ta faol ogohlantirish
            </p>
            {warnings.map((w) => (
              <div
                key={w.id}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0f172a] text-sm">
                      {w.student?.name ?? w.studentId}
                    </p>
                    <p className="text-xs text-[#e11d48] font-semibold">
                      {REASON_LABEL[w.reasonType] ?? w.reasonType}
                    </p>
                  </div>
                  <span className="text-xs text-[#94a3b8] shrink-0">
                    {formatDateNumeric(w.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-[#64748b] italic">
                  &quot;{w.reasonText}&quot;
                </p>
                <button
                  onClick={() => setCancelTarget(w)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#f7f4ef] text-[#64748b] hover:bg-[#ede9e1] hover:text-[#0f172a] px-3 py-1.5 rounded-lg border border-[#ede9e1]"
                >
                  <Undo2 size={12} />
                  Bekor qilish
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={cancelTarget !== null}
        onClose={() => !cancelling && setCancelTarget(null)}
        title="Ogohlantirishni bekor qilish"
        theme="light"
      >
        <p className="text-sm text-[#64748b] mb-3">
          Bekor qilish sababini kiriting (majburiy):
        </p>
        <textarea
          value={cancelText}
          onChange={(e) => setCancelText(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Sababi..."
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setCancelTarget(null)}
            disabled={cancelling}
            className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={doCancel}
            disabled={cancelling || !cancelText.trim()}
            className="text-sm px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 disabled:opacity-50"
          >
            {cancelling ? 'Saqlanmoqda...' : 'Ha, bekor qil'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
