'use client';
import { useEffect, useState } from 'react';
import { Ban, ShieldAlert, ShieldCheck } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

type Blocked = {
  id: string;
  name: string;
  login: string;
  status: 'blocked_warning' | 'blocked_payment';
  branchId: string | null;
  phone: string | null;
};

export default function FiladminBlockedStudentsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Blocked[]>([]);
  const [reason, setReason] = useState<'all' | 'warning' | 'payment'>('all');
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<Blocked | null>(null);
  const [unblockReason, setUnblockReason] = useState('');
  const [saving, setSaving] = useState(false);

  const token = () => localStorage.getItem('accessToken') ?? '';

  function load() {
    setLoading(true);
    const qs = reason === 'all' ? '' : `?reason=${reason}`;
    apiRequest<Blocked[]>(`/users/blocked${qs}`, {}, token())
      .then((res) => setItems(res.data))
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Xatolik'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reason]);

  async function doUnblock() {
    if (!target) return;
    setSaving(true);
    try {
      await apiRequest(
        `/users/${target.id}/unblock`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: unblockReason || undefined }),
        },
        token(),
      );
      toast.success(`${target.name} blokdan chiqarildi`);
      setTarget(null);
      setUnblockReason('');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #e11d48 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#e11d48]/20 flex items-center justify-center">
            <Ban size={18} className="text-[#e11d48]" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
              Filadmin
            </p>
            <p className="text-white font-bold text-lg">
              Bloklangan o&apos;quvchilar
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {(['all', 'warning', 'payment'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
                reason === r
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-white text-[#64748b] border border-[#ede9e1]'
              }`}
            >
              {r === 'all'
                ? 'Hammasi'
                : r === 'warning'
                  ? 'Ogohlantirish'
                  : "To'lov"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-[18px]" theme="light" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              icon={<ShieldCheck size={28} />}
              title="Bloklangan o‘quvchi yo‘q"
              description="Yaxshi! Hozircha hamma faol."
              theme="light"
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((u) => (
              <li
                key={u.id}
                className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 flex items-center gap-3"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    u.status === 'blocked_warning'
                      ? 'bg-amber-50 text-amber-500'
                      : 'bg-rose-50 text-rose-500'
                  }`}
                >
                  {u.status === 'blocked_warning' ? (
                    <ShieldAlert size={18} />
                  ) : (
                    <Ban size={18} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#0f172a] text-sm truncate">
                    {u.name}
                  </p>
                  <p className="text-xs text-[#94a3b8]">
                    {u.login}
                    {u.phone ? ` • ${u.phone}` : ''}
                  </p>
                </div>
                <button
                  onClick={() => setTarget(u)}
                  className="text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2 rounded-xl border border-emerald-200 transition-colors"
                >
                  Blokdan chiqar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={target !== null}
        onClose={() => !saving && setTarget(null)}
        title="Blokdan chiqarish"
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          <span className="font-semibold text-[#0f172a]">{target?.name}</span>{' '}
          blokdan chiqarilsinmi?
          {target?.status === 'blocked_warning'
            ? ' Faol ogohlantirishlar saqlanib qoladi.'
            : " To'lov tarixi saqlanib qoladi."}
        </p>
        <textarea
          value={unblockReason}
          onChange={(e) => setUnblockReason(e.target.value)}
          rows={2}
          placeholder="Sababi (ixtiyoriy)"
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a] mt-3"
        />
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setTarget(null)}
            disabled={saving}
            className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={doUnblock}
            disabled={saving}
            className="text-sm px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saqlanmoqda...' : 'Ha, chiqar'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
