'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
interface BrandingData {
  brandName?: string | null;
  logoUrl?: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export function useTenantBranding(): BrandingData | null {
  const searchParams = useSearchParams();
  const slug = searchParams.get('tenant');
  const [branding, setBranding] = useState<BrandingData | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetch(`${API_BASE}/branding/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: unknown) => {
        if (cancelled) return;
        // Handle both enveloped { data: {...} } and plain responses
        const data =
          json &&
          typeof json === 'object' &&
          'data' in (json as Record<string, unknown>)
            ? (json as { data: BrandingData }).data
            : (json as BrandingData);
        setBranding(data);
      })
      .catch(() => { /* silently ignore — fallback to "A'lojon" */ });
    return () => { cancelled = true; };
  }, [slug]);

  return branding;
}

/**
 * TenantBrandingLogo — the brand logo/name shown in the left panel (desktop)
 * or above the form (mobile). Replaces the hardcoded "A'lojon" text.
 */
export function TenantBrandingLogo({ mobile = false }: { mobile?: boolean }) {
  const branding = useTenantBranding();
  const displayName = branding?.brandName ?? "A'lojon";

  const content = (
    <>
      {branding?.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt={displayName}
          className="h-10 w-auto object-contain"
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
          <GraduationCap size={20} className="text-white" />
        </div>
      )}
      <span className="text-white text-xl font-black tracking-tight">{displayName}</span>
    </>
  );

  if (mobile) {
    return (
      <div className="flex items-center gap-3 mb-10 lg:hidden">
        {content}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 mb-16">
      {content}
    </div>
  );
}

/**
 * LoginCardTitle — shows a branded greeting in the login card.
 * If tenant branding provides a brandName, prepends it: "SmartEdu'ga xush kelibsiz".
 * Falls back to plain "Xush kelibsiz".
 */
export function LoginCardTitle() {
  const branding = useTenantBranding();
  const displayName = branding?.brandName;
    return (
    <div className="mb-8">
      <h2 className="text-[#0f172a] text-2xl font-black lg:block hidden">
        {displayName ? `${displayName}ga ${'Xush kelibsiz'.toLowerCase()}` : 'Xush kelibsiz'}
      </h2>
      <h2 className="text-white text-2xl font-black lg:hidden">
        {displayName ? `${displayName}ga ${'Xush kelibsiz'.toLowerCase()}` : 'Xush kelibsiz'}
      </h2>
      <p className="text-[#64748b] text-sm mt-1 lg:block hidden">{'Akkauntingizga kiring'}</p>
      <p className="text-[#94a3b8] text-sm mt-1 lg:hidden">{'Akkauntingizga kiring'}</p>
    </div>
  );
}
