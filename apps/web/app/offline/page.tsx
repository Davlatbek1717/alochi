import { WifiOff } from 'lucide-react';

export const metadata = {
  title: 'Offline — Alochi',
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
          <WifiOff className="text-slate-400" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Internet aloqasi yo&apos;q</h1>
        <p className="text-slate-400 mb-6">
          Sahifa yuklanishi uchun internetga ulaning. Avval ko&apos;rgan sahifalaringiz hali ham ochiladi.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          Qayta urinish
        </a>
      </div>
    </div>
  );
}
