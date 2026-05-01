'use client';
import { useState } from 'react';
import { Header } from './Header';
import { Hero } from './Hero';
import { StatsStrip } from './StatsStrip';
import { WhyAlochi } from './WhyAlochi';
import { Features } from './Features';
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
 * across Header, Hero, Pricing, and CTA — putting the state in one place
 * keeps every "Demo so'rash" trigger in sync without prop-drilling.
 *
 * Section components remain server components where possible; only the
 * three interactive ones (Header, Pricing, CTA, Hero) need 'use client'
 * — and only Header/Hero/Pricing/CTA actually call onDemoClick. Everything
 * else (StatsStrip, WhyAlochi, Features, Roles, HowItWorks, ForParents,
 * FAQ, Footer) is server-rendered.
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
        <WhyAlochi />
        <Features />
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
