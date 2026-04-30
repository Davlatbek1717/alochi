'use client';
import { useState } from 'react';
import { CheckCircle2, Copy, Printer, AlertTriangle } from 'lucide-react';
import { Modal, Button } from '@/components/ui';

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
    <Modal
      open
      onClose={onClose}
      closeOnOverlay={false}
      title="Markaz muvaffaqiyatli yaratildi"
      size="md"
      footer={
        <>
          <Button
            variant="secondary"
            icon={<Printer size={14} />}
            onClick={() => window.print()}
            className="print:hidden"
          >
            Chop etish
          </Button>
          <Button variant="primary" onClick={onClose}>
            Yopib ro&apos;yxatga
          </Button>
        </>
      }
    >
      <div id="credentials-print">
        <div className="flex items-start gap-2 bg-amber-900/30 border border-amber-800 rounded-lg p-3 mb-5 print:hidden">
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={14} />
          <p className="text-xs text-amber-200">
            Bu ma&apos;lumotlarni admin&apos;ga yetkazib bering. Modal yopilgandan keyin parol qaytadan ko&apos;rsatilmaydi.
          </p>
        </div>

        <div className="space-y-3">
          <CredentialRow label="Markaz URL" value={`/${data.tenantSlug}/login`} field="url" copiedField={copiedField} onCopy={copy} />
          <CredentialRow label="Login" value={data.login} field="login" copiedField={copiedField} onCopy={copy} />
          <CredentialRow label="Parol" value={data.password} field="password" copiedField={copiedField} onCopy={copy} />
        </div>
      </div>
    </Modal>
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
