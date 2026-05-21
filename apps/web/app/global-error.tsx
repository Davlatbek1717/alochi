'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold text-white mb-2">
            Jiddiy xatolik yuz berdi
          </h1>
          <p className="text-slate-400 text-sm mb-8">
            Dastur ishlamasdan to&apos;xtadi. Sahifani yangilang.
          </p>
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors"
          >
            Qayta urinish
          </button>
        </div>
      </body>
    </html>
  );
}
