'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '../../_components/Header';
import { Footer } from '../../_components/Footer';
import { DemoForm } from '../../_components/DemoForm';

/**
 * Thin client wrapper for the student profile page.
 * Provides Header + Footer + DemoForm modal chrome without forcing the whole
 * page to be a client component. It also reads the ?demo=1 querystring so the
 * profile CTA can deep-link into the modal.
 */
export function StudentProfileClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [demoOpen, setDemoOpen] = useState(false);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('demo') === '1') {
      setDemoOpen(true);
    }
  }, [searchParams]);

  return (
    <>
      <Header onDemoClick={() => setDemoOpen(true)} />
      {children}
      <Footer />
      <DemoForm open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}
