'use client';
import { useEffect, useState } from 'react';
import { Shield, ShieldCheck, ShieldX, Download } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/components/ui';

function getToken() {
  return typeof window !== 'undefined' ? (localStorage.getItem('accessToken') ?? '') : '';
}

export function TwoFactorSection() {
  const toast = useToast();
  const [step, setStep] = useState<'idle' | 'setup_qr' | 'setup_verify' | 'disable' | 'regen'>('idle');
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [setupSecret, setSetupSecret] = useState('');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = getToken();
    apiRequest<{ totpEnabled: boolean }>('/users/my-profile', {}, token)
      .then((r) => setEnabled(r.data.totpEnabled ?? false))
      .catch(() => setEnabled(false));
  }, []);

  async function handleStartSetup() {
    setLoading(true);
    try {
      const token = getToken();
      const r = await apiRequest<{ qrCodeDataUrl: string; secret: string }>(
        '/auth/2fa/setup', {}, token,
      );
      setQrDataUrl(r.data.qrCodeDataUrl);
      setSetupSecret(r.data.secret);
      setStep('setup_qr');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Xatolik'); }
    finally { setLoading(false); }
  }

  async function handleEnable() {
    setLoading(true);
    try {
      const token = getToken();
      const r = await apiRequest<{ backupCodes: string[] }>(
        '/auth/2fa/enable',
        { method: 'POST', body: JSON.stringify({ code, secret: setupSecret }) },
        token,
      );
      setBackupCodes(r.data.backupCodes);
      setEnabled(true);
      setStep('idle');
      setCode('');
      toast.success('2FA yoqildi!');
    } catch (e) { toast.error(e instanceof Error ? e.message : "Kod noto'g'ri"); }
    finally { setLoading(false); }
  }

  async function handleDisable() {
    setLoading(true);
    try {
      const token = getToken();
      await apiRequest('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ code }) }, token);
      setEnabled(false);
      setStep('idle');
      setCode('');
      toast.success("2FA o'chirildi");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Kod noto'g'ri"); }
    finally { setLoading(false); }
  }

  async function handleRegen() {
    setLoading(true);
    try {
      const token = getToken();
      const r = await apiRequest<{ backupCodes: string[] }>(
        '/auth/2fa/backup-codes/regenerate',
        { method: 'POST', body: JSON.stringify({ code }) },
        token,
      );
      setBackupCodes(r.data.backupCodes);
      setStep('idle');
      setCode('');
      toast.success('Yangi backup kodlar yaratildi');
    } catch (e) { toast.error(e instanceof Error ? e.message : "Kod noto'g'ri"); }
    finally { setLoading(false); }
  }

  if (enabled === null) return <div className="h-16 animate-pulse bg-[#f3eedf] rounded-2xl" />;

  const inputCls = "w-full px-3 py-2 rounded-xl border-2 border-[#ede9e1] text-center font-mono text-lg focus:outline-none focus:border-[#6d28d9]";

  return (
    <section className="bg-white rounded-3xl border-[1.5px] border-[#ede9e1] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enabled
            ? <ShieldCheck size={18} className="text-[#10b981]" />
            : <Shield size={18} className="text-[#94a3b8]" />}
          <p className="text-sm font-extrabold text-[#0f172a]">
            Ikki bosqichli autentifikatsiya (2FA)
          </p>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          enabled ? 'bg-[#10b981]/10 text-[#10b981]' : 'bg-[#94a3b8]/10 text-[#64748b]'
        }`}>
          {enabled ? 'Yoqilgan' : "O'chirilgan"}
        </span>
      </div>

      {backupCodes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-extrabold text-amber-800 mb-2">
            Backup kodlaringiz — hozir saqlang (qaytarilmaydi):
          </p>
          <div className="grid grid-cols-2 gap-1 mb-2">
            {backupCodes.map((c) => (
              <code key={c} className="text-xs font-mono bg-white px-2 py-1 rounded border border-amber-200">{c}</code>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([backupCodes.join('\n')], { type: 'text/plain' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'adouptivo-backup-codes.txt';
                a.click();
              }}
              className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline"
            >
              <Download size={12} /> Yuklab olish
            </button>
            <button type="button" onClick={() => setBackupCodes([])} className="text-xs text-[#64748b] hover:underline">
              Yopish
            </button>
          </div>
        </div>
      )}

      {step === 'setup_qr' && (
        <div className="space-y-3">
          <p className="text-xs text-[#64748b]">Google Authenticator yoki Authy bilan skanerlang:</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="2FA QR kod" className="w-40 h-40 border rounded-xl" />
          <button type="button" onClick={() => setStep('setup_verify')}
            className="text-xs font-bold text-[#6d28d9] hover:underline">
            Skanerlayoldim →
          </button>
        </div>
      )}

      {step === 'setup_verify' && (
        <div className="space-y-2">
          <input type="text" inputMode="numeric" placeholder="6 raqamli kod"
            value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
          <div className="flex gap-2">
            <button type="button" onClick={handleEnable} disabled={loading || code.length < 6}
              className="flex-1 py-2 rounded-xl bg-[#10b981] text-white font-bold text-sm disabled:opacity-50">
              {loading ? 'Tekshirilmoqda...' : "2FA'ni yoqish"}
            </button>
            <button type="button" onClick={() => { setStep('idle'); setCode(''); }}
              className="px-4 py-2 rounded-xl text-sm font-bold text-[#64748b] hover:bg-[#f3eedf]">
              Bekor
            </button>
          </div>
        </div>
      )}

      {(step === 'disable' || step === 'regen') && (
        <div className="space-y-2">
          <input type="text" inputMode="numeric"
            placeholder={step === 'disable' ? 'TOTP yoki backup kod' : '6 raqamli TOTP kod'}
            value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} />
          <div className="flex gap-2">
            <button type="button"
              onClick={step === 'disable' ? handleDisable : handleRegen}
              disabled={loading || code.length < 6}
              className={`flex-1 py-2 rounded-xl font-bold text-sm text-white disabled:opacity-50 ${
                step === 'disable' ? 'bg-rose-500' : 'bg-[#6d28d9]'
              }`}>
              {loading ? 'Tekshirilmoqda...' : step === 'disable' ? "O'chirish" : 'Yangilash'}
            </button>
            <button type="button" onClick={() => { setStep('idle'); setCode(''); }}
              className="px-4 py-2 rounded-xl text-sm font-bold text-[#64748b] hover:bg-[#f3eedf]">
              Bekor
            </button>
          </div>
        </div>
      )}

      {step === 'idle' && (
        <div className="flex flex-wrap gap-2">
          {!enabled && (
            <button type="button" onClick={handleStartSetup} disabled={loading}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-[#6d28d9] text-white hover:bg-[#5b21b6] disabled:opacity-50">
              <ShieldCheck size={14} /> 2FA&apos;ni yoqish
            </button>
          )}
          {enabled && (
            <>
              <button type="button" onClick={() => setStep('regen')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-[#f3eedf] text-[#0f172a] hover:bg-[#ede9e1]">
                Backup kodlarni yangilash
              </button>
              <button type="button" onClick={() => setStep('disable')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100">
                <ShieldX size={14} /> O&apos;chirish
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
