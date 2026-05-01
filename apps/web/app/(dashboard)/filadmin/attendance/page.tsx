'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, Key, Shield, Clock, CheckCircle, Download, ClipboardList } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Button, EmptyState, Skeleton, useToast } from '@/components/ui';
import { formatTime } from '@/lib/date-uz';

type StaffRecord = {
  id: string;
  userId: string;
  loginTime: string | null;
  isLate: boolean;
  recognitionMethod: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  user: { id: string; name: string };
};

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    return typeof payload.branchId === 'string' ? payload.branchId : null;
  } catch {
    return null;
  }
}

function formatTimeOrDash(iso: string | null): string {
  if (!iso) return '—';
  return formatTime(iso) || '—';
}

function lateMinutes(loginTime: string | null): number {
  if (!loginTime) return 0;
  const login = new Date(loginTime);
  const cutoff = new Date(login);
  cutoff.setHours(9, 0, 0, 0);
  return Math.max(0, Math.round((login.getTime() - cutoff.getTime()) / 60000));
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function MethodBadge({ method }: { method: string | null }) {
  if (method === 'face_auto') {
    return (
      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium border border-blue-100">
        <Eye size={10} /> Yuz
      </span>
    );
  }
  if (method === 'manual') {
    return (
      <span className="inline-flex items-center gap-1 bg-[#f7f4ef] text-[#64748b] text-xs px-2 py-1 rounded-full font-medium border border-[#ede9e1]">
        <Key size={10} /> Qo&apos;lda
      </span>
    );
  }
  if (method === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 text-xs px-2 py-1 rounded-full font-medium border border-violet-100">
        <Shield size={10} /> Admin
      </span>
    );
  }
  return <span className="text-[#94a3b8] text-xs">—</span>;
}

function exportCsv(records: StaffRecord[], date: string) {
  const header = ['Xodim', 'Kirish vaqti', 'Usul', 'Kechikish', 'Tasdiqlangan'];
  const rows = records.map((r) => [
    r.user.name,
    formatTime(r.loginTime),
    r.recognitionMethod ?? '—',
    r.isLate ? `+${lateMinutes(r.loginTime)} daq` : "O'z vaqtida",
    r.confirmedAt ? formatTime(r.confirmedAt) : "Yo'q",
  ]);
  const csv = [header, ...rows].map((row) => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const TODAY = new Date().toISOString().split('T')[0];

export default function FiladminAttendancePage() {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [date, setDate] = useState(TODAY);
  const [records, setRecords] = useState<StaffRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  const branchId = getBranchIdFromToken();

  const loadRecords = useCallback(
    async (selectedDate: string) => {
      if (!branchId) return;
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('accessToken') ?? '';
        const res = await apiRequest<StaffRecord[]>(
          `/attendance/staff/${branchId}/${selectedDate}`,
          {},
          token,
        );
        setRecords(res.data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Yuklab bo'lmadi";
        setError(msg);
        toastError(msg);
      } finally {
        setLoading(false);
      }
    },
    [branchId, toastError],
  );

  useEffect(() => {
    loadRecords(date);
  }, [date, loadRecords]);

  async function confirmStaff(userId: string) {
    setConfirming(userId);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(
        `/attendance/staff/confirm/${userId}`,
        { method: 'POST', body: JSON.stringify({ date }) },
        token,
      );
      setRecords((prev) =>
        prev.map((r) =>
          r.userId === userId ? { ...r, confirmedAt: new Date().toISOString() } : r,
        ),
      );
    } catch {
      // user can retry
    } finally {
      setConfirming(null);
    }
  }

  if (!branchId) {
    return (
      <div className="min-h-screen bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#94a3b8] mb-4">
            <ArrowLeft size={18} /> Orqaga
          </button>
          <p className="text-white font-bold text-xl">Xodimlar Davomati</p>
        </div>
        <div className="p-4">
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center">
            <p className="text-[#e11d48] text-sm">Filial topilmadi. Administrator bilan bog&apos;laning.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.push('/filadmin')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Filadmin
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
                <ClipboardList size={18} className="text-[#0d9488]" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">Xodimlar Davomati</p>
                <p className="text-[#64748b] text-xs">{date}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Sana"
                value={date}
                max={TODAY}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#0d9488]"
              />
              {records.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Download size={16} />}
                  onClick={() => exportCsv(records, date)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
                <div className="flex items-center gap-3">
                  <Skeleton theme="light" className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton theme="light" className="h-4 w-1/3" />
                    <Skeleton theme="light" className="h-3 w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : records.length === 0 && !error ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1]">
            <EmptyState
              theme="light"
              icon={<ClipboardList size={28} />}
              title="Bu kun uchun davomat yo'q"
              description="Tanlangan sana uchun davomat ma'lumotlari topilmadi"
            />
          </div>
        ) : !error ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">{records.length} ta xodim</p>
            {records.map((r) => (
              <div key={r.id} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-[#0f172a] flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {getInitials(r.user.name)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[#0f172a] font-semibold text-sm">{r.user.name}</p>
                      {r.isLate && r.loginTime && (
                        <span className="inline-flex items-center gap-1 bg-[#e11d48]/10 text-[#e11d48] text-xs px-2 py-0.5 rounded-full font-medium">
                          <Clock size={10} /> +{lateMinutes(r.loginTime)} daq
                        </span>
                      )}
                      {r.confirmedAt && (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle size={10} /> Tasdiqlangan
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[#64748b] text-xs font-mono">{formatTimeOrDash(r.loginTime)}</span>
                      <MethodBadge method={r.recognitionMethod} />
                    </div>
                  </div>
                  {/* Action */}
                  <div className="shrink-0">
                    {!r.loginTime ? (
                      <span className="text-[#94a3b8] text-xs">Kelmagan</span>
                    ) : r.confirmedAt ? (
                      <span className="text-[#94a3b8] text-xs font-mono">{formatTimeOrDash(r.confirmedAt)}</span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={confirming === r.userId}
                        onClick={() => confirmStaff(r.userId)}
                      >
                        {confirming === r.userId ? '...' : 'Tasdiqlash'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
