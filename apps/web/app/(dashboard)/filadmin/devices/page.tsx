'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

type Device = {
  id: string;
  deviceName: string;
  deviceToken: string;
  lastCacheSync: string | null;
  isActive: boolean;
  createdAt: string;
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

function formatDate(iso: string | null): string {
  if (!iso) return 'Hech qachon';
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function FiladminDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [newToken, setNewToken] = useState('');
  const [deactivating, setDeactivating] = useState<string | null>(null);

  const branchId = getBranchIdFromToken();

  const loadDevices = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const res = await apiRequest<Device[]>(`/devices/${branchId}`, {}, token);
      setDevices(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  async function addDevice() {
    if (!newName.trim() || !branchId) return;
    setAdding(true);
    setAddError('');
    setNewToken('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const res = await apiRequest<Device>(
        '/devices/register',
        { method: 'POST', body: JSON.stringify({ branchId, deviceName: newName.trim() }) },
        token,
      );
      setNewToken(res.data.deviceToken);
      setNewName('');
      await loadDevices();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Qo'shib bo'lmadi");
    } finally {
      setAdding(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm("Planshetni o'chirishni tasdiqlaysizmi?")) return;
    setDeactivating(id);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(`/devices/${id}`, { method: 'DELETE' }, token);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // silent — user can retry
    } finally {
      setDeactivating(null);
    }
  }

  if (!branchId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Planshetlar</h1>
        <div className="bg-white rounded-xl p-6 text-center shadow-sm">
          <p className="text-red-500">Filial topilmadi.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Planshetlar Boshqaruvi</h1>

      <div className="bg-white rounded-xl p-5 shadow-sm space-y-3">
        <h2 className="font-semibold text-gray-800">Yangi planshet qo&apos;shish</h2>
        <div className="flex gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDevice()}
            placeholder="Qurilma nomi (masalan: Asosiy kirish)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={addDevice}
            disabled={adding || !newName.trim()}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {adding ? '...' : "Qo'shish"}
          </button>
        </div>
        {addError && <p className="text-red-500 text-sm">{addError}</p>}
        {newToken && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-amber-800">
              ⚠️ Token faqat bir marta ko&apos;rsatiladi. Planshetga saqlang!
            </p>
            <code className="block text-xs bg-white border border-amber-200 rounded px-3 py-2 font-mono break-all select-all">
              {newToken}
            </code>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
            </div>
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center text-gray-500 shadow-sm">
          <p className="text-4xl mb-2">📱</p>
          <p className="font-medium">Planshetlar ro&apos;yxatda yo&apos;q</p>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((d) => (
            <div key={d.id} className="bg-white rounded-xl p-5 shadow-sm flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-semibold text-gray-900">{d.deviceName}</p>
                <p className="text-xs text-gray-500">Oxirgi kesh: {formatDate(d.lastCacheSync)}</p>
                <p className="text-xs text-gray-400">Qo&apos;shilgan: {formatDate(d.createdAt)}</p>
              </div>
              <button
                onClick={() => deactivate(d.id)}
                disabled={deactivating === d.id}
                className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50"
              >
                {deactivating === d.id ? '...' : "O'chirish"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
