'use client';
import { Phone, Building2, ChevronRight, Clock } from 'lucide-react';

export type ContactRequestStatus =
  | 'new'
  | 'contacted'
  | 'demo_scheduled'
  | 'demo_completed'
  | 'converted'
  | 'declined';

export interface ContactRequest {
  id: string;
  centerName: string;
  contactName: string;
  phone: string;
  email: string | null;
  centerSize: 'small' | 'medium' | 'large' | null;
  message: string | null;
  status: ContactRequestStatus;
  notes: string | null;
  declineReason: string | null;
  handledBy: string | null;
  handledAt: string | null;
  convertedTenantId: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<
  ContactRequestStatus,
  { label: string; cls: string }
> = {
  new: {
    label: 'Yangi',
    cls: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  contacted: {
    label: "Bog'lanildi",
    cls: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  demo_scheduled: {
    label: 'Demo rejada',
    cls: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  demo_completed: {
    label: "Demo o'tdi",
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  converted: {
    label: 'Konvertatsiya',
    cls: 'bg-teal-100 text-teal-700 border-teal-200',
  },
  declined: {
    label: 'Rad etilgan',
    cls: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'hozir';
  if (min < 60) return `${min} daqiqa`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} soat`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} kun`;
  const mo = Math.round(day / 30);
  return `${mo} oy`;
}

interface Props {
  req: ContactRequest;
  onOpen: () => void;
}

export function RequestCard({ req, onOpen }: Props) {
  const badge = STATUS_BADGE[req.status];
  return (
    <button
      onClick={onOpen}
      className="w-full bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] hover:border-violet-300 hover:bg-violet-50/40 p-4 text-left transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#f7f4ef] grid place-items-center text-[#0f172a] shrink-0">
          <Building2 size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[#0f172a] font-bold truncate">
              {req.centerName}
            </p>
            <span
              className={`shrink-0 text-[11px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full border ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <p className="text-[#475569] text-sm font-semibold truncate mt-0.5">
            {req.contactName}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748b] font-semibold">
            <span className="inline-flex items-center gap-1">
              <Phone size={12} /> {req.phone}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {timeAgo(req.createdAt)}
            </span>
          </div>
        </div>
        <ChevronRight size={16} className="text-[#94a3b8] shrink-0 mt-1" />
      </div>
    </button>
  );
}

export { STATUS_BADGE };
