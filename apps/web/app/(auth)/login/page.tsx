import { Suspense } from 'react';
import { LoginForm } from './_components/LoginForm';
import {
  TenantBrandingLogo,
  LoginCardTitle,
} from './_components/TenantBrandingHeader';
import { Zap, Trophy, BarChart2 } from 'lucide-react';

export const metadata = {
  title: "Kirish — A'lochi",
};

const FEATURES = [
  { icon: <Zap size={16} strokeWidth={2.5} />, text: "AI bilan shaxsiy o'quv yo'li" },
  { icon: <Trophy size={16} strokeWidth={2.5} />, text: 'Gamifikatsiya va turnirlar' },
  { icon: <BarChart2 size={16} strokeWidth={2.5} />, text: 'Real vaqt tahlili' },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col lg:flex-row bg-[#0f0c2d]">
      {/* ── Left panel — editorial branding ─────────────────────────── */}
      <div className="hidden lg:flex flex-1 flex-col justify-between px-12 xl:px-16 py-10 xl:py-14 relative overflow-hidden min-w-0">
        {/* Layered atmosphere */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 -left-24 w-[420px] h-[420px] rounded-full bg-[var(--brand)]/22 blur-3xl" />
          <div className="absolute top-1/3 -right-20 w-[320px] h-[320px] rounded-full bg-[var(--accent)]/14 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 w-[360px] h-[200px] rounded-full bg-[#1cb0f6]/10 blur-3xl" />
          {/* Editorial vertical line */}
          <div className="absolute top-1/2 left-12 -translate-y-1/2 h-44 w-[1px] bg-gradient-to-b from-transparent via-white/30 to-transparent" />
        </div>

        <div className="relative z-10">
          <Suspense
            fallback={
              <div className="flex items-center gap-3 mb-16">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] opacity-50" />
                <span className="font-display text-white text-2xl font-bold tracking-tight">
                  A&apos;lochi
                </span>
              </div>
            }
          >
            <TenantBrandingLogo />
          </Suspense>

          <p className="mt-2 mb-6 text-[10px] font-extrabold uppercase tracking-[0.28em] text-white/55">
            Editorial · Modern · Ta&apos;lim
          </p>

          <h1 className="font-display text-[44px] xl:text-[60px] font-bold text-white leading-[0.95] tracking-[-0.025em]">
            O&apos;rganish —
            <br />
            <span className="italic font-light text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[#fcd34d]">
              yangi avlod
            </span>
          </h1>
          <p className="mt-7 text-[#cbd5e1] text-base leading-relaxed max-w-sm">
            Ingliz tili o&apos;rganuvchilar uchun zamonaviy platforma. AI,
            gamifikatsiya va real vaqt tahlili.
          </p>

          <div className="mt-12 space-y-3.5">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3.5">
                <div className="grid place-items-center w-9 h-9 rounded-xl bg-white/[0.06] border border-white/10 text-[var(--accent)] backdrop-blur-sm shrink-0">
                  {f.icon}
                </div>
                <span className="text-[#cbd5e1] text-sm font-medium">
                  {f.text}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[#475569] text-xs">
          © 2026 A&apos;lochi. Barcha huquqlar himoyalangan.
        </p>
      </div>

      {/* ── Right panel — login form ─────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:py-14 lg:bg-[var(--background)] relative overflow-hidden min-h-0">
        {/* Subtle warmth on the form side */}
        <div
          aria-hidden
          className="hidden lg:block absolute inset-0 pointer-events-none"
        >
          <div className="absolute top-0 right-0 w-[280px] h-[280px] rounded-full bg-[var(--brand)]/06 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-[280px] h-[200px] rounded-full bg-[var(--accent)]/06 blur-3xl" />
        </div>

        <div className="relative w-full max-w-sm">
          {/* Mobile logo */}
          <Suspense
            fallback={
              <div className="flex items-center gap-3 mb-10 lg:hidden">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand-deep)] opacity-50" />
                <span className="font-display text-white text-2xl font-bold tracking-tight">
                  A&apos;lochi
                </span>
              </div>
            }
          >
            <TenantBrandingLogo mobile />
          </Suspense>

          <Suspense
            fallback={
              <div className="mb-8">
                <h2 className="font-display text-[var(--ink)] text-3xl font-bold lg:block hidden">
                  Xush kelibsiz
                </h2>
                <h2 className="font-display text-white text-3xl font-bold lg:hidden">
                  Xush kelibsiz
                </h2>
                <p className="text-[var(--ink-3)] text-sm mt-1.5 lg:block hidden">
                  Hisobingizga kiring
                </p>
                <p className="text-[#94a3b8] text-sm mt-1.5 lg:hidden">
                  Hisobingizga kiring
                </p>
              </div>
            }
          >
            <LoginCardTitle />
          </Suspense>

          <div className="bg-[var(--surface)] rounded-3xl p-7 shadow-[var(--shadow-3)] border border-[var(--line)]">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
