'use client';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { apiRequest } from '@/lib/api';

type Template = {
  primaryColor: string;
  secondaryColor: string;
  font: string;
  signatureName: string;
  showQr: boolean;
};

const DEFAULT: Template = {
  primaryColor: '#0f172a',
  secondaryColor: '#0d9488',
  font: 'Helvetica',
  signatureName: 'Direktor',
  showQr: true,
};

export default function CertificateDesignPage() {
  const [tpl, setTpl] = useState<Template>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('accessToken') ?? '';
    apiRequest<{ certTemplate: Template | null }>(
      '/tenants/me/cert-template',
      {},
      token,
    )
      .then((res) => {
        if (res.data?.certTemplate) {
          setTpl({ ...DEFAULT, ...res.data.certTemplate });
        }
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg('');
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      await apiRequest(
        '/tenants/me/cert-template',
        { method: 'PUT', body: JSON.stringify({ certTemplate: tpl }) },
        token,
      );
      setMsg('Saqlandi');
    } catch {
      setMsg('Xatolik');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f4ef] p-5">
      <h1 className="text-xl font-bold text-[#0f172a] mb-4">
        Sertifikat dizayni
      </h1>
      <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-4 max-w-md">
        <Field label="Asosiy rang">
          <input
            type="color"
            value={tpl.primaryColor}
            onChange={(e) =>
              setTpl({ ...tpl, primaryColor: e.target.value })
            }
            className="w-16 h-10 rounded"
          />
        </Field>
        <Field label="Yordamchi rang">
          <input
            type="color"
            value={tpl.secondaryColor}
            onChange={(e) =>
              setTpl({ ...tpl, secondaryColor: e.target.value })
            }
            className="w-16 h-10 rounded"
          />
        </Field>
        <Field label="Shrift">
          <select
            value={tpl.font}
            onChange={(e) => setTpl({ ...tpl, font: e.target.value })}
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
          >
            <option value="Helvetica">Helvetica</option>
            <option value="Times-Roman">Times Roman</option>
            <option value="Courier">Courier</option>
          </select>
        </Field>
        <Field label="Imzo nomi">
          <input
            value={tpl.signatureName}
            onChange={(e) =>
              setTpl({ ...tpl, signatureName: e.target.value })
            }
            className="w-full bg-[#f7f4ef] border border-[#ede9e1] rounded-xl px-3 py-2 text-sm"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tpl.showQr}
            onChange={(e) => setTpl({ ...tpl, showQr: e.target.checked })}
          />
          QR-kodni ko&apos;rsatish
        </label>
        <button
          disabled={saving}
          onClick={save}
          className="w-full bg-[#0f172a] text-white py-3 rounded-xl font-bold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
        >
          <Save size={16} /> Saqlash
        </button>
        {msg && <p className="text-sm text-[#0d9488]">{msg}</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}
