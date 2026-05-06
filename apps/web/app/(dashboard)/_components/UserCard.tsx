'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export type UserStatusColor = 'yashil' | 'sariq' | 'qizil' | '';

export interface UserCardProps {
  /** User entity */
  id: string;
  name: string;
  /** Optional sub-line (group, role, etc.) */
  subtitle?: string;
  /** Status indicator (worst-of for students; '' = no badge) */
  status?: UserStatusColor;
  /** Optional last-attendance / right-side meta line */
  meta?: string;
  /** Where the row links to */
  href?: string;
  /** Trailing custom node (overrides ChevronRight when provided) */
  trailing?: React.ReactNode;
  /** Click handler — used when `href` is not given */
  onClick?: () => void;
}

const STATUS_DOT: Record<UserStatusColor, string> = {
  yashil: 'bg-emerald-500',
  sariq: 'bg-amber-500',
  qizil: 'bg-rose-500',
  '': 'bg-slate-300',
};

const STATUS_LABEL: Record<UserStatusColor, string> = {
  yashil: 'Yashil',
  sariq: 'Sariq',
  qizil: 'Qizil',
  '': 'Status yoʻq',
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

/**
 * UserCard — reusable user row used by `manager/students`,
 * `filadmin/students`, and similar lists. Matches palette of other
 * dashboards (cream body, navy text, status dot).
 */
export function UserCard({
  id,
  name,
  subtitle,
  status = '',
  meta,
  href,
  trailing,
  onClick,
}: UserCardProps) {
  const inner = (
    <div className="bg-white rounded-[14px] px-4 py-3 border-[1.5px] border-[#ede9e1] flex items-center gap-3 hover:border-[#cbd5e1] transition-colors">
      <div className="w-9 h-9 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#0f172a] text-sm font-black shrink-0">
        {getInitials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[#0f172a] text-sm font-semibold truncate">{name}</p>
        {(subtitle || meta) && (
          <p className="text-[#94a3b8] text-[11px] truncate">
            {[subtitle, meta].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      {status !== undefined && (
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[status]}`}
          aria-label={STATUS_LABEL[status]}
          title={STATUS_LABEL[status]}
        />
      )}
      {trailing ?? <ChevronRight size={15} className="text-[#94a3b8] shrink-0" />}
    </div>
  );

  if (href) {
    return (
      <Link key={id} href={href} className="block">
        {inner}
      </Link>
    );
  }
  return (
    <button
      key={id}
      type="button"
      onClick={onClick}
      className="w-full text-left"
    >
      {inner}
    </button>
  );
}
