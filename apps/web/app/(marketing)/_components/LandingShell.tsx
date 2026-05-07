'use client';
import { useRouter } from 'next/navigation';
import { Header } from './Header';
import { Hero } from './Hero';
import { StatsStrip } from './StatsStrip';
import { StudentsShowcase } from './StudentsShowcase';
import { WhyAlochi } from './WhyAlochi';
import { Features } from './Features';
import { PrizesSection } from './PrizesSection';
import { CertificateSection } from './CertificateSection';
import { Roles } from './Roles';
import { HowItWorks } from './HowItWorks';
import { ForParents } from './ForParents';
import { Pricing } from './Pricing';
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
        <PrizesSection cms={cms?.prizes ?? null} />
        <CertificateSection cms={cms?.certificate ?? null} />
        <Roles />
        <HowItWorks />
        <ForParents />
        <Pricing onDemoClick={goLogin} />
        <FAQ />
        <CTA onDemoClick={goLogin} />
      </main>
      <Footer cms={cms?.contact ?? null} />
    </>
  );
}
