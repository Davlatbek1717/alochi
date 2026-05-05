import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Calendar, BookOpen, CheckCircle2, Clock, ArrowLeft, ArrowRight, CalendarDays, Zap } from 'lucide-react';
import { StudentProfileClient } from './_client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface RecentLesson {
  lessonTitle: string;
  lessonOrder: number;
  sessionCount: number;
  academyCompleted: boolean;
}

interface StudentDetail {
  id: string;
  name: string;
  region: string;
  school: string;
  avatarUrl: string | null;
  joinedAt: string;
  completedLessons: number;
  totalLessons: number;
  progress: number;
  recent: RecentLesson[];
}

async function fetchStudent(id: string): Promise<StudentDetail | null> {
  try {
    const res = await fetch(`${API_BASE}/marketing/students/${id}`, {
      next: { revalidate: 60 },
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const json = (await res.json()) as { success?: boolean; data?: StudentDetail } | StudentDetail;
    if (json && typeof json === 'object' && 'data' in json && json.data) {
      return json.data as StudentDetail;
    }
    return json as StudentDetail;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const student = await fetchStudent(id);
  if (!student) return { title: "O'quvchi topilmadi | Adouptivo" };
  return {
    title: `${student.name} | Adouptivo`,
    description: `${student.name} — ${student.school}, ${student.region}. ${student.progress}% progress.`,
  };
}

function initialsGradient(name: string): string {
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  const hue = (code * 47) % 360;
  return `hsl(${hue},60%,52%)`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** SVG progress ring */
function ProgressRing({
  progress,
  size = 140,
}: {
  progress: number;
  size?: number;
}) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(progress, 100) / 100) * circ;

  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8e0d0" strokeWidth={12} />
      {/* Fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
      />
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const student = await fetchStudent(id);

  if (!student) {
    notFound();
  }

  const color = initialsGradient(student.name);
  const recent = student.recent?.slice(0, 20) ?? [];

  // Days the student has been on the platform — counted as full days,
  // floored so "joined today" reads as day 1, not day 0.
  const joinedAtMs = new Date(student.joinedAt).getTime();
  const daysSinceJoin = Number.isFinite(joinedAtMs)
    ? Math.max(1, Math.floor((Date.now() - joinedAtMs) / 86_400_000) + 1)
    : 1;
  // Activity intensity per the spec: completed steps × 100 ÷ days.
  const activityScore = Math.round((student.completedLessons * 100) / daysSinceJoin);

  return (
    <>
      <StudentProfileClient>
        <main id="main" className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
          {/* Back link */}
          <Link
            href="/#students"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#6d28d9] hover:text-[#5b21b6] transition-colors"
          >
            <ArrowLeft size={15} strokeWidth={2.75} />
            Barcha o&apos;quvchilar
          </Link>

          {/* Hero card */}
          <section
            aria-labelledby="profile-h1"
            className="bg-white rounded-3xl border-2 border-[#e8e0d0] overflow-hidden shadow-sm"
          >
            {/* Top accent bar */}
            <div className="h-2 bg-gradient-to-r from-[#6d28d9] via-[#f97316] to-[#fbbf24]" />

            <div className="px-6 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              {/* Avatar */}
              {student.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={student.avatarUrl}
                  alt={student.name}
                  width={96}
                  height={96}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-[#6d28d9]/20 shrink-0"
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center ring-4 ring-[#6d28d9]/20 text-white font-extrabold text-2xl select-none shrink-0"
                  style={{ background: color }}
                  aria-label={student.name}
                >
                  {getInitials(student.name)}
                </div>
              )}

              {/* Meta */}
              <div className="min-w-0 flex-1">
                <h1
                  id="profile-h1"
                  className="text-2xl sm:text-3xl font-extrabold text-[#1e1b4b] tracking-tight"
                >
                  {student.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#6d28d9]/8 text-xs font-extrabold text-[#6d28d9] uppercase tracking-wider">
                    <MapPin size={10} strokeWidth={3} />
                    {student.region}
                  </span>
                  <span className="text-sm font-semibold text-[#64748b]">
                    {student.school}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#94a3b8]">
                  <Calendar size={12} strokeWidth={2.5} />
                  {formatDate(student.joinedAt)} dan beri
                </div>
              </div>
            </div>
          </section>

          {/* Stats row — progress ring + tiles */}
          <section aria-label="Progress statistikasi" className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Progress ring */}
            <div className="sm:col-span-1 bg-white rounded-2xl border-2 border-[#e8e0d0] p-6 flex flex-col items-center justify-center gap-2">
              <div className="relative">
                <ProgressRing progress={student.progress} size={140} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-[#1e1b4b]">
                    {student.progress}%
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#94a3b8]">
                    Progress
                  </span>
                </div>
              </div>
            </div>

            {/* Stat tiles */}
            <div className="sm:col-span-2 grid grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl border-2 border-[#e8e0d0] p-5 flex flex-col gap-1">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-[#10b981]/12 text-[#10b981] mb-2">
                  <CheckCircle2 size={18} strokeWidth={2.5} />
                </span>
                <span className="text-3xl font-extrabold text-[#1e1b4b]">
                  {student.completedLessons}
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#94a3b8]">
                  Tugatilgan darslar
                </span>
              </div>
              <div className="bg-white rounded-2xl border-2 border-[#e8e0d0] p-5 flex flex-col gap-1">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-[#6d28d9]/10 text-[#6d28d9] mb-2">
                  <BookOpen size={18} strokeWidth={2.5} />
                </span>
                <span className="text-3xl font-extrabold text-[#1e1b4b]">
                  {student.totalLessons}
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#94a3b8]">
                  Jami darslar
                </span>
              </div>
              <div className="bg-white rounded-2xl border-2 border-[#e8e0d0] p-5 flex flex-col gap-1">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-[#1cb0f6]/12 text-[#1cb0f6] mb-2">
                  <CalendarDays size={18} strokeWidth={2.5} />
                </span>
                <span className="text-3xl font-extrabold text-[#1e1b4b]">
                  {daysSinceJoin}
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#94a3b8]">
                  Platformada (kun)
                </span>
                <span className="mt-1 text-[10px] font-semibold text-[#94a3b8]">
                  {formatDate(student.joinedAt)} dan
                </span>
              </div>
              <div className="bg-white rounded-2xl border-2 border-[#e8e0d0] p-5 flex flex-col gap-1">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-[#f97316]/12 text-[#f97316] mb-2">
                  <Zap size={18} strokeWidth={2.5} />
                </span>
                <span className="text-3xl font-extrabold text-[#1e1b4b]">
                  {activityScore}
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#94a3b8]">
                  Faollik darajasi
                </span>
                <span className="mt-1 text-[10px] font-semibold text-[#94a3b8]">
                  qadam × 100 ÷ kun
                </span>
              </div>
            </div>
          </section>

          {/* Recent activity timeline */}
          {recent.length > 0 && (
            <section aria-labelledby="activity-h2" className="bg-white rounded-2xl border-2 border-[#e8e0d0] overflow-hidden">
              <div className="px-6 py-5 border-b border-[#e8e0d0]">
                <h2 id="activity-h2" className="text-base font-extrabold text-[#1e1b4b]">
                  So&apos;nggi faoliyat
                </h2>
              </div>
              <ol className="divide-y divide-[#e8e0d0]">
                {recent.map((lesson, idx) => (
                  <li key={idx} className="px-6 py-4 flex items-start gap-3">
                    <span
                      className={`mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold ${lesson.academyCompleted ? 'bg-[#10b981] text-white' : 'bg-[#e8e0d0] text-[#64748b]'}`}
                    >
                      {lesson.lessonOrder}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-[#1e1b4b] truncate">
                        {lesson.lessonTitle}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-[#94a3b8]">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={10} strokeWidth={2.5} />
                          {lesson.sessionCount} sessiya
                        </span>
                        {lesson.academyCompleted && (
                          <span className="text-[#10b981] font-extrabold">
                            Tugatildi
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* CTA */}
          <section className="bg-[#6d28d9] rounded-3xl p-8 sm:p-10 text-center text-white">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Loyihaga qo&apos;shilish
            </h2>
            <p className="mt-3 text-base font-semibold text-white/80 max-w-md mx-auto">
              Siz ham o&apos;z sayohatingizni boshlang. Har qadam yangi imkoniyat!
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 bg-white hover:bg-white/90 text-[#6d28d9] font-extrabold text-base px-8 py-4 rounded-2xl shadow-[0_6px_0_0_rgba(255,255,255,0.3)] active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(255,255,255,0.3)] transition-all"
              >
                Kirish
                <ArrowRight size={18} strokeWidth={2.75} />
              </Link>
              <Link
                href="/?demo=1"
                className="inline-flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 border-2 border-white/30 text-white font-extrabold text-base px-8 py-4 rounded-2xl transition-all"
              >
                Demo so&apos;rash
              </Link>
            </div>
          </section>
        </main>
      </StudentProfileClient>
    </>
  );
}
