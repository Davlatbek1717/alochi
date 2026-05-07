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
 * Every former "Demo so'rash" CTA now lands the visitor on /register
 * where they start a 14-day free trial directly. The contact-request
 * modal funnel was removed — the trial is the demo.
 */
export function LandingShell({ cms }: Props) {
  const router = useRouter();
  const goRegister = () => router.push('/register');

  return (
    <>
      <Header onDemoClick={goRegister} />
      <main id="main">
        <Hero onDemoClick={goRegister} cms={cms?.hero ?? null} />
        <StatsStrip />
        <StudentsShowcase />
        <WhyAlochi />
        <Features />
        <PrizesSection cms={cms?.prizes ?? null} />
        <CertificateSection cms={cms?.certificate ?? null} />
        <Roles />
        <HowItWorks />
        <ForParents />
        <Pricing onDemoClick={goRegister} />
        <FAQ />
        <CTA onDemoClick={goRegister} />
      </main>
      <Footer cms={cms?.contact ?? null} />
    </>
  );
}
