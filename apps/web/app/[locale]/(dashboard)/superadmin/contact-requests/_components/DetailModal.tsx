'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Phone,
  Mail,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  PlayCircle,
  Send,
} from 'lucide-react';
import { Button, useToast } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import type { ContactRequest, ContactRequestStatus } from './RequestCard';
import { STATUS_BADGE } from './RequestCard';

interface Props {
  open: boolean;
  request: ContactRequest | null;
  onClose: () => void;
  onUpdated: (req: ContactRequest) => void;
}

const SIZE_LABEL: Record<string, string> = {
  small: '< 50',
  medium: '51–200',
  large: '200+',
};

export function DetailModal({ open, request, onClose, onUpdated }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [notes, setNotes] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [showDecline, setShowDecline] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setNotes(request?.notes ?? '');
    setDeclineReason(request?.declineReason ?? '');
    setShowDecline(false);
  }, [request?.id, request?.notes, request?.declineReason]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || !request) return null;

  const token = () => localStorage.getItem('accessToken') ?? '';

  async function patch(
    body: Partial<{
      status: ContactRequestStatus;
      notes: string;
      declineReason: string;
    }>,
    label: string,
  ) {
    if (!request) return;
    setBusy(label);
    try {
      const res = await apiRequest<ContactRequest>(
        `/contact-requests/${request.id}`,
        { method: 'PATCH', body: JSON.stringify(body) },
        token(),
      );
      onUpdated(res.data);
      toast.success(`Saqlandi: ${label}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(null);
    }
  }

  async function saveNotes() {
    if (!request) return;
    if ((notes ?? '') === (request.notes ?? '')) return;
    await patch({ notes }, 'Eslatma');
  }

  async function submitDecline() {
    if (!declineReason.trim()) {
      toast.error("Sababini yozing");
      return;
    }
    await patch(
      { status: 'declined', declineReason: declineReason.trim() },
      'Rad etildi',
    );
    setShowDecline(false);
  }

  function gotoConvert() {
    router.push(`/superadmin/tenants/new?prefill=${request!.id}`);
  }

  const badge = STATUS_BADGE[request.status];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#e8e0d0] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Yopish"
          className="absolute top-3.5 right-3.5 grid place-items-center w-9 h-9 rounded-full bg-[#0f172a]/5 hover:bg-[#0f172a]/10 text-[#1e1b4b] z-10"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="px-6 pt-6 pb-4 border-b border-[#ede9e1]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 grid place-items-center text-violet-700 shrink-0">
              <Building2 size={22} />
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <h2 className="text-xl font-extrabold text-[#1e1b4b] truncate">
                {request.centerName}
              </h2>
              <span
                className={`mt-1 inline-block text-[11px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full border ${badge.cls}`}
              >
                {badge.label}
              </span>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {/* Info */}
          <div className="grid sm:grid-cols-2 gap-3">
            <InfoRow icon={<Users size={14} />} label="F.I.O." value={request.contactName} />
            <InfoRow icon={<Phone size={14} />} label="Telefon" value={request.phone} />
            {request.email && (
              <InfoRow icon={<Mail size={14} />} label="Email" value={request.email} />
            )}
            <InfoRow
              icon={<Building2 size={14} />}
              label="Hajm"
              value={request.centerSize ? SIZE_LABEL[request.centerSize] ?? request.centerSize : '—'}
            />
          </div>
          {request.message && (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#64748b] mb-1.5">
                Xabar
              </p>
              <div className="rounded-xl bg-[#f7f4ef] border border-[#ede9e1] px-4 py-3 text-sm font-semibold text-[#1e1b4b] whitespace-pre-wrap">
                {request.message}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-extrabold uppercase tracking-widest text-[#64748b] mb-1.5">
              Eslatma (ichki)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => void saveNotes()}
              rows={3}
              maxLength={2000}
              placeholder="Superadmin uchun ichki eslatmalar"
              className="w-full bg-[#fffaf0] border-2 border-[#e8e0d0] rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#1e1b4b] focus:border-violet-500 focus:bg-white outline-none resize-none"
            />
          </div>

          {request.declineReason && (
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#b91c1c] mb-1.5">
                Rad sababi
              </p>
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700">
                {request.declineReason}
              </div>
            </div>
          )}

          {showDecline && (
            <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4">
              <label className="block text-[11px] font-extrabold uppercase tracking-widest text-rose-700 mb-1.5">
                Rad sababi
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Spam, nomos so'rov, va h.k."
                className="w-full bg-white border-2 border-rose-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#1e1b4b] focus:border-rose-500 outline-none resize-none"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDecline(false)}
                >
                  Bekor
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={busy === 'Rad etildi'}
                  onClick={() => void submitDecline()}
                >
                  Tasdiqlash
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#ede9e1] bg-[#f7f4ef]/60 flex flex-wrap gap-2">
          <ActionBtn
            icon={<Send size={14} />}
            label="Bog'landim"
            color="blue"
            disabled={busy !== null || request.status === 'contacted'}
            loading={busy === "Bog'landim"}
            onClick={() => void patch({ status: 'contacted' }, "Bog'landim")}
          />
          <ActionBtn
            icon={<PlayCircle size={14} />}
            label="Demo o'tkazildi"
            color="emerald"
            disabled={busy !== null || request.status === 'demo_completed'}
            loading={busy === "Demo o'tkazildi"}
            onClick={() => void patch({ status: 'demo_completed' }, "Demo o'tkazildi")}
          />
          <ActionBtn
            icon={<CheckCircle2 size={14} />}
            label="Markaz yaratish"
            color="violet"
            disabled={busy !== null || request.status === 'converted'}
            onClick={gotoConvert}
          />
          <ActionBtn
            icon={<XCircle size={14} />}
            label="Rad etish"
            color="rose"
            disabled={busy !== null || request.status === 'declined'}
            onClick={() => setShowDecline(true)}
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-[#64748b] mb-1">
        {icon}
        {label}
      </p>
      <p className="text-sm font-bold text-[#1e1b4b] break-all">{value}</p>
    </div>
  );
}

const COLOR_CLASS: Record<string, string> = {
  blue: 'bg-blue-600 hover:bg-blue-500 text-white',
  emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  violet: 'bg-violet-600 hover:bg-violet-500 text-white',
  rose: 'bg-rose-600 hover:bg-rose-500 text-white',
};

function ActionBtn({
  icon,
  label,
  color,
  onClick,
  disabled,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  color: 'blue' | 'emerald' | 'violet' | 'rose';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const cls = COLOR_CLASS[color];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {label}
    </button>
  );
}

export type { ContactRequest };
