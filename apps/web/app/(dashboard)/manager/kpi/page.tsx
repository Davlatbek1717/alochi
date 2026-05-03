'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Star, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { formatDateShort } from '@/lib/date-uz';

type BranchUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  login: string;
};

type RecentAward = {
  id: string;
  score: number;
  reason: string;
  date: string;
  recipientName?: string;
};

const PRESETS = [5, 10, 15, 20, 25, 30, 50];

function formatRelativeTime(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffMs = Date.now() - ts;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'hozir';
  if (minutes < 60) return `${minutes} daq oldin`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} kun oldin`;
  return formatDateShort(iso);
}

export default function ManagerKpiPage() {
  const router = useRouter();
  const [staffUsers, setStaffUsers] = useState<BranchUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [score, setScore] = useState(10);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  const [todayTotal, setTodayTotal] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const [recentAwards, setRecentAwards] = useState<RecentAward[]>([]);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    let branchId = '';
    try {
      const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
      branchId = user.branchId ?? '';
    } catch {
      // malformed JSON — branchId stays empty
    }

    const token = localStorage.getItem('accessToken') ?? '';

    async function load() {
      const [usersRes, todayRes, recentRes] = await Promise.allSettled([
        apiRequest<BranchUser[]>(`/users/by-branch/${branchId}`, {}, token),
        apiRequest<number>('/kpi/today', {}, token),
        apiRequest<RecentAward[]>('/kpi/my?limit=10', {}, token),
      ]);

      if (usersRes.status === 'fulfilled') {
        setStaffUsers(usersRes.value.data.filter((u) => u.role !== 'student'));
      } else {
        setUsersError('Xodimlar yuklanmadi');
      }
      setLoadingUsers(false);

      if (todayRes.status === 'fulfilled') {
        setTodayTotal(todayRes.value.data ?? 0);
      } else {
        setStatsError(true);
      }
      setLoadingStats(false);

      if (recentRes.status === 'fulfilled') {
        setRecentAwards(recentRes.value.data ?? []);
      }
    }

    load();
  }, []);

  async function handleAward() {
    setSubmitting(true);
    setAwardError(null);
    const token = localStorage.getItem('accessToken') ?? '';
    try {
      await apiRequest(
        '/kpi/award',
        {
          method: 'POST',
          body: JSON.stringify({ userId: selectedUserId, score, reason }),
        },
        token,
      );
      setSuccess(true);
      setSelectedUserId('');
      setReason('');
      setTodayTotal((prev) => prev + score);
      successTimerRef.current = setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setAwardError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #f59e0b 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.push('/manager')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Manager
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f59e0b]/20 flex items-center justify-center">
              <Star size={18} className="text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">KPI Mukofot</p>
              <p className="text-[#94a3b8] text-xs">
                {loadingStats ? '...' : statsError ? '—' : `Bugun: ${todayTotal} ball`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6 space-y-4 max-w-lg mx-auto">
        {/* Today stat */}
        <div className="bg-[#162032] rounded-[18px] p-5">
          <p className="text-[#94a3b8] text-xs font-semibold uppercase tracking-widest mb-1">Bugun berilgan jami</p>
          {loadingStats ? (
            <div className="h-9 w-24 bg-white/10 rounded animate-pulse" />
          ) : statsError ? (
            <p className="text-4xl font-black text-white/30 font-mono">—</p>
          ) : (
            <p className="text-4xl font-black text-[#f59e0b] font-mono">{todayTotal} <span className="text-lg">ball</span></p>
          )}
        </div>

        {/* Recent awards strip */}
        {recentAwards.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[#0f172a] mb-2">Oxirgi mukofotlar</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {recentAwards.map((a) => (
                <div
                  key={a.id}
                  className="flex-shrink-0 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 min-w-[160px]"
                >
                  <div className="text-amber-700 font-semibold">+{a.score}</div>
                  <div className="text-xs text-slate-600 truncate">{a.recipientName ?? 'Xodim'}</div>
                  <div className="text-xs text-slate-500 truncate">{a.reason}</div>
                  <div className="text-xs text-slate-400">{formatRelativeTime(a.date)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User selector */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Xodimni tanlang</p>
          {loadingUsers ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 bg-[#f7f4ef] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : usersError ? (
            <p className="text-sm text-[#e11d48]">{usersError}</p>
          ) : (
            <div className="border border-[#ede9e1] rounded-xl overflow-y-auto divide-y divide-[#ede9e1] max-h-52">
              {staffUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selectedUserId === u.id
                      ? 'bg-[#f59e0b]/10 border-l-4 border-[#f59e0b]'
                      : 'hover:bg-[#f7f4ef] border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#0f172a] truncate">{u.name}</p>
                    <p className="text-xs text-[#64748b] capitalize">{u.role}</p>
                  </div>
                  {selectedUserId === u.id && (
                    <CheckCircle size={16} className="text-[#f59e0b] shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Score selector */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Ball</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setScore(p)}
                className={`px-3 py-1.5 rounded-xl text-sm font-bold border-[1.5px] transition-colors ${
                  score === p
                    ? 'bg-[#0f172a] text-white border-[#0f172a]'
                    : 'border-[#ede9e1] text-[#64748b] hover:border-[#0f172a]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={50}
              aria-label="Ball miqdori"
              value={score}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (Number.isFinite(val) && val > 0) {
                  setScore(Math.min(50, Math.max(1, val)));
                }
              }}
              className="w-20 border border-[#ede9e1] rounded-xl px-3 py-1.5 text-sm text-center focus:ring-2 focus:ring-[#f59e0b] focus:outline-none bg-[#f7f4ef]"
            />
            <span className="text-sm text-[#94a3b8]">/ 50 maksimal</span>
          </div>
        </div>

        {/* Reason */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Sabab</p>
          <textarea
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nima uchun mukofot berilmoqda?"
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-[#f59e0b] focus:outline-none text-[#0f172a]"
          />
          <p className="text-xs text-[#94a3b8] text-right">{reason.length}/200</p>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleAward}
          disabled={!selectedUserId || !reason.trim() || submitting}
          className="w-full bg-[#0f172a] text-white py-4 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1e293b] transition-colors"
        >
          {submitting ? 'Yuborilmoqda...' : `${score} ball berish`}
        </button>

        {success && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm">
            <CheckCircle size={16} />
            <span>Ball muvaffaqiyatli berildi!</span>
          </div>
        )}
        {awardError && (
          <div className="flex items-center gap-2 bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-xl text-sm">
            <AlertCircle size={16} />
            <span>{awardError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
