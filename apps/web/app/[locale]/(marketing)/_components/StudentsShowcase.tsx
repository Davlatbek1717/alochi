'use client';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { Search, MapPin, ArrowRight, Users } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface Student {
  id: string;
  name: string;
  region: string;
  school: string;
  avatarUrl: string | null;
  completedLessons: number;
  totalLessons: number;
  sessions: number;
  progress: number;
  joinedAt: string;
}

/** Deterministic gradient from a string — no randomness so SSR/CSR match. */
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

/** Single student card */
function StudentCard({ student }: { student: Student }) {
  const color = initialsGradient(student.name);

  return (
    <article className="lift bg-white rounded-2xl border-2 border-[#e8e0d0] overflow-hidden flex flex-col">
      {/* Top band */}
      <div className="px-5 pt-5 pb-4 flex items-start gap-3">
        {/* Avatar */}
        <div className="shrink-0">
          {student.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={student.avatarUrl}
              alt={student.name}
              width={52}
              height={52}
              className="w-[52px] h-[52px] rounded-full object-cover ring-2 ring-[#6d28d9]/20"
            />
          ) : (
            <div
              className="w-[52px] h-[52px] rounded-full flex items-center justify-center ring-2 ring-[#6d28d9]/20 text-white font-extrabold text-base select-none"
              style={{ background: color }}
              aria-label={student.name}
            >
              {getInitials(student.name)}
            </div>
          )}
        </div>
        {/* Name + meta */}
        <div className="min-w-0">
          <p className="font-extrabold text-[#1e1b4b] text-base leading-snug truncate">
            {student.name}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-[#64748b] truncate">
            {student.school}
          </p>
          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-[#6d28d9]/8 text-[10px] font-extrabold text-[#6d28d9] uppercase tracking-wider">
            <MapPin size={9} strokeWidth={3} />
            {student.region}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-4 flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#64748b]">
            Progress
          </span>
          <span className="text-sm font-extrabold text-[#6d28d9]">
            {student.progress}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#e8e0d0] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#6d28d9] to-[#f97316] transition-all"
            style={{ width: `${Math.min(student.progress, 100)}%` }}
            role="progressbar"
            aria-valuenow={student.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="mt-1.5 text-[11px] font-semibold text-[#94a3b8]">
          {student.completedLessons} / {student.totalLessons} dars
        </p>
      </div>

      {/* CTA */}
      <div className="px-5 pb-5">
        <Link
          href={`/students/${student.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#6d28d9] hover:text-[#5b21b6] transition-colors"
        >
          Profilni ko&apos;rish
          <ArrowRight size={13} strokeWidth={3} />
        </Link>
      </div>
    </article>
  );
}

/** Skeleton card shown while loading */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#e8e0d0] p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-[52px] h-[52px] rounded-full bg-[#e8e0d0]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#e8e0d0] rounded-md w-3/4" />
          <div className="h-3 bg-[#e8e0d0] rounded-md w-1/2" />
        </div>
      </div>
      <div className="h-2 bg-[#e8e0d0] rounded-full w-full" />
      <div className="h-3 bg-[#e8e0d0] rounded-md w-1/3" />
    </div>
  );
}

export function StudentsShowcase() {
  const [students, setStudents] = useState<Student[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // API responses are wrapped in { success, data } — pull `.data` out.
    const unwrap = (j: unknown) =>
      j && typeof j === 'object' && 'data' in (j as Record<string, unknown>)
        ? (j as { data: unknown }).data
        : j;
    Promise.all([
      fetch(`${API_BASE}/marketing/students`).then((r) => r.json()).then(unwrap).catch(() => []),
      fetch(`${API_BASE}/marketing/regions`).then((r) => r.json()).then(unwrap).catch(() => []),
    ]).then(([s, r]) => {
      if (!mounted) return;
      setStudents(Array.isArray(s) ? (s as Student[]) : []);
      setRegions(Array.isArray(r) ? (r as string[]) : []);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const filtered = students.filter((s) => {
    const q = query.toLowerCase();
    const matchText = !q || s.name.toLowerCase().includes(q) || s.school.toLowerCase().includes(q);
    const matchRegion = !activeRegion || s.region === activeRegion;
    return matchText && matchRegion;
  });

  const avgProgress =
    filtered.length > 0
      ? Math.round(filtered.reduce((sum, s) => sum + s.progress, 0) / filtered.length)
      : 0;

  return (
    <section
      id="students"
      aria-labelledby="students-h2"
      className="bg-[#fffaf0] border-t border-[#e8e0d0] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        {/* Heading */}
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs uppercase tracking-widest font-extrabold text-[#6d28d9]">
            Jamoamiz
          </span>
          <h2
            id="students-h2"
            className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
          >
            Bizning O&apos;quvchilarimiz
          </h2>
          <p className="mt-4 text-base text-[#475569] font-semibold leading-relaxed">
            Har bir o&apos;quvchi o&apos;z sayohatida oldinga qadam tashlayapti. Ularning
            muvaffaqiyatini kuzating!
          </p>
        </div>

        {/* Search + filters */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Search input */}
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={16}
              strokeWidth={2.5}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
            />
            <input
              type="search"
              placeholder="Ism yoki maktab bo'yicha qidirish..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-[#e8e0d0] bg-white text-sm font-semibold text-[#1e1b4b] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#6d28d9] transition-colors"
            />
          </div>

          {/* Region chips */}
          {regions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveRegion(null)}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-extrabold border-2 transition-colors',
                  activeRegion === null
                    ? 'bg-[#6d28d9] text-white border-[#6d28d9]'
                    : 'bg-white text-[#1e1b4b] border-[#e8e0d0] hover:border-[#6d28d9]/40',
                ].join(' ')}
              >
                Barchasi
              </button>
              {regions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setActiveRegion(r === activeRegion ? null : r)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-extrabold border-2 transition-colors',
                    activeRegion === r
                      ? 'bg-[#6d28d9] text-white border-[#6d28d9]'
                      : 'bg-white text-[#1e1b4b] border-[#e8e0d0] hover:border-[#6d28d9]/40',
                  ].join(' ')}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live stats bar */}
        {!loading && (
          <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm font-bold text-[#64748b]">
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} strokeWidth={2.5} className="text-[#6d28d9]" />
              {filtered.length} ta o&apos;quvchi
            </span>
            <span>
              O&apos;rtacha progress:{' '}
              <strong className="text-[#6d28d9]">{avgProgress}%</strong>
            </span>
          </div>
        )}

        {/* Grid */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : filtered.length === 0 ? (
            <div className="col-span-full py-16 flex flex-col items-center gap-3 text-center">
              <span className="text-5xl" aria-hidden>🔍</span>
              <p className="text-lg font-extrabold text-[#1e1b4b]">
                O&apos;quvchilar topilmadi
              </p>
              <p className="text-sm font-semibold text-[#64748b]">
                Qidiruv shartlarini o&apos;zgartirib ko&apos;ring
              </p>
            </div>
          ) : (
            filtered.map((s) => <StudentCard key={s.id} student={s} />)
          )}
        </div>
      </div>
    </section>
  );
}
