'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';
import { XpBar } from '../student/_components/XpBar';
import { StreakBadge } from '../student/_components/StreakBadge';

type XpData = {
  totalXp: number;
  level: string;
  nextLevelXp: number;
};

type StreakData = {
  streak: number;
  hasShield: boolean;
};

type StatusStudent = {
  studentId: string;
  student: { id: string; name: string };
  englishStatus: string;
  personalStatus: string;
  criticalStatus: string;
};

type HighPerformer = {
  id: string;
  name: string;
  lessonsCompleted: number;
  totalLessons: number;
};

function StudentRow({ s, color }: { s: StatusStudent; color: 'red' | 'yellow' }) {
  return (
    <div className="p-4 flex items-center justify-between">
      <div>
        <p className="font-medium">{s.student.name}</p>
        <p className="text-sm text-gray-500">
          {[s.englishStatus, s.personalStatus, s.criticalStatus]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <Link
        href={`/manager/students/${s.student.id}`}
        className={`px-3 py-1 rounded-lg text-sm text-white ${
          color === 'red' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-yellow-600 hover:bg-yellow-700'
        }`}
      >
        Ko&apos;rish
      </Link>
    </div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 flex items-center justify-between animate-pulse">
          <div className="space-y-2">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-20 bg-gray-100 rounded" />
          </div>
          <div className="h-8 w-16 bg-gray-200 rounded-lg" />
        </div>
      ))}
    </>
  );
}

export default function ManagerDashboard() {
  const [xpData, setXpData] = useState<XpData>({ totalXp: 0, level: 'Novice', nextLevelXp: 5000 });
  const [streak, setStreak] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [redStudents, setRedStudents] = useState<StatusStudent[]>([]);
  const [yellowStudents, setYellowStudents] = useState<StatusStudent[]>([]);
  const [highPerformers, setHighPerformers] = useState<HighPerformer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';

    async function fetchData() {
      try {
        const [xpRes, streakRes, redRes, yellowRes, highRes] = await Promise.all([
          apiRequest<XpData>('/gamification/xp', {}, token),
          apiRequest<StreakData>('/gamification/streak', {}, token),
          apiRequest<StatusStudent[]>('/status/red-students', {}, token).catch(() => ({ data: [] as StatusStudent[] })),
          apiRequest<StatusStudent[]>('/status/yellow-students', {}, token).catch(() => ({ data: [] as StatusStudent[] })),
          apiRequest<HighPerformer[]>('/status/high-performers', {}, token).catch(() => ({ data: [] as HighPerformer[] })),
        ]);
        setXpData(xpRes.data);
        setStreak(streakRes.data.streak);
        setHasShield(streakRes.data.hasShield);
        setRedStudents(redRes.data);
        setYellowStudents(yellowRes.data);
        setHighPerformers(highRes.data ?? []);
      } catch {
        // keep defaults on error
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Manager Paneli</h1>

      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-4 text-white">
        <div className="flex justify-between items-start mb-3">
          <StreakBadge streak={streak} hasShield={hasShield} />
        </div>
        <XpBar totalXp={xpData.totalXp} level={xpData.level} nextLevelXp={xpData.nextLevelXp} />
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-red-50 border-b border-red-100">
          <h2 className="font-semibold text-red-700">
            🔴 Qizil O&apos;quvchilar ({loading ? '…' : redStudents.length})
          </h2>
        </div>
        <div className="divide-y">
          {loading ? (
            <SkeletonRows />
          ) : redStudents.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">Qizil o&apos;quvchilar yo&apos;q</p>
          ) : (
            redStudents.map((s) => <StudentRow key={s.studentId} s={s} color="red" />)
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
          <h2 className="font-semibold text-yellow-700">
            🟡 Sariq O&apos;quvchilar ({loading ? '…' : yellowStudents.length})
          </h2>
        </div>
        <div className="divide-y">
          {loading ? (
            <SkeletonRows />
          ) : yellowStudents.length === 0 ? (
            <p className="p-4 text-sm text-gray-400">Sariq o&apos;quvchilar yo&apos;q</p>
          ) : (
            yellowStudents.map((s) => <StudentRow key={s.studentId} s={s} color="yellow" />)
          )}
        </div>
      </div>

      {highPerformers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-2">
            <span className="text-xl">🏆</span>
            <h2 className="font-bold text-gray-800">200%+ O&apos;quvchilar</h2>
            <span className="ml-auto bg-emerald-100 text-emerald-700 text-xs font-semibold px-2 py-1 rounded-full">
              {highPerformers.length}
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {highPerformers.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-sm text-gray-500">
                    {s.lessonsCompleted}/{s.totalLessons} dars · barcha statuslar 🟢
                  </p>
                </div>
                <Link
                  href={`/manager/students/${s.id}`}
                  className="px-3 py-1 rounded-lg text-sm text-white bg-emerald-600 hover:bg-emerald-700"
                >
                  Ko&apos;rish
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
