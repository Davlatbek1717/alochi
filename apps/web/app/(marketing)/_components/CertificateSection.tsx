import { QrCode, Award } from 'lucide-react';
import type { LandingCms } from './cms-types';

interface Props {
  cms: LandingCms['certificate'] | null;
}

export function CertificateSection({ cms }: Props) {
  const title = cms?.title || 'Sertifikat';
  const description =
    cms?.description ||
    "Har bir boʿlimni tugatgan oʿquvchi rasmiy Aʿlochi sertifikatini oladi. Sertifikat QR-kod orqali tekshiriladi va ota-onalarga Telegram orqali yuboriladi.";

  return (
    <section
      id="certificate"
      aria-labelledby="cert-h2"
      className="bg-[#fffaf0] border-t border-[#e8e0d0] scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left — copy */}
          <div>
            <span className="text-xs uppercase tracking-widest font-extrabold text-[#6d28d9]">
              Rasmiy tasdiqlash
            </span>
            <h2
              id="cert-h2"
              className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#1e1b4b] tracking-tight"
            >
              {title}
            </h2>
            <p className="mt-5 text-base sm:text-lg font-semibold text-[#475569] leading-relaxed max-w-md">
              {description}
            </p>
            <div className="mt-8 space-y-3">
              {[
                'Har 50 darsdan keyin yangi sertifikat',
                'QR-kod orqali autentifikatsiya',
                'PDF formatida yuklab olish',
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm font-bold text-[#1e1b4b]">
                  <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-[#10b981] text-white flex items-center justify-center">
                    <Award size={11} strokeWidth={3} />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Right — certificate mockup */}
          <div className="flex justify-center lg:justify-end">
            <div
              className="relative w-full max-w-sm bg-white rounded-3xl border-2 border-[#6d28d9]/20 shadow-[0_24px_64px_-24px_rgba(109,40,217,0.3)] overflow-hidden"
              role="img"
              aria-label="Sertifikat namunasi"
            >
              {/* Top stripe */}
              <div className="h-2 bg-gradient-to-r from-[#6d28d9] via-[#f97316] to-[#fbbf24]" />

              <div className="px-7 py-8">
                {/* Brand */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-2xl font-extrabold text-[#1e1b4b] tracking-tight">
                    A&apos;LOCHI
                  </span>
                  <span className="text-xs font-extrabold uppercase tracking-widest text-[#6d28d9] bg-[#6d28d9]/8 px-2.5 py-1 rounded-full">
                    Rasmiy
                  </span>
                </div>

                <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#94a3b8] mb-2">
                  Muvaffaqiyatli tugatganligi tasdiqlangan
                </p>

                {/* Placeholder name */}
                <div className="h-8 w-3/4 bg-[#e8e0d0] rounded-lg mb-2 animate-pulse" />
                <div className="h-3 w-1/2 bg-[#e8e0d0] rounded mb-1 animate-pulse" />

                {/* Step badge */}
                <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6d28d9]/8 border border-[#6d28d9]/20">
                  <span className="text-[#6d28d9] font-extrabold text-sm">
                    STEP 1–50 sertifikati
                  </span>
                </div>

                {/* Bottom row */}
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-[#94a3b8]">
                      Berilgan sana
                    </p>
                    <p className="text-sm font-extrabold text-[#1e1b4b]">
                      Bugun
                    </p>
                  </div>
                  {/* QR code icon placeholder */}
                  <div className="grid place-items-center w-16 h-16 bg-[#1e1b4b] rounded-xl text-white">
                    <QrCode size={32} strokeWidth={1.75} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
