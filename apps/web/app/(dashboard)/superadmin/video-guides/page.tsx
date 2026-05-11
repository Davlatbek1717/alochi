'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Video } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { EmptyState, Modal, Skeleton, useToast } from '@/components/ui';

interface Guide {
  id: string;
  title: string;
  role: string;
  videoUrl: string;
  order: number;
}

const ROLES = [
  'filadmin',
  'manager',
  'mentor',
  'tester',
  'superadmin',
] as const;

const ROLE_LABELS: Record<string, string> = {
  filadmin: 'Filadmin',
  manager: 'Menejer',
  mentor: 'Mentor',
  tester: 'Tester',
  superadmin: 'Superadmin',
};

export default function VideoGuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<string>('filadmin');
  const [videoUrl, setVideoUrl] = useState('');
  const [order, setOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const fieldInput =
    'w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-sm text-[#0f172a] focus:outline-none focus:border-[#0d9488] transition-colors';
  const fieldLabel =
    'block text-xs font-bold uppercase tracking-widest text-[#64748b] mb-1.5';

  function token() {
    return typeof window !== 'undefined'
      ? (localStorage.getItem('accessToken') ?? '')
      : '';
  }

  function load() {
    setLoading(true);
    apiRequest<Guide[]>('/staff-guides', {}, token())
      .then((r) => setGuides(r.data))
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : 'Yuklab bo\'lmadi'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Sarlavha kiriting');
      return;
    }
    if (!videoUrl.trim()) {
      toast.error('Video URL kiriting');
      return;
    }
    if (!videoUrl.trim().startsWith('https://')) {
      toast.error("Video URL https:// bilan boshlanishi kerak");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        '/staff-guides',
        {
          method: 'POST',
          body: JSON.stringify({ title: title.trim(), role, videoUrl: videoUrl.trim(), order }),
        },
        token(),
      );
      setTitle('');
      setVideoUrl('');
      setOrder(0);
      load();
      toast.success("Qo'llanma qo'shildi");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await apiRequest(
        `/staff-guides/${confirmDeleteId}`,
        { method: 'DELETE' },
        token(),
      );
      setConfirmDeleteId(null);
      load();
      toast.success("O'chirildi");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-4 pb-5 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0d9488]/20 flex items-center justify-center">
            <Video size={18} className="text-[#0d9488]" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
              Superadmin
            </p>
            <p className="text-white font-bold text-lg">Video qo&apos;llanmalar</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-3xl">
        {/* Create form */}
        <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b] mb-4">
            Yangi qo&apos;llanma qo&apos;shish
          </p>
          <form onSubmit={create} className="space-y-4">
            <div>
              <label htmlFor="guide-title" className={fieldLabel}>
                Sarlavha <span className="text-[#e11d48]">*</span>
              </label>
              <input
                id="guide-title"
                type="text"
                placeholder="Masalan: Darslarni qanday yaratish"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={fieldInput}
              />
            </div>
            <div>
              <label htmlFor="guide-url" className={fieldLabel}>
                Video URL (https://) <span className="text-[#e11d48]">*</span>
              </label>
              <input
                id="guide-url"
                type="url"
                placeholder="https://youtube.com/..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className={fieldInput}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="guide-role" className={fieldLabel}>
                  Rol
                </label>
                <select
                  id="guide-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={fieldInput}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="guide-order" className={fieldLabel}>
                  Tartib raqami
                </label>
                <input
                  id="guide-order"
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(Number(e.target.value))}
                  className={fieldInput}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-[#0f172a] hover:bg-[#1e293b] text-white text-sm font-extrabold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {saving ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
            </button>
          </form>
        </div>

        {/* Guides list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} theme="light" className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : guides.length === 0 ? (
          <div className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] overflow-hidden">
            <EmptyState
              theme="light"
              icon={<Video size={28} />}
              title="Hali qo'llanma yo'q"
              description="Yuqoridagi forma orqali birinchi qo'llanmani qo'shing"
            />
          </div>
        ) : (
          <div className="space-y-2">
            {guides.map((g) => (
              <div
                key={g.id}
                className="bg-white rounded-2xl border-[1.5px] border-[#ede9e1] p-4 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-xl bg-[#0d9488]/10 flex items-center justify-center shrink-0">
                  <Video size={16} className="text-[#0d9488]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[#0f172a] font-semibold text-sm truncate">
                    {g.title}
                  </p>
                  {g.videoUrl.startsWith('https://') ? (
                    <a
                      href={g.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-[#6d28d9] hover:underline truncate block"
                    >
                      {g.videoUrl}
                    </a>
                  ) : (
                    <span className="text-xs text-[#94a3b8] truncate block">
                      {g.videoUrl}
                    </span>
                  )}
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-[#f7f4ef] text-[#64748b] rounded-full border border-[#ede9e1] font-semibold shrink-0">
                  {ROLE_LABELS[g.role] ?? g.role}
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(g.id)}
                  className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors shrink-0"
                  aria-label="O'chirish"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      <Modal
        open={confirmDeleteId !== null}
        onClose={() => !deleting && setConfirmDeleteId(null)}
        title="Qo'llanmani o'chirish"
        size="sm"
        theme="light"
      >
        <p className="text-sm text-[#64748b]">
          Bu qo&apos;llanmani o&apos;chirishni tasdiqlaysizmi?
        </p>
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => setConfirmDeleteId(null)}
            disabled={deleting}
            className="text-sm px-4 py-2 rounded-xl border border-[#ede9e1] text-[#64748b] font-semibold hover:bg-[#f7f4ef] disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={doDelete}
            disabled={deleting}
            className="text-sm px-4 py-2 rounded-xl bg-[#b91c1c] text-white font-semibold hover:bg-red-800 disabled:opacity-50"
          >
            {deleting ? "O'chirilmoqda..." : "O'chirish"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
