'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertTriangle, BookX, FileX, ShieldAlert, HelpCircle, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

const REASON_TYPES = [
  { value: 'not_prepared', label: 'Darsga tayyorlanmagan', icon: <BookX size={18} /> },
  { value: 'no_homework', label: 'Vazifalarni bajarmagan', icon: <FileX size={18} /> },
  { value: 'discipline', label: 'Intizom buzilishi', icon: <ShieldAlert size={18} /> },
  { value: 'other', label: 'Boshqa', icon: <HelpCircle size={18} /> },
];

type Student = { id: string; name: string };

function getTokenPayload(): { userId: string; branchId: string; tenantId: string } {
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    const payload = JSON.parse(atob(token.split('.')[1])) as {
      sub?: string;
      branchId?: string;
      tenantId?: string;
    };
    return {
      userId: payload.sub ?? '',
      branchId: payload.branchId ?? '',
      tenantId: payload.tenantId ?? '',
    };
  } catch {
    return { userId: '', branchId: '', tenantId: '' };
  }
}

export default function WarningsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [reasonType, setReasonType] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    const { branchId } = getTokenPayload();
    if (!branchId) return;

    apiRequest(`/users/by-branch/${branchId}`, {}, token)
      .then((res: unknown) => {
        const data = res as { data?: Array<{ id: string; name: string; role: string }> };
        const list = data?.data ?? [];
        setStudents(list.filter((u) => u.role === 'student'));
      })
      .catch(() => {})
      .finally(() => setLoadingStudents(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reasonText.trim()) return;
    setError('');

    const token = localStorage.getItem('accessToken') ?? '';
    const { userId, tenantId } = getTokenPayload();

    try {
      await apiRequest('/warnings', {
        method: 'POST',
        body: JSON.stringify({
          tenantId,
          studentId: selectedStudent,
          givenBy: userId,
          reasonType,
          reasonText,
        }),
      }, token);
      setSubmitted(true);
      setSelectedStudent('');
      setReasonType('');
      setReasonText('');
      setTimeout(() => setSubmitted(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #e11d48 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
        />
        <div className="relative z-10">
          <button onClick={() => router.push('/filadmin')} className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm">
            <ArrowLeft size={16} /> Filadmin
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#e11d48]/20 flex items-center justify-center">
              <AlertTriangle size={18} className="text-[#e11d48]" />
            </div>
            <p className="text-white font-bold text-lg">Ogohlantirish Berish</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-5 pb-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student select */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">O&apos;quvchi *</p>
            <select
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm font-medium focus:outline-none focus:border-[#0f172a]"
              required
              disabled={loadingStudents}
            >
              <option value="">
                {loadingStudents ? 'Yuklanmoqda...' : "O'quvchi tanlang..."}
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reason type cards */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Turi *</p>
            <div className="grid grid-cols-2 gap-2">
              {REASON_TYPES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReasonType(r.value)}
                  className={`p-3 rounded-xl border-[1.5px] flex items-center gap-2 text-left transition-all ${
                    reasonType === r.value
                      ? 'border-[#e11d48] bg-[#e11d48]/5 text-[#e11d48]'
                      : 'border-[#ede9e1] bg-[#f7f4ef] text-[#64748b] hover:border-[#0f172a]'
                  }`}
                >
                  <span className="shrink-0">{r.icon}</span>
                  <span className="text-xs font-semibold leading-tight">{r.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reason text */}
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-3">
            <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">Izoh (majburiy) *</p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={3}
              required
              className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-[#0f172a] text-sm focus:outline-none focus:border-[#0f172a] resize-none"
              placeholder="Ogohlantirish sababi..."
            />
          </div>

          {error && (
            <div className="bg-[#e11d48]/10 border border-[#e11d48]/20 text-[#e11d48] px-4 py-3 rounded-[14px] text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-[#e11d48] text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-rose-700 transition-colors"
          >
            {submitted ? (
              <>
                <CheckCircle size={18} /> Berildi
              </>
            ) : (
              <>
                <AlertTriangle size={18} /> Ogohlantirish Berish
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
