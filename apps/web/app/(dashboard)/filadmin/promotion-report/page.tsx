'use client';
import { useEffect, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, useToast } from '@/components/ui';

interface Report {
  id: string;
  schoolName: string;
  studentsReached: number;
  visitDate: string;
  notes: string | null;
  createdAt: string;
}

export default function PromotionReportPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolName, setSchoolName] = useState('');
  const [studentsReached, setStudentsReached] = useState(0);
  const [visitDate, setVisitDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  function token() {
    return localStorage.getItem('accessToken') ?? '';
  }

  function load() {
    setLoading(true);
    apiRequest<Report[]>('/promotion-reports/mine', {}, token())
      .then((r) => setReports(r.data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolName) {
      toast.error('Maktab nomi kerak');
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        '/promotion-reports',
        {
          method: 'POST',
          body: JSON.stringify({
            schoolName,
            studentsReached,
            visitDate,
            notes: notes || undefined,
          }),
        },
        token(),
      );
      setSchoolName('');
      setStudentsReached(0);
      setNotes('');
      load();
      toast.success("Hisobot saqlandi");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <ClipboardList className="text-emerald-600" size={20} />
        <h1 className="text-lg font-bold text-gray-800">
          Targ&apos;ibot hisoboti
        </h1>
      </div>

      <form
        onSubmit={submit}
        className="bg-white border border-gray-100 rounded-xl p-4 space-y-3"
      >
        <input
          type="text"
          placeholder="Maktab nomi"
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400"
        />
        <div className="flex gap-3">
          <input
            type="number"
            placeholder="Talabalar soni"
            min={0}
            value={studentsReached}
            onChange={(e) => setStudentsReached(Number(e.target.value))}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
          />
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
          />
        </div>
        <textarea
          placeholder="Izoh (ixtiyoriy)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 placeholder-gray-400"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
        >
          <Plus size={14} /> {saving ? '...' : 'Saqlash'}
        </button>
      </form>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} theme="light" className="h-16 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-6">
          Hali hisobot yo&apos;q
        </p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-gray-100 rounded-xl p-3"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-800 text-sm">
                  {r.schoolName}
                </p>
                <span className="text-xs text-gray-500">
                  {new Date(r.visitDate).toLocaleDateString('uz-UZ')}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {r.studentsReached} talaba
              </p>
              {r.notes && (
                <p className="text-xs text-gray-600 mt-1 italic">{r.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
