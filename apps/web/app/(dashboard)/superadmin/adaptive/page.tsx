'use client';
import { useEffect, useState } from 'react';
import { Settings, Save } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  PageHeader,
  Skeleton,
  useToast,
} from '@/components/ui';

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
  const toast = useToast();

  const token = () => localStorage.getItem('accessToken') ?? '';

  useEffect(() => {
    apiRequest<AdaptiveConfig>('/adaptive/config', {}, token())
      .then((r) => setConfig(r.data))
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!config) return;
    setSaving(true);
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
      toast.success('Sozlamalar saqlandi');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Xato yuz berdi');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <PageHeader
        icon={<Settings size={20} />}
        title="Adaptiv Qiyinlik Sozlamalari"
        description="N-back algoritmi parametrlarini boshqaring"
        iconColor="text-blue-400"
      />

      {config && (
        <Card>
          <CardHeader>
            <CardTitle>N-back parametrlari</CardTitle>
            <CardDescription>
              Moslashuvchan qiyinlik darajasi uchun chegaralar
            </CardDescription>
          </CardHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="minN" className="block text-sm text-slate-400 mb-2">Minimal N (takrorlash)</label>
              <input
                id="minN"
                type="number"
                min={1}
                max={20}
                value={config.minN}
                onChange={(e) => setConfig({ ...config, minN: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="maxN" className="block text-sm text-slate-400 mb-2">Maksimal N (takrorlash)</label>
              <input
                id="maxN"
                type="number"
                min={1}
                max={20}
                value={config.maxN}
                onChange={(e) => setConfig({ ...config, maxN: Number(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="hardThreshold" className="block text-sm text-slate-400 mb-2">Qiyin chegarasi (%)</label>
              <input
                id="hardThreshold"
                type="number"
                min={1}
                max={100}
                value={Math.round(config.hardThreshold * 100)}
                onChange={(e) => setConfig({ ...config, hardThreshold: Number(e.target.value) / 100 })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Xato foizi bundan yuqori bo&apos;lsa N oshiriladi</p>
            </div>
            <div>
              <label htmlFor="easyThreshold" className="block text-sm text-slate-400 mb-2">Oson chegarasi (%)</label>
              <input
                id="easyThreshold"
                type="number"
                min={1}
                max={100}
                value={Math.round(config.easyThreshold * 100)}
                onChange={(e) => setConfig({ ...config, easyThreshold: Number(e.target.value) / 100 })}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-blue-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Xato foizi bundan past bo&apos;lsa N kamaytiriladi</p>
            </div>
          </div>

          <div className="mt-6">
            <Button
              variant="primary"
              loading={saving}
              icon={<Save size={16} />}
              onClick={save}
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
