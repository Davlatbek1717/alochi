'use client';
import { useEffect, useState } from 'react';
import { Plus, Trash2, Video } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { Skeleton, useToast } from '@/components/ui';

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

export default function VideoGuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [role, setRole] = useState<string>('filadmin');
  const [videoUrl, setVideoUrl] = useState('');
  const [order, setOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  function token() {
    return localStorage.getItem('accessToken') ?? '';
  }

  function load() {
    setLoading(true);
    apiRequest<Guide[]>('/staff-guides', {}, token())
      .then((r) => setGuides(r.data))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !videoUrl) {
      toast.error("Barcha maydonlar to'ldirilishi kerak");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(
        '/staff-guides',
        {
          method: 'POST',
          body: JSON.stringify({ title, role, videoUrl, order }),
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

  async function remove(id: string) {
    if (!window.confirm("Qo'llanma o'chirilsinmi?")) return;
    try {
      await apiRequest(
        `/staff-guides/${id}`,
        { method: 'DELETE' },
        token(),
      );
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    }
  }

  return (
    <div className="min-h-full bg-slate-900 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Video className="text-blue-400" size={22} />
          <h1 className="text-xl font-bold text-white">Video qo&apos;llanmalar</h1>
        </div>

        <form
          onSubmit={create}
          className="bg-slate-800 rounded-xl p-4 space-y-3 border border-slate-700"
        >
          <p className="text-sm font-semibold text-slate-300 mb-2">
            Yangi qo&apos;llanma qo&apos;shish
          </p>
          <input
            type="text"
            placeholder="Sarlavha"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500"
          />
          <input
            type="url"
            placeholder="Video URL (YouTube va h.k.)"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500"
          />
          <div className="flex gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Tartib"
              value={order}
              onChange={(e) => setOrder(Number(e.target.value))}
              className="w-24 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
            <button
              type="submit"
              disabled={saving}
              className="ml-auto inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            >
              <Plus size={14} /> {saving ? '...' : "Qo'shish"}
            </button>
          </div>
        </form>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : guides.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            Hali qo&apos;llanma yo&apos;q
          </p>
        ) : (
          <div className="space-y-2">
            {guides.map((g) => (
              <div
                key={g.id}
                className="bg-slate-800 border border-slate-700 rounded-lg p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-white font-semibold text-sm truncate">
                    {g.title}
                  </p>
                  <a
                    href={g.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-400 hover:underline truncate block"
                  >
                    {g.videoUrl}
                  </a>
                </div>
                <span className="text-xs px-2 py-1 bg-slate-700 text-slate-300 rounded">
                  {g.role}
                </span>
                <button
                  type="button"
                  onClick={() => remove(g.id)}
                  className="text-red-400 hover:text-red-300"
                  aria-label="O'chirish"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
