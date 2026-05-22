export const metadata = { title: "A'lojon — Kirish", robots: 'noindex' };

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 min-h-screen flex items-center justify-center">
      {children}
    </div>
  );
}
