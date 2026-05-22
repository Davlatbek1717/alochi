'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Tablet,
  MapPin,
  Battery,
  Lock,
  Unlock,
  Crosshair,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  AlertTriangle,
  Power,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Volume2,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast, Modal } from '@/components/ui';

type Branch = { id: string; name: string };
type Enrollment = { studentId: string; enrolledAt: string };
type DeviceEvent = {
  id: string;
  type: string;
  severity: string;
  occurredAt: string;
};
type HealthPing = {
  id: string;
  batteryLevel: number | null;
  networkType: string | null;
  foregroundApp: string | null;
  latitude: number | null;
  longitude: number | null;
  pingedAt: string;
};
type Device = {
  id: string;
  serialNumber: string;
  model: string | null;
  manufacturer: string | null;
  branchId: string;
  status: string;
  lastSeenAt: string | null;
  batteryLevel: number | null;
  blocked: boolean;
  blockReason: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastLocationAt: string | null;
  enrollments: Enrollment[];
};

const ONLINE_MS = 3 * 60 * 1000; // seen within 3 min = online

function isOnline(d: Device): boolean {
  if (!d.lastSeenAt) return false;
  return Date.now() - new Date(d.lastSeenAt).getTime() < ONLINE_MS;
}

function ago(iso: string | null): string {
  if (!iso) return 'hech qachon';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hozir';
  if (s < 3600) return `${Math.floor(s / 60)} daqiqa oldin`;
  if (s < 86400) return `${Math.floor(s / 3600)} soat oldin`;
  return `${Math.floor(s / 86400)} kun oldin`;
}

const token = () =>
  typeof window === 'undefined' ? '' : localStorage.getItem('accessToken') ?? '';

