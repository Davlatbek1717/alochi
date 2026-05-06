import { WifiOff } from 'lucide-react';
import { RetryButton } from './_components/RetryButton';

export const metadata = {
  title: "Offline — A'lochi",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
          <WifiOff className="text-slate-400" size={36} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Internet aloqasi yo&apos;q</h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          Sahifa yuklanishi uchun internetga ulaning. Avval ko&apos;rgan sahifalaringiz hali ham ochiladi.
        </p>
        <RetryButton />
      </div>
    </div>
  );
}
