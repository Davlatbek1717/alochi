'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Tablet, Plus, Trash2, AlertTriangle, Wifi } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateTime } from '@/lib/date-uz';
import { Modal, useToast } from '@/components/ui';

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
  return formatDateTime(iso);
}

export default function FiladminDevicesPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [newToken, setNewToken] = useState('');
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const toast = useToast();

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

  async function confirmDeactivate() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    setDeactivating(id);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(`/devices/${id}`, { method: 'DELETE' }, token);
      setDevices((prev) => prev.filter((d) => d.id !== id));
      toast.success("Qurilma o'chirildi");
    } catch {
      toast.error("O'chirishda xato yuz berdi");
    } finally {
      setDeactivating(null);
    }
  }

  if (!branchId) {
    return (
      <div className="min-h-full bg-[#f7f4ef]">
        <div className="bg-[#0f172a] px-5 pt-5 pb-6">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Orqaga
          </button>
          <p className="text-white font-bold text-lg">Planshetlar</p>
        </div>
        <div className="p-4">
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center">
            <p className="text-[#e11d48] text-sm">Filial topilmadi.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.push('/filadmin')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Filadmin
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Tablet size={18} className="text-violet-400" />
            </div>
            <p className="text-white font-bold text-lg">Planshetlar Boshqaruvi</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Add device */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Yangi planshet qo&apos;shish</p>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDevice()}
              placeholder="Qurilma nomi (masalan: Asosiy kirish)"
              aria-label="Yangi qurilma nomi"
              className="flex-1 bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#0f172a] text-[#0f172a]"
            />
            <button
              onClick={addDevice}
              disabled={adding || !newName.trim()}
              className="bg-[#0f172a] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1e293b] disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <Plus size={16} />
              {adding ? '...' : "Qo'shish"}
            </button>
          </div>
          {addError && <p className="text-[#e11d48] text-sm">{addError}</p>}
          {newToken && (
            <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#f59e0b] shrink-0" />
                <p className="text-sm font-semibold text-[#f59e0b]">
                  Token faqat bir marta ko&apos;rsatiladi. Planshetga saqlang!
                </p>
              </div>
              <code className="block text-xs bg-white border border-[#f59e0b]/20 rounded-lg px-3 py-2 font-mono break-all select-all text-[#0f172a]">
                {newToken}
              </code>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-[14px] text-sm">{error}</div>
        )}

        {/* Device list */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Qurilmalar</p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 animate-pulse">
                  <div className="h-4 bg-[#f7f4ef] rounded w-1/3 mb-2" />
                  <div className="h-3 bg-[#f7f4ef] rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : devices.length === 0 ? (
            <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-10 text-center">
              <Tablet size={32} className="text-[#94a3b8] mx-auto mb-3" />
              <p className="text-[#64748b] font-medium">Planshetlar ro&apos;yxatda yo&apos;q</p>
            </div>
          ) : (
            <div className="space-y-3">
              {devices.map((d) => (
                <div key={d.id} className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Wifi size={16} className="text-violet-600" />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-[#0f172a] text-sm truncate">{d.deviceName}</p>
                      <p className="text-xs text-[#64748b]">Oxirgi kesh: {formatDate(d.lastCacheSync)}</p>
                      <p className="text-xs text-[#94a3b8]">Qo&apos;shilgan: {formatDate(d.createdAt)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteTarget(d)}
                    disabled={deactivating === d.id}
                    aria-label={`${d.deviceName} qurilmasini o'chirish`}
                    className="text-[#e11d48] hover:bg-[#e11d48]/10 p-2 rounded-xl disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Qurilmani o'chirish"
        theme="light"
      >
        <p className="text-sm text-[#64748b] mb-5">
          <span className="font-semibold text-[#0f172a]">{deleteTarget?.deviceName}</span> planshetini tizimdan
          o&apos;chirishni tasdiqlaysizmi? Bu amalni qaytarib bo&apos;lmaydi.
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 rounded-xl border border-[#ede9e1] text-sm font-semibold text-[#64748b] hover:bg-[#f7f4ef] transition-colors"
          >
            Bekor qilish
          </button>
          <button
            onClick={confirmDeactivate}
            className="px-4 py-2 rounded-xl bg-[#e11d48] text-white text-sm font-bold hover:bg-rose-700 transition-colors"
          >
            O&apos;chirish
          </button>
        </div>
      </Modal>
    </div>
  );
}
