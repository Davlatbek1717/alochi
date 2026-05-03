'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Users,
  GraduationCap,
  Ban,
  ShieldAlert,
  Settings,
  UserCheck,
  Save,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Modal, Skeleton, useToast } from '@/components/ui';

type Stats = {
  branchId: string;
  students: {
    total: number;
    active: number;
    blockedWarning: number;
    blockedPayment: number;
  };
  staff: { mentors: number; managers: number };
};

interface Branch {
  id: string;
  name: string;
  filadminId: string | null;
  workStartTime: string | null;
  lateGraceMinutes: number | null;
  chatLocked: boolean;
}

interface User {
  id: string;
  name: string;
  login: string;
  role: string;
  status: string;
  phone?: string | null;
}

export default function BranchStatsPage() {
  const params = useParams<{ id: string }>();
  const branchId = params?.id;
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Assign filadmin
  const [assignOpen, setAssignOpen] = useState(false);
  const [filadminId, setFiladminId] = useState('');
  const [assignSaving, setAssignSaving] = useState(false);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [workStart, setWorkStart] = useState('');
  const [graceMin, setGraceMin] = useState(0);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const token = () => localStorage.getItem('accessToken') ?? '';

  const me = useMemo(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        tenantId?: string;
      };
      return { tenantId: u.tenantId ?? '' };
    } catch {
      return { tenantId: '' };
    }
  }, []);

  function load() {
    if (!branchId) return;
    setLoading(true);
    Promise.all([
      apiRequest<Stats>(`/branches/${branchId}/stats`, {}, token()).catch(
        () => null,
      ),
      apiRequest<Branch[]>('/branches', {}, token()).catch(() => null),
      apiRequest<User[]>(
        `/users/by-branch/${branchId}`,
        {},
        token(),
      ).catch(() => null),
    ])
      .then(([s, brs, us]) => {
        setStats(s ? s.data : null);
        const found = brs?.data.find((b) => b.id === branchId) ?? null;
        setBranch(found);
        setUsers(us ? us.data : []);
        if (found) {
          setWorkStart(found.workStartTime ?? '');
          setGraceMin(found.lateGraceMinutes ?? 0);
          setFiladminId(found.filadminId ?? '');
        }
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const filadminCandidates = users.filter((u) => u.role === 'filadmin');

  async function saveAssign() {
    if (!branchId || !filadminId) return;
    setAssignSaving(true);
    try {
      await apiRequest(
        `/branches/${branchId}/filadmin`,
        {
          method: 'PATCH',
          body: JSON.stringify({ filadminId, tenantId: me.tenantId }),
        },
        token(),
      );
      toast.success('Filadmin tayinlandi');
      setAssignOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setAssignSaving(false);
    }
  }

  async function saveSettings() {
    if (!branchId) return;
    setSettingsSaving(true);
    try {
      await apiRequest(
        `/branches/${branchId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            workStartTime: workStart || null,
            lateGraceMinutes: Number.isFinite(graceMin) ? graceMin : 0,
          }),
        },
        token(),
      );
      toast.success('Sozlamalar saqlandi');
      setSettingsOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-[#0f172a]">
          {branch?.name ?? 'Filial'}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setAssignOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50 px-3 py-2 rounded-xl border border-[#ede9e1]"
          >
            <UserCheck size={14} /> Filadmin tayinlash
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50 px-3 py-2 rounded-xl border border-[#ede9e1]"
          >
            <Settings size={14} /> Sozlamalar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-20 rounded-[18px]" theme="light" />
          ))}
        </div>
      ) : !stats ? (
        <p className="text-[#64748b] text-sm">Maʼlumot topilmadi</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Users size={18} />}
              label="Jami o'quvchilar"
              value={stats.students.total}
            />
            <StatCard
              icon={<GraduationCap size={18} />}
              label="Faol o'quvchilar"
              value={stats.students.active}
            />
            <StatCard
              icon={<ShieldAlert size={18} className="text-amber-500" />}
              label="Ogohlantirish bilan blok"
              value={stats.students.blockedWarning}
            />
            <StatCard
              icon={<Ban size={18} className="text-rose-500" />}
              label="To'lov bilan blok"
              value={stats.students.blockedPayment}
            />
            <StatCard
              icon={<Users size={18} />}
              label="Mentorlar"
              value={stats.staff.mentors}
            />
            <StatCard
              icon={<Users size={18} />}
              label="Menejerlar"
              value={stats.staff.managers}
            />
          </div>

          {/* Branch settings summary */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 text-sm">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">
              Sozlamalar
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[#94a3b8] text-xs">Ish boshlanish vaqti</p>
                <p className="font-semibold text-[#0f172a]">
                  {branch?.workStartTime ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[#94a3b8] text-xs">Kechikish chegarasi</p>
                <p className="font-semibold text-[#0f172a]">
                  {branch?.lateGraceMinutes ?? 0} daqiqa
                </p>
              </div>
            </div>
          </div>

          {/* Users in branch */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
              Filial xodim va o&apos;quvchilari ({users.length})
            </p>
            {users.length === 0 ? (
              <p className="text-[#94a3b8] text-sm">Hech kim biriktirilmagan</p>
            ) : (
              <ul className="space-y-1.5 max-h-80 overflow-y-auto">
                {users.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center gap-3 text-sm py-1.5 border-b border-slate-100 last:border-b-0"
                  >
                    <span className="font-medium text-[#0f172a] flex-1 truncate">
                      {u.name}
                    </span>
                    <span className="text-xs text-[#94a3b8]">{u.login}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f7f4ef] text-[#64748b] border border-[#ede9e1] font-semibold">
                      {u.role}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {/* Assign filadmin modal */}
      <Modal
        open={assignOpen}
        onClose={() => !assignSaving && setAssignOpen(false)}
        title="Filadmin tayinlash"
        theme="light"
      >
        <p className="text-sm text-[#64748b] mb-3">
          Bu filialda mavjud filadmin xodimlardan birini tanlang. Yo‘q
          bo‘lsa, oldin foydalanuvchilar sahifasida filadmin yarating.
        </p>
        <select
          value={filadminId}
          onChange={(e) => setFiladminId(e.target.value)}
          className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
        >
          <option value="">— tanlanmagan —</option>
          {filadminCandidates.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.login})
            </option>
          ))}
        </select>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setAssignOpen(false)}
            disabled={assignSaving}
            className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={saveAssign}
            disabled={assignSaving || !filadminId}
            className="text-sm px-4 py-2 rounded-xl bg-[#0f172a] text-white font-semibold disabled:opacity-50"
          >
            {assignSaving ? 'Saqlanmoqda...' : 'Tayinlash'}
          </button>
        </div>
      </Modal>

      {/* Settings modal */}
      <Modal
        open={settingsOpen}
        onClose={() => !settingsSaving && setSettingsOpen(false)}
        title="Filial sozlamalari"
        theme="light"
      >
        <div className="space-y-3">
          <div>
            <label
              htmlFor="ws-time"
              className="block text-xs text-[#94a3b8] mb-1"
            >
              Ish boshlanish vaqti (HH:MM)
            </label>
            <input
              id="ws-time"
              type="time"
              value={workStart}
              onChange={(e) => setWorkStart(e.target.value)}
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label
              htmlFor="grace-min"
              className="block text-xs text-[#94a3b8] mb-1"
            >
              Kechikish chegarasi (daqiqa)
            </label>
            <input
              id="grace-min"
              type="number"
              min={0}
              value={graceMin}
              onChange={(e) => setGraceMin(Number(e.target.value))}
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={() => setSettingsOpen(false)}
              disabled={settingsSaving}
              className="text-sm px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              onClick={saveSettings}
              disabled={settingsSaving}
              className="text-sm px-4 py-2 rounded-xl bg-[#0f172a] text-white font-semibold disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Save size={14} />
              {settingsSaving ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
      <div className="flex items-center gap-2 mb-2 text-[#64748b] text-xs uppercase tracking-wider font-semibold">
        {icon} {label}
      </div>
      <p className="text-2xl font-bold text-[#0f172a]">{value}</p>
    </div>
  );
}
