'use client';
import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Printer, AlertTriangle } from 'lucide-react';

interface Props {
  data: {
    tenantSlug: string;
    login: string;
    password: string;
  };
  onClose: () => void;
}

export function CredentialsModal({ data, onClose }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function copy(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // clipboard yo'q yoki HTTPS emas
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 print:bg-white print:relative print:p-0"
      role="dialog"
      aria-modal="true"
      aria-labelledby="credentials-modal-title"
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl max-w-md w-full p-6 print:bg-white print:border-0 print:shadow-none print:max-w-full" id="credentials-print">
        <div className="flex items-center gap-3 mb-4 print:text-black">
          <CheckCircle2 className="text-emerald-400 print:text-emerald-700" size={24} />
          <h2 id="credentials-modal-title" className="text-lg font-bold text-white print:text-black">
            Markaz muvaffaqiyatli yaratildi
          </h2>
        </div>

        <div className="bg-amber-900/30 border border-amber-800 rounded-lg p-3 mb-4 flex items-start gap-2 print:hidden">
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={14} />
          <p className="text-xs text-amber-200">
            Bu ma&apos;lumotlarni admin&apos;ga yetkazib bering. Modal yopilgandan keyin parol qaytadan ko&apos;rsatilmaydi.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          <CredentialRow label="Markaz URL" value={`/${data.tenantSlug}/login`} field="url" copiedField={copiedField} onCopy={copy} />
          <CredentialRow label="Login" value={data.login} field="login" copiedField={copiedField} onCopy={copy} />
          <CredentialRow label="Parol" value={data.password} field="password" copiedField={copiedField} onCopy={copy} />
        </div>

        <div className="flex justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <Printer size={14} /> Chop etish
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-sm"
          >
            Yopib ro&apos;yxatga
          </button>
        </div>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  field,
  copiedField,
  onCopy,
}: {
  label: string;
  value: string;
  field: string;
  copiedField: string | null;
  onCopy: (v: string, f: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 print:py-1">
      <span className="text-xs text-slate-400 w-24 print:text-black print:font-semibold">{label}</span>
      <code className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white font-mono print:bg-transparent print:border-0 print:text-black print:px-0">
        {value}
      </code>
      <button
        type="button"
        onClick={() => onCopy(value, field)}
        className="px-2 py-1.5 text-slate-400 hover:text-white print:hidden"
        aria-label="Nusxa olish"
      >
        {copiedField === field ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
