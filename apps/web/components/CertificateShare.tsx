'use client';
import { useState } from 'react';
import { Send, Link as LinkIcon, Check } from 'lucide-react';

interface CertificateShareProps {
  cert: { id: string; level: string; qrCode?: string };
}

const LEVEL_LABELS: Record<string, string> = {
  bronze: 'Bronza',
  silver: 'Kumush',
  gold: 'Oltin',
  diamond: 'Olmos',
};

export default function CertificateShare({ cert }: CertificateShareProps) {
  const [copied, setCopied] = useState(false);
  const url = `https://alojon.uz/cert/${cert.id}`;
  const label = LEVEL_LABELS[cert.level] ?? cert.level;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`A'lojon: ${label} sertifikati!`)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — older browsers without Clipboard API
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <a
        href={tg}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-semibold transition-colors"
      >
        <Send size={14} /> Telegramga ulashish
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold border border-slate-200 transition-colors"
      >
        {copied ? <Check size={14} /> : <LinkIcon size={14} />}
        {copied ? 'Nusxalandi' : 'Havolani nusxalash'}
      </button>
      {cert.qrCode && (
        <img
          src={cert.qrCode}
          alt={`${label} sertifikat QR`}
          className="w-16 h-16 rounded border border-slate-200"
        />
      )}
    </div>
  );
}
