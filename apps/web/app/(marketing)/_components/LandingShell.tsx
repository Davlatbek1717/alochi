'use client';
import { useState } from 'react';
import { Header } from './Header';
import { Hero } from './Hero';
import { StatsStrip } from './StatsStrip';
import { StudentsShowcase } from './StudentsShowcase';
import { WhyAlochi } from './WhyAlochi';
import { Features } from './Features';
import { JourneySection } from './JourneySection';
import { PrizesSection } from './PrizesSection';
import { TravelSection } from './TravelSection';
import { CertificateSection } from './CertificateSection';
import { Roles } from './Roles';
import { HowItWorks } from './HowItWorks';
import { ForParents } from './ForParents';
import { Pricing } from './Pricing';
import { FAQ } from './FAQ';
import { CTA } from './CTA';
import { Footer } from './Footer';
import { DemoForm } from './DemoForm';

/**
 * Client shell that owns the DemoForm modal state. The modal is shared
 * across Header, Hero, Pricing, CTA, JourneySection — putting the state
 * in one place keeps every "Demo so'rash" trigger in sync.
 */
export function LandingShell() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);
  const closeDemo = () => setDemoOpen(false);

  return (
    <>
      <Header onDemoClick={openDemo} />
      <main id="main">
        <Hero onDemoClick={openDemo} />
        <StatsStrip />
        <StudentsShowcase />
        <WhyAlochi />
        <Features />
        <JourneySection onDemoClick={openDemo} />
        <PrizesSection />
        <TravelSection />
        <CertificateSection />
        <Roles />
        <HowItWorks />
        <ForParents />
        <Pricing onDemoClick={openDemo} />
        <FAQ />
        <CTA onDemoClick={openDemo} />
      </main>
      <Footer />
      <DemoForm open={demoOpen} onClose={closeDemo} />
    </>
  );
}
