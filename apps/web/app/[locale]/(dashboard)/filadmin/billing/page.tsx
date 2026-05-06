'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui';
import {
  ArrowLeft,
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface TenantSubscription {
  id: string;
  tenantId: string;
  plan: string;
  status: string;
  gateway: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

const PLAN_LABELS: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

const PLAN_COLORS: Record<string, string> = {
  starter: '#64748b',
  pro: '#7c3aed',
  enterprise: '#0d9488',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
    trialing: {
      label: 'Sinov davri',
      icon: <Clock size={13} />,
      bg: 'bg-amber-50',
      text: 'text-amber-700',
    },
    active: {
      label: 'Faol',
      icon: <CheckCircle size={13} />,
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
    },
    past_due: {
      label: "To'lov kechikdi",
      icon: <AlertCircle size={13} />,
      bg: 'bg-red-50',
      text: 'text-red-700',
    },
    canceled: {
      label: 'Bekor qilingan',
      icon: <XCircle size={13} />,
      bg: 'bg-slate-100',
      text: 'text-slate-600',
    },
  };
  const cfg = map[status] ?? { label: status, icon: null, bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function FiladminBillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [sub, setSub] = useState<TenantSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  async function startCheckout(plan: 'starter' | 'pro' | 'enterprise') {
    setCheckoutLoading(plan);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const res = await apiRequest<{ url: string }>(
        '/subscriptions/checkout',
        { method: 'POST', body: JSON.stringify({ plan }) },
        token,
      );
      window.location.href = res.data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    try {
      const token = localStorage.getItem('accessToken') ?? '';
      const res = await apiRequest<{ url: string }>(
        '/subscriptions/portal',
        { method: 'POST' },
        token,
      );
      window.location.href = res.data.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Xatolik yuz berdi');
    } finally {
      setPortalLoading(false);
    }
  }

  useEffect(() => {
    const token = typeof window !== 'undefined' ? (localStorage.getItem('accessToken') ?? '') : '';
    apiRequest<TenantSubscription | null>('/subscriptions/me', {}, token)
      .then((res) => {
        setSub(res.data ?? null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Xatolik yuz berdi');
      })
      .finally(() => setLoading(false));
  }, []);

  const plan = sub?.plan ?? 'starter';
  const planColor = PLAN_COLORS[plan] ?? '#64748b';

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-8 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-56 h-56 rounded-full opacity-10 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${planColor} 0%, transparent 70%)`,
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <button
            onClick={() => router.push('/filadmin')}
            className="flex items-center gap-2 text-[#94a3b8] mb-4 text-sm hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Filadmin
          </button>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${planColor}22` }}
            >
              <CreditCard size={20} style={{ color: planColor }} />
            </div>
            <div>
              <p className="text-white font-bold text-lg leading-tight">Obuna va To&apos;lov</p>
              <p className="text-[#94a3b8] text-xs mt-0.5">Billing & Subscription</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-3 pb-8 space-y-4 max-w-2xl mx-auto">
        {/* Current plan card */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#f3eedf]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">Joriy obuna</p>
          </div>

          {loading ? (
            <div className="px-5 py-8 flex items-center justify-center">
              <Loader2 size={22} className="animate-spin text-[#0d9488]" />
            </div>
          ) : error ? (
            <div className="px-5 py-5">
              <p className="text-[#e11d48] text-sm">{error}</p>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[#0f172a] font-bold text-xl" style={{ color: planColor }}>
                    {PLAN_LABELS[plan] ?? plan}
                  </p>
                  <p className="text-[#64748b] text-xs mt-0.5">
                    {sub
                      ? `Gateway: ${sub.gateway ?? 'manual'}`
                      : 'Obuna mavjud emas'}
                  </p>
                </div>
                <StatusBadge status={sub?.status ?? 'trialing'} />
              </div>

              {sub?.status === 'trialing' && sub?.currentPeriodEnd && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-start gap-3">
                  <Clock size={16} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-amber-800 text-sm font-bold">Sinov davri</p>
                    <p className="text-amber-700 text-xs mt-0.5">
                      Sinov muddati: <strong>{formatDate(sub.currentPeriodEnd)}</strong> gacha
                    </p>
                  </div>
                </div>
              )}

              {sub?.status === 'active' && sub?.currentPeriodEnd && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                  <p className="text-emerald-700 text-xs">
                    Joriy davr: <strong>{formatDate(sub.currentPeriodStart)}</strong> —{' '}
                    <strong>{formatDate(sub.currentPeriodEnd)}</strong>
                  </p>
                  {sub.cancelAtPeriodEnd && (
                    <p className="text-red-600 text-xs mt-1 font-bold">
                      Obuna davr oxirida bekor qilinadi
                    </p>
                  )}
                </div>
              )}

              {sub?.status === 'past_due' && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                  <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-red-700 text-sm font-bold">To&apos;lov kechikmoqda</p>
                    <p className="text-red-600 text-xs mt-0.5">
                      Iltimos, to&apos;lovni amalga oshiring yoki qo&apos;llab-quvvatlash bilan bog&apos;laning.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stripe redirect success/cancel banners */}
        {searchParams.get('checkout') === 'success' && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2">
            <CheckCircle size={16} />
            To&apos;lov muvaffaqiyatli! Obuna faollashtirildi.
          </div>
        )}
        {searchParams.get('checkout') === 'cancel' && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm font-semibold">
            To&apos;lov bekor qilindi. Xohlasangiz yana urinib ko&apos;ring.
          </div>
        )}

        {/* Plan selection — show when no active subscription */}
        {(!sub || ['trialing', 'past_due', 'canceled'].includes(sub.status)) && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#64748b] mb-4">
              Obuna tanlang
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              {([
                { plan: 'starter' as const, label: 'Starter', price: "$160/oy", desc: "≤50 o'quvchi, 1 filial" },
                { plan: 'pro' as const, label: 'Pro ⭐', price: "$400/oy", desc: "≤200 o'quvchi, 3 filial" },
                { plan: 'enterprise' as const, label: 'Enterprise', price: "Kelishuv", desc: "Cheksiz" },
              ]).map(({ plan, label, price, desc }) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => startCheckout(plan)}
                  disabled={checkoutLoading !== null}
                  className="flex flex-col items-start gap-1 p-4 rounded-xl border-2 border-[#ede9e1] hover:border-[#6d28d9] hover:bg-[#fffaf0] transition-colors text-left disabled:opacity-50"
                >
                  <span className="text-sm font-extrabold text-[#0f172a]">{label}</span>
                  <span className="text-lg font-black text-[#6d28d9]">{price}</span>
                  <span className="text-xs text-[#64748b] font-semibold">{desc}</span>
                  {checkoutLoading === plan && (
                    <Loader2 size={14} className="animate-spin text-[#6d28d9] mt-1" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Billing portal — show when active Stripe subscription */}
        {sub?.gateway === 'stripe' && sub.status === 'active' && (
          <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-extrabold text-[#0f172a]">Billing boshqaruvi</p>
              <p className="text-xs text-[#64748b] font-semibold mt-0.5">
                Karta yangilash, bekor qilish, invoice ko&apos;rish
              </p>
            </div>
            <button
              type="button"
              onClick={openPortal}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#1e293b] transition-colors"
            >
              {portalLoading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
              Stripe portalga o&apos;tish
            </button>
          </div>
        )}

        {/* Support / contact card */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#f3eedf]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">To&apos;lov qilish</p>
          </div>
          <div className="px-5 py-5 space-y-3">
            <p className="text-[#475569] text-sm">
              Obunani yangilash yoki tarif rejasini o&apos;zgartirish uchun qo&apos;llab-quvvatlash xizmati bilan bog&apos;laning.
            </p>
            <a
              href="https://t.me/Javohir_UH"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#0d9488] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-[#0b7a70] transition-colors"
            >
              <ExternalLink size={15} />
              Bog&apos;lanish: t.me/Javohir_UH
            </a>
          </div>
        </div>

        {/* Payment methods */}
        <div className="bg-white rounded-[18px] border-[1.5px] border-[#ede9e1] overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-[#f3eedf]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">To&apos;lov usullari</p>
          </div>
          <div className="px-5 py-5 space-y-3">
            <p className="text-[#64748b] text-xs mb-4">
              Quyidagi to&apos;lov tizimlari yaqin orada qo&apos;shiladi.
            </p>

            {/* Payme */}
            <div className="flex items-center justify-between p-3.5 border border-[#ede9e1] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#00aed9]/10 rounded-lg flex items-center justify-center">
                  <span className="text-[#00aed9] font-black text-xs">PAY</span>
                </div>
                <div>
                  <p className="text-[#0f172a] text-sm font-bold">Payme</p>
                  <p className="text-[#94a3b8] text-xs">O&apos;zbekiston to&apos;lov tizimi</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#f1f5f9] text-[#64748b] px-2.5 py-1 rounded-full">
                Tez kunda
              </span>
            </div>

            {/* Click */}
            <div className="flex items-center justify-between p-3.5 border border-[#ede9e1] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#f97316]/10 rounded-lg flex items-center justify-center">
                  <span className="text-[#f97316] font-black text-xs">CLK</span>
                </div>
                <div>
                  <p className="text-[#0f172a] text-sm font-bold">Click</p>
                  <p className="text-[#94a3b8] text-xs">O&apos;zbekiston to&apos;lov tizimi</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#f1f5f9] text-[#64748b] px-2.5 py-1 rounded-full">
                Tez kunda
              </span>
            </div>

            {/* Stripe */}
            <div className="flex items-center justify-between p-3.5 border border-[#ede9e1] rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#635bff]/10 rounded-lg flex items-center justify-center">
                  <CreditCard size={16} className="text-[#635bff]" />
                </div>
                <div>
                  <p className="text-[#0f172a] text-sm font-bold">Stripe</p>
                  <p className="text-[#94a3b8] text-xs">Xalqaro karta to&apos;lovi</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#f1f5f9] text-[#64748b] px-2.5 py-1 rounded-full">
                Tez kunda
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
