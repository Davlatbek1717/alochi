'use client';
import { useEffect, useState } from 'react';
import { Save, Award, QrCode } from 'lucide-react';
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

  // Map font names to web-safe CSS family stacks for the live preview.
  const fontFamily = (() => {
    switch (tpl.font) {
      case 'Times-Roman': return '"Times New Roman", Times, serif';
      case 'Courier': return '"Courier New", Courier, monospace';
      default: return 'Helvetica, Arial, sans-serif';
    }
  })();

  return (
    <div className="min-h-full bg-[#f7f4ef] p-5">
      <h1 className="text-xl font-bold text-[#0f172a] mb-4">
        Sertifikat dizayni
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Settings */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 space-y-4">
          <Field label="Asosiy rang">
            <input
              type="color"
              value={tpl.primaryColor}
              onChange={(e) =>
                setTpl({ ...tpl, primaryColor: e.target.value })
              }
              className="w-16 h-10 rounded cursor-pointer"
            />
            <span className="ml-2 text-xs font-mono text-slate-500">{tpl.primaryColor}</span>
          </Field>
          <Field label="Yordamchi rang">
            <input
              type="color"
              value={tpl.secondaryColor}
              onChange={(e) =>
                setTpl({ ...tpl, secondaryColor: e.target.value })
              }
              className="w-16 h-10 rounded cursor-pointer"
            />
            <span className="ml-2 text-xs font-mono text-slate-500">{tpl.secondaryColor}</span>
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
          {msg && (
            <p
              className={`text-sm ${msg === 'Saqlandi' ? 'text-[#0d9488]' : 'text-rose-500'}`}
              aria-live="polite"
            >
              {msg}
            </p>
          )}
        </div>

        {/* Live preview */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-4">
          <p className="text-xs font-semibold text-[#64748b] uppercase tracking-widest mb-3">
            Tirik ko&apos;rinish
          </p>
          <div
            className="aspect-[1.41] w-full rounded-lg p-6 flex flex-col"
            style={{
              fontFamily,
              border: `4px double ${tpl.primaryColor}`,
              background: `linear-gradient(135deg, #ffffff 0%, ${tpl.secondaryColor}11 100%)`,
            }}
          >
            <div className="flex items-center justify-between">
              <Award size={28} style={{ color: tpl.primaryColor }} />
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: tpl.secondaryColor }}
              >
                A&apos;LOCHI
              </span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: tpl.secondaryColor }}>
                Sertifikat
              </p>
              <p className="text-xl font-bold mb-2" style={{ color: tpl.primaryColor }}>
                Familiya Ism
              </p>
              <p className="text-xs" style={{ color: '#64748b' }}>
                ingliz tili kursini muvaffaqiyatli tugatdi
              </p>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div
                  className="border-t border-dashed pt-1 text-xs"
                  style={{ color: tpl.primaryColor, borderColor: tpl.primaryColor, minWidth: '120px' }}
                >
                  {tpl.signatureName || '—'}
                </div>
              </div>
              {tpl.showQr && (
                <div
                  className="w-12 h-12 rounded flex items-center justify-center"
                  style={{ background: tpl.primaryColor }}
                  aria-label="QR-kod o'rni"
                >
                  <QrCode size={28} style={{ color: '#ffffff' }} />
                </div>
              )}
            </div>
          </div>
          <p className="text-xs text-[#94a3b8] mt-3">
            Haqiqiy chop versiyasi PDF-da generatsiya qilinadi; mazkur ko&apos;rinish faqat sozlamalarni tekshirish uchun.
          </p>
        </div>
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
      <div className="flex items-center">{children}</div>
    </div>
  );
}
