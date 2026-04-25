'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default function NewDelegationPage() {
  const router = useRouter();
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Sabab maydoni majburiy');
      return;
    }
    setError('');
    setSubmitting(true);

    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');

    try {
      await apiRequest('/delegations', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: user.tenantId ?? '',
          branchId: user.tenantId ?? '',
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
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold">Yangi Delegatsiya</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Oluvchi xodim *</label>
          <select
            value={selectedRecipient}
            onChange={(e) => setSelectedRecipient(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
            required
          >
            <option value="">Tanlang...</option>
            <option value="user_alisher">Alisher Toshev (Manager)</option>
            <option value="user_kamola">Kamola Nazarova (Mentor)</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Boshlanish</label>
            <input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tugash</label>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Sabab *</label>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
            rows={3}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Nima uchun delegatsiya bermoqchisiz?"
          />
          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium disabled:opacity-60"
        >
          {submitting ? 'Yuborilmoqda...' : 'Yuborish'}
        </button>
      </form>
    </div>
  );
}
