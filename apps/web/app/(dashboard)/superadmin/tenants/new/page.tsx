import { Building2 } from 'lucide-react';
import { OnboardForm } from './_components/OnboardForm';

export const metadata = {
  title: 'Yangi Markaz — Alochi',
};

export default function NewTenantPage() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="text-emerald-400" size={24} />
        <h1 className="text-2xl font-bold text-white">Yangi Markaz Qo&apos;shish</h1>
      </div>
      <OnboardForm />
    </div>
  );
}
