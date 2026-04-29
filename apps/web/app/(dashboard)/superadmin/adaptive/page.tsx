'use client';
import { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface AdaptiveConfig {
  minN: number;
  maxN: number;
  hardThreshold: number;
  easyThreshold: number;
}

export default function AdaptivePage() {
  const [config, setConfig] = useState<AdaptiveConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    apiRequest<AdaptiveConfig>('/adaptive/config', {}, token())
      .then((r) => setConfig(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!config) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      await apiRequest('/adaptive/config', {
        method: 'PATCH',
        body: JSON.stringify({
          minN: Number(config.minN),
          maxN: Number(config.maxN),
          hardThreshold: Number(config.hardThreshold),
          easyThreshold: Number(config.easyThreshold),
        }),
      }, token());
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-slate-400">Yuklanmoqda...</div>;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="text-blue-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Adaptiv Qiyinlik Sozlamalari</h1>
      </div>
      {error && <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">{error}</div>}
      {saved && <div className="mb-4 p-3 bg-green-900/40 border border-green-700 rounded-lg text-green-300 text-sm">Saqlandi ✓</div>}
      {config && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Minimal N (takrorlash)</label>
              <input type="number" min={1} max={20} value={config.minN}
                onChange={(e) => setConfig({ ...config, minN: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Maksimal N (takrorlash)</label>
              <input type="number" min={1} max={20} value={config.maxN}
                onChange={(e) => setConfig({ ...config, maxN: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Qiyin chegarasi (%)</label>
              <input type="number" min={1} max={100} value={Math.round(config.hardThreshold * 100)}
                onChange={(e) => setConfig({ ...config, hardThreshold: Number(e.target.value) / 100 })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
              <p className="text-xs text-slate-500 mt-1">Xato foizi bundan yuqori bo&apos;lsa N oshiriladi</p>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Oson chegarasi (%)</label>
              <input type="number" min={1} max={100} value={Math.round(config.easyThreshold * 100)}
                onChange={(e) => setConfig({ ...config, easyThreshold: Number(e.target.value) / 100 })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none" />
              <p className="text-xs text-slate-500 mt-1">Xato foizi bundan past bo&apos;lsa N kamaytiriladi</p>
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">
            <Save size={16} />
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      )}
    </div>
  );
}
