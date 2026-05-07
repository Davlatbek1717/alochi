'use client';
import { useRouter } from 'next/navigation';
import { Header } from '../../_components/Header';
import { Footer } from '../../_components/Footer';

/**
 * Thin client wrapper for the student profile page.
 *
 * Provides Header + Footer chrome. Former "Demo so'rash" CTAs now
 * navigate to /register since the contact-request funnel was removed.
 */
export function StudentProfileClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const goRegister = () => router.push('/register');

  return (
    <>
      <Header onDemoClick={goRegister} />
      {children}
      <Footer />
    </>
  );
}
