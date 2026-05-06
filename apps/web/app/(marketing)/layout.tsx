import type { ReactNode } from 'react';
import './marketing.css';

/**
 * Marketing route group — public, anonymous-accessible layout.
 *
 * No auth gate, no dashboard chrome. Wrapped in a cream surface that
 * matches the brand palette and gives the landing its warm, kid-friendly
 * personality. Nunito (loaded in the root layout via next/font) is forced
 * here as the body font so headlines and body copy share one family.
 */
export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="marketing-root font-[var(--font-nunito)] bg-[#fffaf0] text-[#1e1b4b]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:bg-[#6d28d9] focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:shadow-lg"
      >
        Asosiy mazmunga o&apos;tish
      </a>
      {children}
    </div>
  );
}
