'use client';
import { useRouter } from 'next/navigation';
import { Header } from './Header';
import { Hero } from './Hero';
import { StatsStrip } from './StatsStrip';
import { StudentsShowcase } from './StudentsShowcase';
import { WhyAlochi } from './WhyAlochi';
import { Features } from './Features';
import { HowItWorks } from './HowItWorks';
import { ForParents } from './ForParents';
import { FAQ } from './FAQ';
import { CTA } from './CTA';
import { Footer } from './Footer';
import type { LandingCms } from './cms-types';

interface Props {
  cms: LandingCms | null;
}

/**
 * Client shell for the landing page.
 *
 * Self-serve registration was removed — the only entry point is
 * the existing tenant superadmin signing in via /login. CTAs that
 * used to launch a demo/trial flow now route there.
 *
 * Sections intentionally NOT rendered on the public landing:
 *   - Pricing      (prices are negotiated 1:1, not self-serve)
 *   - Roles        (internal panel detail, irrelevant for visitors)
 *   - PrizesSection / CertificateSection (motivational content the
 *     superadmin sees inside the dashboard, not a public sales asset)
 * The components stay in the codebase so the superadmin landing-CMS
 * editor can still curate them, but they're omitted from the public
 * page until the product needs them again.
 */
export function LandingShell({ cms }: Props) {
  const router = useRouter();
  const goLogin = () => router.push('/login');

  return (
    <>
      <Header onDemoClick={goLogin} />
      <main id="main">
        <Hero onDemoClick={goLogin} cms={cms?.hero ?? null} />
        <StatsStrip />
        <StudentsShowcase />
        <WhyAlochi />
        <Features />
        <HowItWorks />
        <ForParents />
        <FAQ />
        <CTA onDemoClick={goLogin} />
      </main>
      <Footer cms={cms?.contact ?? null} />
    </>
  );
}
