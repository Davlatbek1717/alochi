'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, User, ChevronDown, ChevronUp, Save, Video, AlertCircle, Star, Flag } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Modal } from '@/components/ui';

interface Lesson {
  id: string;
  title: string;
  orderNumber: number;
  nRepetitions: number;
  maxNOverride: number;
  type: string;
}

interface StudentStatus {
  englishStatus: string;
  personalStatus: string;
  criticalStatus: string;
}

interface UserInfo {
  id: string;
  name: string;
  role: string;
}

type StatusColor = 'green' | 'yellow' | 'red';

function statusColor(value: string): StatusColor {
  if (value === 'yashil') return 'green';
  if (value === 'sariq') return 'yellow';
  if (value === 'qizil') return 'red';
  return 'red';
}

const STATUS_CLASSES: Record<StatusColor, string> = {
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20',
};

const STATUS_LABELS: Record<StatusColor, string> = {
  green: 'Yashil',
  yellow: 'Sariq',
  red: 'Qizil',
};

export default function StudentProfilePage() {
  const { id: studentId } = useParams<{ id: string }>();
  const router = useRouter();

  type StatusRecord = {
    id: string; date: string; englishStatus: string; personalStatus: string; criticalStatus: string;
    personalNote?: string; givenBy?: string;
  };

  const [studentName, setStudentName] = useState('');
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [status, setStatus] = useState<StudentStatus | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [history, setHistory] = useState<StatusRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Quick-action modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusColorPick, setStatusColorPick] = useState<'yashil' | 'sariq' | 'qizil'>('yashil');
  const [statusNote, setStatusNote] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);

  const [kpiModalOpen, setKpiModalOpen] = useState(false);
  const [kpiScore, setKpiScore] = useState(10);
  const [kpiReason, setKpiReason] = useState('');
  const [kpiSaving, setKpiSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function load() {
      try {
        // Fetch user first — if user fetch fails, render full-page error.
        const userRes = await apiRequest<UserInfo>(`/users/${studentId}`, {}, token);
        setStudentName(userRes.data.name);

        const [lessonsRes, statusRes] = await Promise.all([
          apiRequest<Lesson[]>('/lessons', {}, token),
          apiRequest<StudentStatus>(`/status/${studentId}`, {}, token).catch(() => ({ data: null })),
        ]);

        setLessons(lessonsRes.data);
        setStatus(statusRes.data);

        const initial: Record<string, number> = {};
        for (const l of lessonsRes.data) {
          initial[l.id] = l.nRepetitions;
        }
        setOverrides(initial);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Xatolik yuz berdi';
        // If we never got the studentName, this is a fatal student-fetch error.
        if (!studentName) {
          setStudentError(msg);
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadHistory() {
    if (historyLoading || history.length > 0) { setShowHistory(true); return; }
    setHistoryLoading(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      const res = await apiRequest<StatusRecord[]>(`/status/history/${studentId}`, {}, token);
      setHistory(res.data);
    } catch { /* ignore */ }
    finally { setHistoryLoading(false); setShowHistory(true); }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave(lessonId: string) {
    const token = localStorage.getItem('accessToken') ?? '';
    setSaving((prev) => ({ ...prev, [lessonId]: true }));
    try {
      await apiRequest(
        `/student-config/${studentId}/${lessonId}/n-override`,
        {
          method: 'POST',
          body: JSON.stringify({ nRepetitions: overrides[lessonId] }),
        },
        token,
      );
      showToast('Saqlandi!');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving((prev) => ({ ...prev, [lessonId]: false }));
    }
  }

  function handleStart11() {
    const encoded = encodeURIComponent(`1:1 sessiya: ${studentName}`);
    router.push(`/delegations/new?reason=${encoded}`);
  }

  async function submitStatus() {
    if (!studentId) return;
    setStatusSaving(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        '/status/critical',
        {
          method: 'POST',
          body: JSON.stringify({
            studentId,
            color: statusColorPick,
            note: statusNote || undefined,
          }),
        },
        token,
      );
      // Reload current status
      try {
        const fresh = await apiRequest<StudentStatus>(`/status/${studentId}`, {}, token);
        setStatus(fresh.data);
      } catch { /* ignore */ }
      // Invalidate history cache
      setHistory([]);
      setShowHistory(false);
      setStatusModalOpen(false);
      setStatusNote('');
      showToast('Status saqlandi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setStatusSaving(false);
    }
  }

  async function submitKpi() {
    if (!studentId || !kpiReason.trim()) {
      showToast("Sababni kiriting");
      return;
    }
    setKpiSaving(true);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        '/kpi/award',
        {
          method: 'POST',
          body: JSON.stringify({
            userId: studentId,
            score: kpiScore,
            reason: kpiReason.trim(),
          }),
        },
        token,
      );
      setKpiModalOpen(false);
      setKpiReason('');
      showToast('KPI berildi');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setKpiSaving(false);
    }
  }

  if (studentError) {
    return (
      <div className="min-h-screen bg-[#f7f4ef] flex items-center justify-center p-6">
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6 text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 flex items-center justify-center">
            <AlertCircle size={24} className="text-rose-600" />
          </div>
          <h1 className="text-rose-600 font-bold text-lg">Xato yuz berdi</h1>
          <p className="text-sm text-[#64748b]">{studentError}</p>
          <button
            onClick={() => location.reload()}
            className="bg-[#0f172a] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-[#1e293b] transition-colors"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#0f172a] text-white px-4 py-2 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.push('/manager')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Manager
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#7c3aed]/20 border border-[#7c3aed]/30 flex items-center justify-center">
                <User size={18} className="text-violet-400" />
              </div>
              <div>
                {loading ? (
                  <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
                ) : (
                  <p className="text-white font-bold text-lg">{studentName || "Nomaʼlum"}</p>
                )}
                <p className="text-[#64748b] text-xs">O&apos;quvchi profili</p>
              </div>
            </div>
            <button
              onClick={handleStart11}
              disabled={!studentName}
              className="bg-[#7c3aed] text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              <Video size={14} /> 1:1
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-4">
        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => { setStatusModalOpen(true); setStatusColorPick('yashil'); setStatusNote(''); }}
            disabled={!studentName}
            className="bg-white rounded-xl border-[1.5px] border-[#ede9e1] p-3 flex flex-col items-center justify-center gap-1 hover:bg-[#f7f4ef] disabled:opacity-50 transition-colors"
          >
            <Flag size={18} className="text-rose-500" />
            <span className="text-xs font-bold text-[#0f172a]">Status berish</span>
          </button>
          <button
            onClick={handleStart11}
            disabled={!studentName}
            className="bg-white rounded-xl border-[1.5px] border-[#ede9e1] p-3 flex flex-col items-center justify-center gap-1 hover:bg-[#f7f4ef] disabled:opacity-50 transition-colors"
          >
            <Video size={18} className="text-violet-600" />
            <span className="text-xs font-bold text-[#0f172a]">Delegatsiya</span>
          </button>
          <button
            onClick={() => { setKpiModalOpen(true); setKpiScore(10); setKpiReason(''); }}
            disabled={!studentName}
            className="bg-white rounded-xl border-[1.5px] border-[#ede9e1] p-3 flex flex-col items-center justify-center gap-1 hover:bg-[#f7f4ef] disabled:opacity-50 transition-colors"
          >
            <Star size={18} className="text-amber-500" />
            <span className="text-xs font-bold text-[#0f172a]">KPI qo&apos;shish</span>
          </button>
        </div>

        {/* Status card */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Holat</p>
          {loading ? (
            <p className="text-sm text-[#94a3b8]">Yuklanmoqda...</p>
          ) : error ? (
            <p className="text-sm text-[#e11d48]">{error}</p>
          ) : status ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { label: 'Ingliz tili', value: status.englishStatus },
                  { label: 'Shaxsiy', value: status.personalStatus },
                  { label: 'Tanqidiy', value: status.criticalStatus },
                ] as { label: string; value: string }[]
              ).map(({ label, value }) => {
                const color = statusColor(value);
                return (
                  <span
                    key={label}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_CLASSES[color]}`}
                  >
                    {label}: {STATUS_LABELS[color]}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#94a3b8]">Status belgilanmagan</p>
          )}
        </div>

        {/* Lesson overrides */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#ede9e1]">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Dars takrorlash soni (N override)</p>
          </div>
          {loading ? (
            <div className="p-5 text-sm text-[#94a3b8]">Yuklanmoqda...</div>
          ) : error ? (
            <div className="p-5 text-sm text-[#e11d48]">{error}</div>
          ) : (
            <div className="divide-y divide-[#ede9e1]">
              {lessons
                .slice()
                .sort((a, b) => a.orderNumber - b.orderNumber)
                .map((lesson) => (
                  <div
                    key={lesson.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#f7f4ef] flex items-center justify-center shrink-0 mt-0.5">
                        <Video size={14} className="text-[#64748b]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#0f172a] text-sm truncate">{lesson.title}</p>
                        <p className="text-xs text-[#94a3b8]">
                          Standart: {lesson.nRepetitions}x · Maks: {lesson.maxNOverride} · {lesson.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={lesson.maxNOverride}
                        aria-label={`${lesson.title} — takrorlash soni`}
                        value={overrides[lesson.id] ?? lesson.nRepetitions}
                        onChange={(e) =>
                          setOverrides((prev) => ({
                            ...prev,
                            [lesson.id]: Math.min(lesson.maxNOverride, Math.max(1, Number(e.target.value))),
                          }))
                        }
                        className="w-16 border border-[#ede9e1] rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#7c3aed] bg-[#f7f4ef]"
                      />
                      <button
                        onClick={() => handleSave(lesson.id)}
                        disabled={saving[lesson.id]}
                        className="bg-[#0f172a] text-white px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-[#1e293b] disabled:opacity-50 transition-colors flex items-center gap-1"
                      >
                        <Save size={12} />
                        {saving[lesson.id] ? '...' : 'Saqlash'}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* History */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden">
          <button
            onClick={() => showHistory ? setShowHistory(false) : loadHistory()}
            className="w-full px-5 py-4 flex items-center justify-between text-left"
          >
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Status tarixi</p>
            {showHistory ? <ChevronUp size={16} className="text-[#94a3b8]" /> : <ChevronDown size={16} className="text-[#94a3b8]" />}
          </button>

          {showHistory && (
            historyLoading ? (
              <p className="p-5 text-sm text-[#94a3b8]">Yuklanmoqda...</p>
            ) : history.length === 0 ? (
              <p className="p-5 text-sm text-[#94a3b8]">Tarix yo&apos;q</p>
            ) : (
              <div className="divide-y divide-[#ede9e1]">
                {history.map((h) => (
                  <div key={h.id} className="px-5 py-3 flex flex-wrap gap-x-4 gap-y-1 items-start">
                    <span className="text-xs text-[#94a3b8] w-24 shrink-0">
                      {new Date(h.date).toLocaleDateString('uz-UZ')}
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: 'ING', val: h.englishStatus },
                        { label: 'SHAXS', val: h.personalStatus },
                        { label: 'TANQ', val: h.criticalStatus },
                      ].map(({ label, val }) => (
                        <span key={label} className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                          val === 'yashil' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          val === 'sariq'  ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          val === 'qizil'  ? 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/20' :
                          'bg-[#f7f4ef] text-[#94a3b8] border-[#ede9e1]'
                        }`}>
                          {label}: {val ?? '—'}
                        </span>
                      ))}
                    </div>
                    {h.personalNote && (
                      <p className="text-xs text-[#64748b] w-full ml-24">{h.personalNote}</p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Status modal */}
      <Modal
        open={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Tanqidiy status berish"
        description="Bu o'quvchi uchun bugungi rangni tanlang"
        footer={
          <>
            <button
              onClick={() => setStatusModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
            >
              Bekor qilish
            </button>
            <button
              onClick={submitStatus}
              disabled={statusSaving}
              className="bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {statusSaving ? '...' : 'Saqlash'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {([
              { v: 'yashil' as const, label: 'Yashil', dot: 'bg-emerald-500' },
              { v: 'sariq' as const, label: 'Sariq', dot: 'bg-amber-500' },
              { v: 'qizil' as const, label: 'Qizil', dot: 'bg-rose-500' },
            ]).map((o) => (
              <button
                key={o.v}
                onClick={() => setStatusColorPick(o.v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-[1.5px] text-sm font-bold transition-colors ${
                  statusColorPick === o.v
                    ? 'border-[#0f172a] bg-slate-50 text-[#0f172a]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                <span className={`w-3 h-3 rounded-full ${o.dot}`} />
                {o.label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Izoh (ixtiyoriy)
            </label>
            <textarea
              rows={3}
              maxLength={500}
              value={statusNote}
              onChange={(e) => setStatusNote(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* KPI modal */}
      <Modal
        open={kpiModalOpen}
        onClose={() => setKpiModalOpen(false)}
        title="KPI mukofot"
        description={`${studentName || "O'quvchi"} uchun KPI ball bering`}
        footer={
          <>
            <button
              onClick={() => setKpiModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
            >
              Bekor qilish
            </button>
            <button
              onClick={submitKpi}
              disabled={kpiSaving || !kpiReason.trim()}
              className="bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {kpiSaving ? '...' : `${kpiScore} ball berish`}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Ball
            </label>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 20, 30].map((p) => (
                <button
                  key={p}
                  onClick={() => setKpiScore(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold border-[1.5px] transition-colors ${
                    kpiScore === p
                      ? 'bg-[#0f172a] text-white border-[#0f172a]'
                      : 'border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
              Sabab
            </label>
            <textarea
              rows={3}
              maxLength={200}
              value={kpiReason}
              onChange={(e) => setKpiReason(e.target.value)}
              placeholder="Nima uchun mukofot?"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 resize-none"
            />
            {!kpiReason.trim() && (
              <p className="text-xs text-slate-400 mt-1">Sababni kiriting</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
