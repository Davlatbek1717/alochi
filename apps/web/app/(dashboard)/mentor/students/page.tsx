'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  GraduationCap,
  ChevronRight,
  Sparkles,
  Search,
  X as XIcon,
  Users,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { getBranchIdFromToken, getGroupIdFromToken } from '@/lib/jwt';
import { EmptyState, Skeleton } from '@/components/ui';
import { useFocusRevalidate } from '@/lib/useFocusRevalidate';
import { useRevalidateOnEvent } from '@/lib/useRevalidateOnEvent';

type Student = { id: string; name: string; role: string };

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * Cycle through 5 gradient tints so the avatar grid reads as a colourful
 * roster instead of a sea of identical violet squares. Same name always
 * lands on the same tint (string-hash → index) so a given student stays
 * recognisable across reloads.
 */
const AVATAR_TINTS: ReadonlyArray<string> = [
  'from-violet-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-cyan-500 to-blue-600',
];

function avatarTintFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_TINTS[Math.abs(h) % AVATAR_TINTS.length];
}

export default function MentorStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const groupId = getGroupIdFromToken();
    const branchId = getBranchIdFromToken();
    if (!groupId && !branchId) {
      setError("Filial yoki guruh topilmadi. Administrator bilan bog'laning.");
      setLoading(false);
      return;
    }
    setError('');
    const path = groupId
      ? `/users/group/${groupId}`
      : `/users/by-branch/${branchId}`;
    apiRequest<Student[]>(path, {}, token)
      .then((res) => {
        setStudents((res.data ?? []).filter((u) => u.role === 'student'));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "O'quvchilarni yuklab bo'lmadi");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusRevalidate(load);
  useRevalidateOnEvent(['status:updated'], load);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, search]);

  return (
    <div className="min-h-full bg-[#f7f4ef] pb-4">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-15 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <Link
              href="/mentor"
              aria-label="Orqaga"
              className="w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-white/15 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="inline-flex items-center gap-1.5 text-violet-400 text-[10px] font-bold uppercase tracking-widest">
                <GraduationCap size={11} /> O&apos;quvchilar
              </p>
              <p className="text-white text-lg font-extrabold leading-tight">
                AI xato tahlili
              </p>
              <p className="text-[#94a3b8] text-[11px] font-bold mt-0.5">
                O&apos;quvchini tanlang — Gemini tahlilini ko&apos;ring
              </p>
            </div>
          </div>

          {!loading && students.length > 0 && (
            <div className="bg-[#162032] border border-white/5 rounded-2xl px-3 py-2.5 flex items-center gap-2">
              <Users size={14} className="text-violet-400" />
              <p className="text-white text-sm font-extrabold">
                {students.length}
              </p>
              <p className="text-[#94a3b8] text-[11px] font-bold">
                ta o&apos;quvchi guruhda
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-6 space-y-3 max-w-lg mx-auto">
        {/* Search */}
        {!loading && students.length > 0 && (
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8] pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="O'quvchini qidirish..."
              className="w-full bg-white border-[1.5px] border-[#ede9e1] rounded-xl pl-9 pr-9 py-2.5 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0f172a]/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Qidiruvni tozalash"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#0f172a] p-1"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
        )}

        {error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
            <p className="text-rose-800 text-sm font-bold">{error}</p>
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white px-4 py-2 rounded-xl text-sm font-extrabold transition-colors"
            >
              Qayta urinish
            </button>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 border-[1.5px] border-[#ede9e1] flex items-center gap-3"
              >
                <Skeleton theme="light" className="w-11 h-11 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton theme="light" className="h-4 w-1/2" />
                  <Skeleton theme="light" className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<GraduationCap size={28} />}
              title="O'quvchilar topilmadi"
              description="Bu filialda hali o'quvchilar yo'q"
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<Users size={28} />}
              title="Mos o'quvchi topilmadi"
              description="Qidiruvni o'zgartirib ko'ring"
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((student) => {
              const tint = avatarTintFor(student.name);
              return (
                <li key={student.id}>
                  <Link
                    href={`/mentor/students/${student.id}`}
                    className="block bg-white rounded-2xl px-4 py-3.5 border-[1.5px] border-[#ede9e1] hover:border-violet-300 hover:bg-violet-50/30 transition-colors flex items-center gap-3"
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${tint} flex items-center justify-center text-white text-sm font-extrabold shrink-0`}
                    >
                      {getInitials(student.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#0f172a] font-extrabold text-sm truncate">
                        {student.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Sparkles size={10} className="text-violet-500" />
                        <span className="text-[11px] text-violet-700 font-bold">
                          AI tahlilini ko&apos;rish
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      size={16}
                      className="text-[#94a3b8] shrink-0"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
