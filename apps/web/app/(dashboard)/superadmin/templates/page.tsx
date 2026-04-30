'use client';
import { useEffect, useMemo, useState } from 'react';
import { Bell, RotateCcw, Save } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';

interface Template {
  key: string;
  body: string;
  isDefault: boolean;
}

export default function SuperadminTemplatesPage() {
  const toast = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = useMemo(
    () => (typeof window === 'undefined' ? '' : localStorage.getItem('accessToken') ?? ''),
    [],
  );

  useEffect(() => {
    apiRequest<Template[]>('/notification-templates', {}, token)
      .then((res) => {
        setTemplates(res.data);
        const map: Record<string, string> = {};
        res.data.forEach((t) => {
          map[t.key] = t.body;
        });
        setDrafts(map);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Yuklab bo'lmadi");
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function save(key: string) {
    setSavingKey(key);
    try {
      await apiRequest(
        `/notification-templates/${encodeURIComponent(key)}`,
        {
          method: 'PUT',
          body: JSON.stringify({ body: drafts[key] }),
        },
        token,
      );
      setTemplates((prev) =>
        prev.map((t) =>
          t.key === key ? { ...t, body: drafts[key], isDefault: false } : t,
        ),
      );
      toast.success(`${key} saqlandi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSavingKey(null);
    }
  }

  async function reset(key: string) {
    setSavingKey(key);
    try {
      await apiRequest(
        `/notification-templates/${encodeURIComponent(key)}`,
        { method: 'DELETE' },
        token,
      );
      const res = await apiRequest<Template[]>(
        '/notification-templates',
        {},
        token,
      );
      setTemplates(res.data);
      const map: Record<string, string> = {};
      res.data.forEach((t) => {
        map[t.key] = t.body;
      });
      setDrafts(map);
      toast.success(`${key} standart holatga qaytarildi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Xatolik');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef]">
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Bell size={18} className="text-violet-300" />
          </div>
          <div>
            <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
              Superadmin
            </p>
            <p className="text-white font-bold text-lg">Bildirishnoma matnlari</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-5 pb-6 space-y-4">
        {loading ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6">
            <p className="text-sm text-[#94a3b8]">Yuklanmoqda...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-6">
            <p className="text-sm text-rose-500">{error}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-[#64748b]">
              {`{varName}`} placeholderlar matn yuborilganda almashtiriladi. Faqat
              o&apos;zgartirilgan matn saqlanadi — &quot;Standart&quot; tugmasi
              kalitni asl holiga qaytaradi.
            </p>
            {templates.map((t) => {
              const draft = drafts[t.key] ?? '';
              const dirty = draft !== t.body;
              return (
                <div
                  key={t.key}
                  className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <code className="text-[13px] font-mono text-[#0f172a] font-semibold">
                        {t.key}
                      </code>
                      {t.isDefault ? (
                        <span className="ml-2 inline-block bg-[#f1f5f9] text-[#64748b] text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold">
                          standart
                        </span>
                      ) : (
                        <span className="ml-2 inline-block bg-violet-100 text-violet-700 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold">
                          o&apos;zgartirilgan
                        </span>
                      )}
                    </div>
                  </div>
                  <textarea
                    value={draft}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [t.key]: e.target.value,
                      }))
                    }
                    rows={Math.max(3, draft.split('\n').length)}
                    className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2.5 text-[#0f172a] text-sm font-mono focus:outline-none focus:border-[#0f172a]"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => save(t.key)}
                      disabled={!dirty || savingKey === t.key}
                      className="bg-[#0f172a] text-white px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <Save size={14} />
                      Saqlash
                    </button>
                    {!t.isDefault && (
                      <button
                        onClick={() => reset(t.key)}
                        disabled={savingKey === t.key}
                        className="bg-white text-[#64748b] border border-[#ede9e1] px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40 flex items-center gap-1.5"
                      >
                        <RotateCcw size={14} />
                        Standart
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
