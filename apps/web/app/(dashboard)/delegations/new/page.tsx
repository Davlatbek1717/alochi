'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, GitBranch, Calendar, ChevronDown } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type BranchUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  login: string;
};

const ROLE_LABELS: Record<string, string> = {
  mentor: 'Mentor', manager: 'Menejer', filadmin: 'Filadmin',
};

function NewDelegationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState(searchParams.get('reason') ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [staffUsers, setStaffUsers] = useState<BranchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let branchId = '';
    try {
      const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
      branchId = user.branchId ?? '';
    } catch {
      // malformed JSON — branchId stays empty
    }

    apiRequest<BranchUser[]>(`/users/by-branch/${branchId}`, {}, token)
      .then((res) => setStaffUsers(res.data.filter((u) => u.role !== 'student')))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Sabab maydoni majburiy');
      return;
    }
    setError('');
    setSubmitting(true);

    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as {
      tenantId?: string; id?: string; branchId?: string;
    };

    try {
      await apiRequest('/delegations', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: user.tenantId ?? '',
          branchId: user.branchId ?? '',
          fromUserId: user.id ?? '',
          toUserId: selectedRecipient,
          delegatedRole: 'manager',
          permissions: ['warnings', 'payments'],
          reason,
          startsAt,
          endsAt,
        }),
      }, token);
      router.push('/delegations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
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
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Orqaga
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
              <GitBranch size={18} className="text-[#0d9488]" />
            </div>
            <p className="text-white font-bold text-lg">Yangi Delegatsiya</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Oluvchi xodim *</p>
            <div className="relative">
              <select
                value={selectedRecipient}
                onChange={(e) => setSelectedRecipient(e.target.value)}
                disabled={loadingUsers}
                aria-label="Oluvchi xodimni tanlang"
                className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm font-medium focus:outline-none focus:border-[#0f172a] disabled:opacity-60 pr-10"
                required
              >
                <option value="">
                  {loadingUsers ? 'Yuklanmoqda...' : 'Tanlang...'}
                </option>
                {staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({ROLE_LABELS[u.role] ?? u.role})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none" />
            </div>
          </div>

          {/* Dates */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest flex items-center gap-2">
              <Calendar size={12} /> Muddat
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Boshlanish</label>
                <input
                  type="date"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#94a3b8] mb-1">Tugash</label>
                <input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a]"
                />
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Sabab *</p>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
              rows={3}
              aria-label="Delegatsiya sababi"
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] resize-none"
              placeholder="Nima uchun delegatsiya bermoqchisiz?"
            />
            {error && <p className="text-[#e11d48] text-sm">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#0f172a] text-white py-4 rounded-xl font-bold text-sm disabled:opacity-60 hover:bg-[#1e293b] transition-colors"
          >
            {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NewDelegationPage() {
  return (
    <Suspense fallback={null}>
      <NewDelegationForm />
    </Suspense>
  );
}
