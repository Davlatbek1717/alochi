'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Users, CreditCard, ClipboardList, Send, AlertCircle, TrendingUp, Trophy, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, Stat } from '@/components/ui';

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

type ChurnRow = {
  id: string;
  studentId: string;
  score: number;
  signals: Record<string, boolean> | null;
  student: { id: string; name: string };
};

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const SIGNAL_LABELS: Record<string, string> = {
  absent3Days: 'Absent 3 kun',
  redStatus: 'Qizil status',
  passRateDrop: "O'tish % tushdi",
  streakBroken: 'Streak uzildi',
  noParentTg: "Ota-ona Telegram yo'q",
};

function formatSignals(signals: Record<string, boolean> | null | undefined): string {
  if (!signals) return '';
  return Object.entries(signals)
    .filter(([, v]) => v === true)
    .map(([k]) => SIGNAL_LABELS[k] ?? k)
    .join(' + ');
}

export default function ManagerDashboard() {
  const [redStudents, setRedStudents] = useState<StatusStudent[]>([]);
  const [yellowStudents, setYellowStudents] = useState<StatusStudent[]>([]);
  const [highPerformers, setHighPerformers] = useState<HighPerformer[]>([]);
  const [highRisk, setHighRisk] = useState<ChurnRow[]>([]);
  const [mediumRisk, setMediumRisk] = useState<ChurnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [managerName, setManagerName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const user = JSON.parse(localStorage.getItem('user') ?? '{}') as { name?: string };
    setManagerName(user.name ?? '');

    Promise.all([
      apiRequest<StatusStudent[]>('/status/red-students', {}, token).catch(() => ({ data: [] as StatusStudent[] })),
      apiRequest<StatusStudent[]>('/status/yellow-students', {}, token).catch(() => ({ data: [] as StatusStudent[] })),
      apiRequest<HighPerformer[]>('/status/high-performers', {}, token).catch(() => ({ data: [] as HighPerformer[] })),
    ]).then(([redRes, yellowRes, highRes]) => {
      setRedStudents(redRes.data ?? []);
      setYellowStudents(yellowRes.data ?? []);
      setHighPerformers(highRes.data ?? []);
    }).finally(() => setLoading(false));

    apiRequest<ChurnRow[]>('/churn/high-risk', {}, token)
      .then((r) => setHighRisk((r.data ?? []).slice(0, 5)))
      .catch(() => {});

    apiRequest<ChurnRow[]>('/churn/medium-risk', {}, token)
      .then((r) => setMediumRisk((r.data ?? []).slice(0, 5)))
      .catch(() => {});
  }, []);

  const navCards = [
    { href: '/manager/students',    icon: <Users size={20} />,        title: "O'quvchilar", desc: 'Status boshqaruv',  color: 'hover:border-violet-300 hover:bg-violet-50' },
    { href: '/manager/payments',    icon: <CreditCard size={20} />,   title: "To'lovlar",   desc: 'Qarzdorlar hisobi', color: 'hover:border-emerald-300 hover:bg-emerald-50' },
    { href: '/manager/tasks',       icon: <ClipboardList size={20} />,title: 'Vazifalar',   desc: 'Topshiriqlar',      color: 'hover:border-orange-300 hover:bg-orange-50' },
    { href: '/manager/delegations', icon: <Send size={20} />,         title: 'Delegatsiya', desc: 'Buyruq jo\'natish', color: 'hover:border-blue-300 hover:bg-blue-50' },
    { href: '/manager/rewards',     icon: <Trophy size={20} />,       title: "Sovg'a/Kitob", desc: 'Ragʼbatlantirish',   color: 'hover:border-amber-300 hover:bg-amber-50' },
    { href: '/manager/sessions',    icon: <ClipboardList size={20} />,title: 'Sertifikat',  desc: 'Sertifikat berish',  color: 'hover:border-cyan-300 hover:bg-cyan-50' },
  ];

  const alertCount = redStudents.length + yellowStudents.length;

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-5 relative">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="flex justify-between items-start mb-5 relative z-10">
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider mb-1">Manager Panel</p>
            <p className="text-white text-xl font-bold">{managerName || 'Manager'}</p>
            <p className="text-[#475569] text-xs mt-1 font-mono">
              {new Date().toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', weekday: 'long' })}
            </p>
          </div>
        </div>

        {/* Alert badge */}
        <div className={`rounded-2xl p-4 relative z-10 flex items-center gap-4 ${alertCount > 0 ? 'bg-[#e11d48]/10 border border-[#e11d48]/20' : 'bg-[#0d9488]/10 border border-[#0d9488]/20'}`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${alertCount > 0 ? 'bg-[#e11d48]/15 border border-[#e11d48]/30' : 'bg-[#0d9488]/15 border border-[#0d9488]/30'}`}>
            <AlertCircle size={22} className={alertCount > 0 ? 'text-[#e11d48]' : 'text-[#0d9488]'} />
          </div>
          <div className="flex-1">
            {loading ? (
              <Skeleton theme="light" className="h-4 w-40 mb-1" />
            ) : (
              <p className={`text-sm font-bold ${alertCount > 0 ? 'text-[#e11d48]' : 'text-[#0d9488]'}`}>
                {alertCount > 0 ? `${alertCount} ta diqqatga sazovor o'quvchi` : "Barcha o'quvchilar yaxshi"}
              </p>
            )}
            <p className="text-[#94a3b8] text-xs mt-0.5">
              {redStudents.length} ta qizil · {yellowStudents.length} ta sariq
            </p>
          </div>
          {highPerformers.length > 0 && (
            <div className="flex items-center gap-1 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-xl px-3 py-1.5">
              <Trophy size={14} className="text-[#f59e0b]" />
              <span className="text-[#f59e0b] text-xs font-bold">{highPerformers.length}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-8 pb-6 space-y-5">
        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3">
            <Stat
              theme="light"
              icon={<AlertCircle size={18} />}
              label="Qizil o'quvchilar"
              value={redStudents.length}
              color="text-rose-400"
            />
            <Stat
              theme="light"
              icon={<Trophy size={18} />}
              label="Yuqori natija"
              value={highPerformers.length}
              color="text-amber-400"
            />
          </div>
        )}

        {/* Nav cards */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">Tezkor navigatsiya</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {navCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`bg-white rounded-[18px] p-4 flex items-center gap-3 border-[1.5px] border-[#ede9e1] transition-all text-left ${card.color}`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#f7f4ef] flex items-center justify-center text-[#0f172a] shrink-0">
                  {card.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#0f172a] text-sm font-bold truncate">{card.title}</p>
                  <p className="text-[#64748b] text-xs mt-0.5 truncate">{card.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Red students */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
            Qizil o&apos;quvchilar
            {!loading && <span className="ml-2 text-[#e11d48]">({redStudents.length})</span>}
          </p>
          <div className="space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-[14px] p-3 border-[1.5px] border-[#ede9e1] flex items-center gap-3">
                  <Skeleton theme="light" className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton theme="light" className="h-4 w-1/2" />
                    <Skeleton theme="light" className="h-3 w-1/3" />
                  </div>
                </div>
              ))
            ) : redStudents.length === 0 ? (
              <div className="bg-white rounded-[14px] px-4 py-6 border-[1.5px] border-[#ede9e1] text-center">
                <p className="text-[#94a3b8] text-sm">Hech kim yo&apos;q</p>
              </div>
            ) : (
              redStudents.map((s) => (
                <Link key={s.studentId} href={`/manager/students/${s.student.id}`}
                  className="bg-white rounded-[14px] px-4 py-3 border-[1.5px] border-rose-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 text-sm font-black shrink-0">
                    {getInitials(s.student.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0f172a] text-sm font-semibold truncate">{s.student.name}</p>
                    <p className="text-[#94a3b8] text-[11px] truncate">
                      {[s.englishStatus, s.personalStatus, s.criticalStatus].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <TrendingUp size={14} className="text-rose-400 shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Yellow students */}
        <div>
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
            Sariq o&apos;quvchilar
            {!loading && <span className="ml-2 text-[#f59e0b]">({yellowStudents.length})</span>}
          </p>
          <div className="space-y-2">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-[14px] p-3 border-[1.5px] border-[#ede9e1] flex items-center gap-3">
                  <Skeleton theme="light" className="w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton theme="light" className="h-4 w-1/2" />
                    <Skeleton theme="light" className="h-3 w-1/3" />
                  </div>
                </div>
              ))
            ) : yellowStudents.length === 0 ? (
              <div className="bg-white rounded-[14px] px-4 py-6 border-[1.5px] border-[#ede9e1] text-center">
                <p className="text-[#94a3b8] text-sm">Hech kim yo&apos;q</p>
              </div>
            ) : (
              yellowStudents.map((s) => (
                <Link key={s.studentId} href={`/manager/students/${s.student.id}`}
                  className="bg-white rounded-[14px] px-4 py-3 border-[1.5px] border-amber-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 text-sm font-black shrink-0">
                    {getInitials(s.student.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0f172a] text-sm font-semibold truncate">{s.student.name}</p>
                    <p className="text-[#94a3b8] text-[11px] truncate">
                      {[s.englishStatus, s.personalStatus, s.criticalStatus].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <TrendingUp size={14} className="text-amber-400 shrink-0" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* High performers */}
        {highPerformers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
              200%+ o&apos;quvchilar <span className="ml-2 text-emerald-600">({highPerformers.length})</span>
            </p>
            <div className="space-y-2">
              {highPerformers.map((s) => (
                <Link key={s.id} href={`/manager/students/${s.id}`}
                  className="bg-white rounded-[14px] px-4 py-3 border-[1.5px] border-emerald-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 text-sm font-black shrink-0">
                    {getInitials(s.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#0f172a] text-sm font-semibold truncate">{s.name}</p>
                    <p className="text-[#94a3b8] text-[11px]">{s.lessonsCompleted}/{s.totalLessons} dars</p>
                  </div>
                  <Trophy size={14} className="text-[#f59e0b] shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Churn high-risk block */}
        {highRisk.length > 0 && (
          <section>
            <h3 className="text-rose-700 font-semibold mb-3 text-sm flex items-center gap-2">
              <AlertTriangle size={14} />
              Yuqori xavfli o&apos;quvchilar ({highRisk.length})
            </h3>
            <ul className="space-y-2">
              {highRisk.map((s) => {
                const signalText = formatSignals(s.signals);
                return (
                  <li
                    key={s.id}
                    className="p-3 bg-rose-50 rounded-lg flex items-center justify-between border border-rose-100"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/manager/students/${s.studentId ?? s.student.id}`}
                        className="font-medium text-[#0f172a] truncate block"
                      >
                        {s.student.name}
                      </Link>
                      {signalText && (
                        <div className="text-xs text-slate-600 mt-1 truncate">{signalText}</div>
                      )}
                    </div>
                    <span className="text-rose-600 font-bold ml-2 shrink-0">{s.score}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Churn medium-risk block */}
        <section>
          <h3 className="text-amber-700 font-semibold mb-3 text-sm flex items-center gap-2">
            <AlertTriangle size={14} />
            O&apos;rta xavfli o&apos;quvchilar ({mediumRisk.length})
          </h3>
          {mediumRisk.length === 0 ? (
            <p className="text-slate-500 text-sm">Hech kim yo&apos;q.</p>
          ) : (
            <ul className="space-y-2">
              {mediumRisk.map((s) => {
                const signalText = formatSignals(s.signals);
                return (
                  <li
                    key={s.id}
                    className="p-3 bg-amber-50 rounded-lg flex items-center justify-between border border-amber-100"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/manager/students/${s.studentId ?? s.student.id}`}
                        className="font-medium text-[#0f172a] truncate block"
                      >
                        {s.student.name}
                      </Link>
                      {signalText && (
                        <div className="text-xs text-slate-600 mt-1 truncate">{signalText}</div>
                      )}
                    </div>
                    <span className="text-amber-600 font-bold ml-2 shrink-0">{s.score}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
