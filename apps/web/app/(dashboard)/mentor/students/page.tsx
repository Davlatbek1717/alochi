'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GraduationCap, ChevronRight, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Student = { id: string; name: string; role: string };

function getBranchIdFromToken(): string | null {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as { branchId?: string };
    return payload.branchId ?? null;
  } catch {
    return null;
  }
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

export default function MentorStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const branchId = getBranchIdFromToken();
    if (!branchId) { setLoading(false); return; }

    apiRequest<Student[]>(`/users/by-branch/${branchId}`, {}, token)
      .then((res) => {
        setStudents((res.data ?? []).filter((u) => u.role === 'student'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <button
          onClick={() => router.push('/mentor')}
          className="flex items-center gap-2 text-[#94a3b8] text-sm font-medium mb-4 relative z-10"
        >
          <ArrowLeft size={16} /> Mentor paneli
        </button>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap size={16} className="text-violet-400" />
            <span className="text-violet-400 text-xs font-semibold uppercase tracking-wider">O&apos;quvchilar</span>
          </div>
          <p className="text-white text-xl font-bold">Xato tahlili</p>
          <p className="text-[#94a3b8] text-xs mt-1">O&apos;quvchini tanlang — AI tahlilini ko&apos;ring</p>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-[18px] p-4 border-[1.5px] border-[#ede9e1] animate-pulse flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : students.length === 0 ? (
          <div className="bg-white rounded-[18px] p-10 text-center border-[1.5px] border-[#ede9e1]">
            <GraduationCap size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-[#0f172a] font-semibold">O&apos;quvchilar topilmadi</p>
          </div>
        ) : (
          students.map((student) => (
            <button
              key={student.id}
              onClick={() => router.push(`/mentor/students/${student.id}`)}
              className="w-full bg-white rounded-[18px] px-4 py-3.5 border-[1.5px] border-[#ede9e1] flex items-center gap-3 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-black shrink-0">
                {getInitials(student.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#0f172a] font-bold text-sm truncate">{student.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Sparkles size={10} className="text-violet-400" />
                  <span className="text-[11px] text-[#94a3b8]">AI tahlilini ko&apos;rish</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#94a3b8] shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
