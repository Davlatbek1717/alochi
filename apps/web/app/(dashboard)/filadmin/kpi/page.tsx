'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

type BranchUser = {
  id: string;
  name: string;
  role: string;
  status: string;
  phone: string;
  login: string;
};

const PRESETS = [5, 10, 15, 20, 25, 30, 50];

export default function FiladminKpiPage() {
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

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    let branchId = '';
    try {
      const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { branchId?: string };
      branchId = user.branchId ?? '';
    } catch {
      // malformed JSON — branchId stays empty, users list will show error
    }

    async function load() {
      const [usersRes, todayRes] = await Promise.allSettled([
        apiRequest<BranchUser[]>(`/users/by-branch/${branchId}`, {}, token),
        apiRequest<number>('/kpi/today', {}, token),
      ]);

      if (usersRes.status === 'fulfilled') {
        setStaffUsers(usersRes.value.data.filter((u) => u.role !== 'student'));
      } else {
        console.error('[KPI] Failed to load branch users:', usersRes.reason);
        setUsersError('Xodimlar yuklanmadi');
      }
      setLoadingUsers(false);

      if (todayRes.status === 'fulfilled') {
        setTodayTotal(todayRes.value.data ?? 0);
      } else {
        setStatsError(true);
      }
      setLoadingStats(false);
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
    <div className="max-w-lg mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/filadmin" className="text-sm text-indigo-600 hover:underline">
          &larr; Filadmin
        </Link>
        <h1 className="text-xl font-bold">KPI Mukofot</h1>
      </div>

      {/* Today's total */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-sm font-medium text-gray-500 mb-1">Bugun berilgan jami</p>
        {loadingStats ? (
          <div className="h-8 w-24 bg-gray-100 rounded animate-pulse" />
        ) : statsError ? (
          <p className="text-3xl font-bold text-gray-400">—</p>
        ) : (
          <p className="text-3xl font-bold text-indigo-600">{todayTotal} ball</p>
        )}
      </div>

      {/* Award form */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {/* User selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Xodimni tanlang</label>
          {loadingUsers ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : usersError ? (
            <p className="text-sm text-red-500">{usersError}</p>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y max-h-52 overflow-y-auto">
              {staffUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    selectedUserId === u.id
                      ? 'bg-indigo-50 border-l-4 border-indigo-500'
                      : 'hover:bg-gray-50 border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{u.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{u.role}</p>
                  </div>
                  {selectedUserId === u.id && (
                    <span className="text-indigo-500 text-lg">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Score selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Ball</label>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setScore(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  score === p
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-300 text-gray-700 hover:border-indigo-400'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min={1}
              max={50}
              value={score}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (Number.isFinite(val) && val > 0) {
                  setScore(Math.min(50, Math.max(1, val)));
                }
              }}
              className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-center focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            />
            <span className="text-sm text-gray-400">/ 50 maksimal</span>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sabab</label>
          <textarea
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Nima uchun mukofot berilmoqda?"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{reason.length}/200</p>
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={handleAward}
          disabled={!selectedUserId || !reason.trim() || submitting}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
        >
          {submitting ? 'Yuborilmoqda...' : `${score} ball berish`}
        </button>

        {/* Feedback banners */}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
            <span>✓</span>
            <span>Ball muvaffaqiyatli berildi!</span>
          </div>
        )}
        {awardError && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm">
            {awardError}
          </div>
        )}
      </div>
    </div>
  );
}
