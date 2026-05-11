'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/api';
import { Modal, useToast } from '@/components/ui';

type Lesson = { id: string; title: string; orderNumber: number };

type Props = {
  open: boolean;
  onClose: () => void;
  studentId: string;
  studentName?: string;
  /** Called after a successful mark so the parent page can refresh summary. */
  onMarked?: (result: { totalLessons: number; marked: number; alreadyDone: number; uptoOrderNumber: number }) => void;
};

/**
 * Mentor/filadmin shortcut: mark every lesson up to and including the chosen
 * lesson as completed for a student who joined the course mid-curriculum.
 *
 * - Fetches /lessons (tenant-scoped, ordered by orderNumber) on open.
 * - Posts to /progress/:studentId/bulk-complete with { uptoLessonId, reason }.
 * - Reason is required by the backend (audit log). Min 3 chars enforced
 *   server-side; we mirror it client-side so the Save button stays disabled.
 */
export function ProgressMarkerModal({ open, onClose, studentId, studentName, onMarked }: Props) {
  const toast = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [uptoLessonId, setUptoLessonId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUptoLessonId('');
    setReason('');
    setLoading(true);
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<Lesson[]>('/lessons', {}, token)
      .then((res) => {
        const sorted = [...(res.data ?? [])].sort((a, b) => a.orderNumber - b.orderNumber);
        setLessons(sorted);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Darslar yuklanmadi'))
      .finally(() => setLoading(false));
  }, [open, toast]);

  async function handleSubmit() {
    if (!uptoLessonId) {
      toast.error('Darsni tanlang');
      return;
    }
    if (reason.trim().length < 3) {
      toast.error('Sabab kamida 3 ta belgi');
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const res = await apiRequest<{ totalLessons: number; marked: number; alreadyDone: number; uptoOrderNumber: number }>(
        `/progress/${studentId}/bulk-complete`,
        {
          method: 'POST',
          body: JSON.stringify({ uptoLessonId, reason: reason.trim() }),
        },
        token,
      );
      toast.success(
        res.data.marked === 0
          ? 'Hammasi avval belgilangan'
          : `${res.data.marked} ta dars belgilandi`,
      );
      onMarked?.(res.data);
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Xatolik';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const target = lessons.find((l) => l.id === uptoLessonId);
  const lessonsToMark = target
    ? lessons.filter((l) => l.orderNumber <= target.orderNumber).length
    : 0;

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Darslar progressini belgilash"
      size="lg"
      footer={
        <>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-sm text-[#64748b] px-4 py-2.5 min-h-[40px] rounded-xl border border-[#ede9e1] font-semibold disabled:opacity-50"
          >
            Bekor
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !uptoLessonId || reason.trim().length < 3}
            className="bg-[#0f172a] text-white text-sm px-4 py-2.5 min-h-[40px] rounded-xl font-bold disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
          >
            {submitting ? 'Belgilanmoqda...' : 'Saqlash'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-4 py-3 text-sm text-[#64748b]">
          {studentName ? (
            <>
              <span className="font-bold text-[#0f172a]">{studentName}</span>{' '}
              uchun tanlangan darsgacha (1-…) bo&apos;lgan barcha darslarni
              tamomlangan deb belgilaymiz. Avval tamomlangan darslarga
              tegmaymiz.
            </>
          ) : (
            <>
              Tanlangan darsgacha bo&apos;lgan barcha darslarni tamomlangan
              deb belgilaymiz.
            </>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">
            Qaysi darsgacha tamomlandi *
          </label>
          {loading ? (
            <div className="bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#94a3b8]">
              Darslar yuklanmoqda...
            </div>
          ) : (
            <select
              value={uptoLessonId}
              onChange={(e) => setUptoLessonId(e.target.value)}
              disabled={submitting}
              className="w-full appearance-none bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 min-h-[40px] text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a] disabled:opacity-50"
            >
              <option value="">— darsni tanlang —</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.orderNumber} · {l.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {target && (
          <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-sm text-violet-800">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>
              <span className="font-bold">{lessonsToMark} ta dars</span>{' '}
              (#1–#{target.orderNumber}) tamomlangan deb belgilanadi
            </span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-1.5">
            Sabab *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            rows={3}
            maxLength={300}
            placeholder="Masalan: oʻquvchi kursga 15-darsdan qoʻshildi, oldingi darslarni boshqa joyda oʻtgan"
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0f172a] disabled:opacity-50 resize-none"
          />
          <p className="text-[11px] text-[#94a3b8] font-mono mt-1">
            {reason.length}/300 · audit jurnalga yoziladi
          </p>
        </div>
      </div>
    </Modal>
  );
}