export default function SuperadminDevicesPage() {
  const toast = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockTarget, setBlockTarget] = useState<Device | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // Add-device (mint enrollment token) state
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [addBranch, setAddBranch] = useState('');
  const [addSerial, setAddSerial] = useState('');
  const [adding, setAdding] = useState(false);
  const [createdToken, setCreatedToken] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<Device[]>('/mdm/devices', {}, token());
      setDevices(res.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yuklab boʻlmadi');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // refresh every 30s
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    apiRequest<Branch[]>('/branches', {}, token())
      .then((r) => setBranches(r.data ?? []))
      .catch(() => undefined);
  }, []);

  async function createDevice() {
    if (!addBranch || !addSerial.trim()) {
      toast.error('Filial va seriya raqamini kiriting');
      return;
    }
    setAdding(true);
    try {
      const res = await apiRequest<{ enrollmentToken: string }>(
        '/mdm/devices',
        { method: 'POST', body: JSON.stringify({ branchId: addBranch, serialNumber: addSerial.trim() }) },
        token(),
      );
      setCreatedToken(res.data.enrollmentToken);
      setAddSerial('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yaratib boʻlmadi');
    } finally {
      setAdding(false);
    }
  }

  async function doBlock() {
    if (!blockTarget) return;
    const id = blockTarget.id;
    setBusy(id);
    try {
      await apiRequest(
        `/mdm/devices/${id}/block`,
        { method: 'POST', body: JSON.stringify({ reason: blockReason.trim() || undefined }) },
        token(),
      );
      toast.success('Qurilma bloklandi');
      setBlockTarget(null);
      setBlockReason('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(null);
    }
  }

  async function unblock(d: Device) {
    setBusy(d.id);
    try {
      await apiRequest(`/mdm/devices/${d.id}/unblock`, { method: 'POST' }, token());
      toast.success('Blok ochildi');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(null);
    }
  }

  async function locate(d: Device) {
    setBusy(d.id);
    try {
      await apiRequest(`/mdm/devices/${d.id}/locate`, { method: 'POST' }, token());
      toast.success('Joylashuv soʻraldi — keyingi aloqada yangilanadi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(null);
    }
  }

  async function reboot(d: Device) {
    setBusy(d.id);
    try {
      await apiRequest(`/mdm/devices/${d.id}/reboot`, { method: 'POST' }, token());
      toast.success('Qayta yoqish buyrugʻi yuborildi (device-owner)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(null);
    }
  }

  // Per-device detail (events + health) — lazy loaded on expand.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<
    Record<string, { events: DeviceEvent[]; health: HealthPing[] }>
  >({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});

  async function toggleDetail(id: string) {
    const open = !(expanded[id] ?? false);
    setExpanded((p) => ({ ...p, [id]: open }));
    if (open && !details[id]) {
      setDetailLoading((p) => ({ ...p, [id]: true }));
      try {
        const [ev, he] = await Promise.all([
          apiRequest<DeviceEvent[]>(`/mdm/devices/${id}/events?limit=20`, {}, token()),
          apiRequest<HealthPing[]>(`/mdm/devices/${id}/health`, {}, token()),
        ]);
        setDetails((p) => ({
          ...p,
          [id]: { events: ev.data ?? [], health: he.data ?? [] },
        }));
      } catch {
        setDetails((p) => ({ ...p, [id]: { events: [], health: [] } }));
      } finally {
        setDetailLoading((p) => ({ ...p, [id]: false }));
      }
    }
  }

  async function ring(d: Device) {
    setBusy(d.id);
    try {
      await apiRequest(`/mdm/devices/${d.id}/ring`, { method: 'POST' }, token());
      toast.success('Tovush buyrugʻi yuborildi');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(null);
    }
  }

  const [msgTarget, setMsgTarget] = useState<Device | null>(null);
  const [msgText, setMsgText] = useState('');
  async function doMessage() {
    if (!msgTarget || !msgText.trim()) return;
    const id = msgTarget.id;
    setMsgTarget(null);
    setBusy(id);
    try {
      await apiRequest(
        `/mdm/devices/${id}/message`,
        { method: 'POST', body: JSON.stringify({ text: msgText.trim() }) },
        token(),
      );
      toast.success('Xabar yuborildi');
      setMsgText('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(null);
    }
  }

  const [wipeTarget, setWipeTarget] = useState<Device | null>(null);
  async function doWipe() {
    if (!wipeTarget) return;
    const id = wipeTarget.id;
    setWipeTarget(null);
    setBusy(id);
    try {
      await apiRequest(`/mdm/devices/${id}/wipe`, { method: 'POST' }, token());
      toast.success('Tozalash buyrugʻi yuborildi (device-owner)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setBusy(null);
    }
  }

  const stats = useMemo(() => {
    const online = devices.filter(isOnline).length;
    const blocked = devices.filter((d) => d.blocked).length;
    return { total: devices.length, online, blocked };
  }, [devices]);

  const located = devices.filter(
    (d) => typeof d.lastLatitude === 'number' && typeof d.lastLongitude === 'number',
  );

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Tablet size={20} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-[10px] font-bold uppercase tracking-widest">Superadmin</p>
              <p className="text-white text-lg font-extrabold leading-tight">Qurilmalar</p>
              <p className="text-[#475569] text-[11px] font-bold mt-0.5">
                {stats.total} ta · {stats.online} online · {stats.blocked} bloklangan
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowAdd(true); setCreatedToken(''); setAddSerial(''); }}
              className="inline-flex items-center gap-1.5 bg-[#7c3aed] text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-violet-700 transition-colors"
            >
              <Plus size={15} /> Yangi qurilma
            </button>
            <button
              onClick={() => load()}
              aria-label="Yangilash"
              className="w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4 max-w-3xl mx-auto">
        {/* Map */}
        <DeviceMap devices={located} />

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] h-24 animate-pulse" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-10 text-center">
            <Tablet size={32} className="text-[#94a3b8] mx-auto mb-3" />
            <p className="text-[#64748b] font-semibold">Qurilmalar yoʻq</p>
            <p className="text-[#94a3b8] text-xs mt-1">
              Filialda planshet roʻyxatdan oʻtkazilgach shu yerda koʻrinadi.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {devices.map((d) => {
              const online = isOnline(d);
              return (
                <div
                  key={d.id}
                  className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        d.blocked
                          ? 'bg-rose-50 border border-rose-200 text-rose-600'
                          : 'bg-violet-50 border border-violet-100 text-violet-600'
                      }`}
                    >
                      <Tablet size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-extrabold text-[#0f172a] text-sm truncate">
                          {d.model || d.serialNumber}
                        </p>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                            online
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-[#f7f4ef] text-[#94a3b8] border-[#ede9e1]'
                          }`}
                        >
                          {online ? <Wifi size={10} /> : <WifiOff size={10} />}
                          {online ? 'online' : 'offline'}
                        </span>
                        {d.blocked && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 inline-flex items-center gap-1">
                            <Lock size={10} /> bloklangan
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-[#64748b] font-bold flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Battery size={12} />
                          {d.batteryLevel != null ? `${d.batteryLevel}%` : '—'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} />
                          {d.lastLatitude != null
                            ? `${d.lastLatitude.toFixed(4)}, ${d.lastLongitude!.toFixed(4)}`
                            : 'joylashuv yoʻq'}
                        </span>
                        <span>{ago(d.lastSeenAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {d.blocked ? (
                      <button
                        onClick={() => unblock(d)}
                        disabled={busy === d.id}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                      >
                        <Unlock size={13} /> Blokni ochish
                      </button>
                    ) : (
                      <button
                        onClick={() => { setBlockTarget(d); setBlockReason(''); }}
                        disabled={busy === d.id}
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl hover:bg-rose-100 disabled:opacity-50 transition-colors"
                      >
                        <Lock size={13} /> Bloklash
                      </button>
                    )}
                    <button
                      onClick={() => locate(d)}
                      disabled={busy === d.id}
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0f172a] bg-[#f7f4ef] border border-[#ede9e1] px-3 py-1.5 rounded-xl hover:bg-[#ede9e1] disabled:opacity-50 transition-colors"
                    >
                      <Crosshair size={13} /> Joylashuv
                    </button>
                    <button
                      onClick={() => { setMsgTarget(d); setMsgText(''); }}
                      disabled={busy === d.id}
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0f172a] bg-[#f7f4ef] border border-[#ede9e1] px-3 py-1.5 rounded-xl hover:bg-[#ede9e1] disabled:opacity-50 transition-colors"
                    >
                      <MessageSquare size={13} /> Xabar
                    </button>
                    <button
                      onClick={() => ring(d)}
                      disabled={busy === d.id}
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#0f172a] bg-[#f7f4ef] border border-[#ede9e1] px-3 py-1.5 rounded-xl hover:bg-[#ede9e1] disabled:opacity-50 transition-colors"
                    >
                      <Volume2 size={13} /> Tovush
                    </button>
                    {d.lastLatitude != null && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${d.lastLatitude}&mlon=${d.lastLongitude}#map=17/${d.lastLatitude}/${d.lastLongitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-extrabold text-violet-700 bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-xl hover:bg-violet-100 transition-colors"
                      >
                        <MapPin size={13} /> Xaritada
                      </a>
                    )}
                    <button
                      onClick={() => reboot(d)}
                      disabled={busy === d.id}
                      title="Qayta yoqish (device-owner)"
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#64748b] bg-[#f7f4ef] border border-[#ede9e1] px-3 py-1.5 rounded-xl hover:bg-[#ede9e1] disabled:opacity-50 transition-colors"
                    >
                      <Power size={13} /> Reboot
                    </button>
                    <button
                      onClick={() => setWipeTarget(d)}
                      disabled={busy === d.id}
                      title="Maʼlumotlarni tozalash (device-owner)"
                      className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-700 bg-white border border-rose-200 px-3 py-1.5 rounded-xl hover:bg-rose-50 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 size={13} /> Wipe
                    </button>
                    <button
                      onClick={() => toggleDetail(d.id)}
                      className="inline-flex items-center gap-1 text-xs font-extrabold text-[#64748b] bg-[#f7f4ef] border border-[#ede9e1] px-3 py-1.5 rounded-xl hover:bg-[#ede9e1] transition-colors ml-auto"
                    >
                      Tafsilot {expanded[d.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  </div>

                  {/* Expanded detail: tamper events + recent health */}
                  {expanded[d.id] && (
                    <div className="mt-3 pt-3 border-t border-[#ede9e1] space-y-3">
                      {detailLoading[d.id] ? (
                        <p className="text-xs text-[#94a3b8]">Yuklanmoqda...</p>
                      ) : (
                        <>
                          <div>
                            <p className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest mb-1.5">
                              Ogohlantirishlar
                            </p>
                            {(details[d.id]?.events.length ?? 0) === 0 ? (
                              <p className="text-xs text-[#94a3b8]">Ogohlantirish yoʻq</p>
                            ) : (
                              <div className="space-y-1">
                                {details[d.id]!.events.slice(0, 8).map((e) => (
                                  <div key={e.id} className="flex items-center gap-2 text-xs">
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        e.severity === 'critical'
                                          ? 'bg-rose-500'
                                          : e.severity === 'warning'
                                            ? 'bg-amber-500'
                                            : 'bg-[#94a3b8]'
                                      }`}
                                    />
                                    <span className="font-bold text-[#0f172a]">{e.type}</span>
                                    <span className="text-[#94a3b8] ml-auto">{ago(e.occurredAt)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-[10px] font-extrabold text-[#64748b] uppercase tracking-widest mb-1.5">
                              Soʻnggi holat
                            </p>
                            {(details[d.id]?.health.length ?? 0) === 0 ? (
                              <p className="text-xs text-[#94a3b8]">Maʼlumot yoʻq</p>
                            ) : (
                              <div className="space-y-1">
                                {details[d.id]!.health.slice(0, 5).map((h) => (
                                  <div key={h.id} className="flex items-center gap-3 text-xs text-[#64748b]">
                                    <span className="inline-flex items-center gap-1">
                                      <Battery size={11} />
                                      {h.batteryLevel != null ? `${h.batteryLevel}%` : '—'}
                                    </span>
                                    <span>{h.networkType ?? '—'}</span>
                                    {h.foregroundApp && (
                                      <span className="truncate max-w-[140px]">{h.foregroundApp}</span>
                                    )}
                                    <span className="ml-auto text-[#94a3b8]">{ago(h.pingedAt)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add device (mint enrollment token) modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Yangi qurilma" theme="light">
        {createdToken ? (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm font-semibold text-amber-700">
                Tokenni nusxalang va planshetdagi A&apos;lojon ilovasiga kiriting
                (5-tap → admin parol → &quot;Qurilmani sozlash&quot;).
              </p>
            </div>
            <code className="block text-xs bg-[#f7f4ef] border border-[#ede9e1] rounded-lg px-3 py-3 font-mono break-all select-all text-[#0f172a]">
              {createdToken}
            </code>
            <div className="flex justify-end">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl bg-[#0f172a] text-white text-sm font-bold hover:bg-[#1e293b]"
              >
                Yopish
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[#94a3b8] mb-1">Filial</label>
              <select
                value={addBranch}
                onChange={(e) => setAddBranch(e.target.value)}
                className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 text-[#0f172a]"
              >
                <option value="">— tanlang —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#94a3b8] mb-1">Seriya raqami</label>
              <input
                value={addSerial}
                onChange={(e) => setAddSerial(e.target.value)}
                placeholder="Masalan: TAB-001"
                className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 text-[#0f172a]"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl border border-[#ede9e1] text-sm font-semibold text-[#64748b] hover:bg-[#f7f4ef]"
              >
                Bekor
              </button>
              <button
                onClick={createDevice}
                disabled={adding}
                className="px-4 py-2 rounded-xl bg-[#7c3aed] text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50"
              >
                {adding ? 'Yaratilmoqda...' : 'Yaratish'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Message modal */}
      <Modal open={msgTarget !== null} onClose={() => setMsgTarget(null)} title="Ekranga xabar" theme="light">
        <p className="text-sm text-[#64748b] mb-3">
          <span className="font-semibold text-[#0f172a]">{msgTarget?.model || msgTarget?.serialNumber}</span>{' '}
          planshetida bildirishnoma sifatida koʻrsatiladi.
        </p>
        <textarea
          value={msgText}
          onChange={(e) => setMsgText(e.target.value)}
          rows={3}
          placeholder="Xabar matni..."
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 text-[#0f172a] resize-none mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setMsgTarget(null)}
            className="px-4 py-2 rounded-xl border border-[#ede9e1] text-sm font-semibold text-[#64748b] hover:bg-[#f7f4ef]"
          >
            Bekor
          </button>
          <button
            onClick={doMessage}
            disabled={!msgText.trim()}
            className="px-4 py-2 rounded-xl bg-[#0f172a] text-white text-sm font-bold hover:bg-[#1e293b] disabled:opacity-50"
          >
            Yuborish
          </button>
        </div>
      </Modal>

      {/* Wipe confirm modal (destructive) */}
      <Modal open={wipeTarget !== null} onClose={() => setWipeTarget(null)} title="Maʼlumotlarni tozalash" theme="light">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 mb-4">
          <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-rose-700">
            <span className="font-bold">{wipeTarget?.model || wipeTarget?.serialNumber}</span> planshetidagi
            barcha maʼlumot oʻchiriladi (factory reset). Bu amalni qaytarib boʻlmaydi va faqat
            device-owner planshetda ishlaydi.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setWipeTarget(null)}
            className="px-4 py-2 rounded-xl border border-[#ede9e1] text-sm font-semibold text-[#64748b] hover:bg-[#f7f4ef]"
          >
            Bekor
          </button>
          <button
            onClick={doWipe}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700"
          >
            Tozalash
          </button>
        </div>
      </Modal>

      {/* Block confirm modal */}
      <Modal open={blockTarget !== null} onClose={() => setBlockTarget(null)} title="Qurilmani bloklash" theme="light">
        <p className="text-sm text-[#64748b] mb-3">
          <span className="font-semibold text-[#0f172a]">{blockTarget?.model || blockTarget?.serialNumber}</span>{' '}
          qurilmasini bloklaysizmi? Planshetda toʻliq qulf ekrani koʻrsatiladi.
        </p>
        <input
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
          placeholder="Sabab (ixtiyoriy) — ekranda koʻrinadi"
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20 text-[#0f172a] mb-4"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setBlockTarget(null)}
            className="px-4 py-2 rounded-xl border border-[#ede9e1] text-sm font-semibold text-[#64748b] hover:bg-[#f7f4ef]"
          >
            Bekor
          </button>
          <button
            onClick={doBlock}
            disabled={busy !== null}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50"
          >
            Bloklash
          </button>
        </div>
      </Modal>
    </div>
  );
}

/* ── Leaflet map (loaded from CDN, no npm dependency) ───────────────────── */

interface MapDevice {
  id: string;
  serialNumber: string;
  model: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  blocked: boolean;
}

interface LMap {
  setView(c: [number, number], z: number): LMap;
  fitBounds(b: [number, number][], o?: { padding: [number, number] }): void;
  invalidateSize(): void;
}
interface LLayerGroup {
  clearLayers(): void;
  addTo(m: LMap): LLayerGroup;
}
interface LMarker {
  bindPopup(s: string): LMarker;
  addTo(l: LLayerGroup): LMarker;
}
interface LTileLayer {
  addTo(m: LMap): LTileLayer;
}
interface LStatic {
  map(el: HTMLElement): LMap;
  tileLayer(url: string, opts: Record<string, unknown>): LTileLayer;
  layerGroup(): LLayerGroup;
  marker(c: [number, number]): LMarker;
}

function DeviceMap({ devices }: { devices: MapDevice[] }) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LMap | null>(null);
  const layerRef = useRef<LLayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  // Load Leaflet from CDN once.
  useEffect(() => {
    const w = window as unknown as { L?: LStatic };
    if (w.L) { setReady(true); return; }
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => setReady(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setReady(true);
    document.body.appendChild(script);
  }, []);

  // Init map + (re)draw markers.
  useEffect(() => {
    if (!ready || !elRef.current) return;
    const L = (window as unknown as { L: LStatic }).L;
    if (!mapRef.current) {
      const map = L.map(elRef.current).setView([41.311081, 69.240562], 11); // Tashkent default
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    }
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const pts: [number, number][] = [];
    for (const d of devices) {
      if (d.lastLatitude == null || d.lastLongitude == null) continue;
      const m = L.marker([d.lastLatitude, d.lastLongitude]);
      m.bindPopup(`${d.model || d.serialNumber}${d.blocked ? ' (bloklangan)' : ''}`);
      m.addTo(layer);
      pts.push([d.lastLatitude, d.lastLongitude]);
    }
    if (pts.length === 1) map.setView(pts[0], 16);
    else if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40] });
    setTimeout(() => map.invalidateSize(), 100);
  }, [ready, devices]);

  return (
    <div
      className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden relative z-0"
      style={{ isolation: 'isolate' }}
    >
      <div
        ref={elRef}
        style={{ height: 280, width: '100%', background: '#e8e5df' }}
        aria-label="Qurilmalar xaritasi"
      />
      {devices.length === 0 && (
        <p className="text-center text-xs text-[#94a3b8] py-2">
          Joylashuvi maʼlum qurilma yoʻq
        </p>
      )}
    </div>
  );
}
