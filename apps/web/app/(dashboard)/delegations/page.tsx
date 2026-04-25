'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';

type DelegationStatus = 'active' | 'pending' | 'completed' | 'rejected' | 'cancelled';

type ApiDelegation = {
  id: string;
  status: DelegationStatus;
  fromUser: { name: string };
  toUser: { name: string };
  delegatedRole: string;
  reason: string;
  startsAt: string;
  endsAt: string;
};

type Delegation = {
  id: string;
  status: DelegationStatus;
  from: string;
  to: string;
  role: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

const STATUS_CONFIG: Record<DelegationStatus, { icon: string; color: string; label: string }> = {
  active: { icon: '🟢', color: 'text-green-700 bg-green-50', label: 'Faol' },
  pending: { icon: '⏳', color: 'text-yellow-700 bg-yellow-50', label: 'Kutilmoqda' },
  completed: { icon: '✅', color: 'text-blue-700 bg-blue-50', label: 'Tugadi' },
  rejected: { icon: '❌', color: 'text-red-700 bg-red-50', label: 'Rad etildi' },
  cancelled: { icon: '🚫', color: 'text-gray-700 bg-gray-100', label: 'Bekor qilindi' },
};

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short' });
  } catch {
    return isoDate;
  }
}

export default function DelegationsPage() {
  const [activeTab, setActiveTab] = useState<DelegationStatus | 'all'>('all');
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchDelegations() {
      try {
        const res = await apiRequest<ApiDelegation[]>('/delegations', {}, token);
        const mapped: Delegation[] = res.data.map((d) => ({
          id: d.id,
          status: d.status,
          from: d.fromUser.name,
          to: d.toUser.name,
          role: d.delegatedRole,
          startsAt: formatDate(d.startsAt),
          endsAt: formatDate(d.endsAt),
          reason: d.reason,
        }));
        setDelegations(mapped);
      } catch {
        // keep empty list on error
      } finally {
        setLoading(false);
      }
    }

    fetchDelegations();
  }, []);

  const filtered = activeTab === 'all'
    ? delegations
    : delegations.filter((d) => d.status === activeTab);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Delegatsiyalar</h1>
        <Link
          href="/delegations/new"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Yangi
        </Link>
      </div>

      <div className="flex gap-2 border-b pb-2">
        {(['all', 'active', 'pending', 'completed', 'rejected'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 rounded-lg text-sm ${
              activeTab === tab ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab === 'all' ? 'Barchasi' : STATUS_CONFIG[tab]?.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Yuklanmoqda...</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => {
            const s = STATUS_CONFIG[d.status];
            return (
              <div key={d.id} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.color}`}>
                        {s.icon} {s.label}
                      </span>
                      <span className="text-sm text-gray-500">{d.role} vakolati</span>
                    </div>
                    <p className="font-semibold mt-1">{d.from} → {d.to}</p>
                    <p className="text-sm text-gray-500">{d.startsAt} – {d.endsAt}</p>
                    <p className="text-sm text-gray-600 mt-1">&quot;{d.reason}&quot;</p>
                  </div>
                  <Link
                    href={`/delegations/${d.id}`}
                    className="text-indigo-600 text-sm font-medium"
                  >
                    Ko&apos;rish →
                  </Link>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-8">Delegatsiya topilmadi</p>
          )}
        </div>
      )}
    </div>
  );
}
