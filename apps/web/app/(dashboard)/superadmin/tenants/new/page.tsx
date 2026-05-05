import { Suspense } from 'react';
import { Building2 } from 'lucide-react';
import { OnboardForm } from './_components/OnboardForm';
import { PageHeader } from '@/components/ui';

export const metadata = {
  title: 'Yangi Markaz — Adouptivo',
};

export default function NewTenantPage() {
  return (
    <div className="min-h-full bg-slate-900">
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        icon={<Building2 size={20} />}
        title="Yangi Markaz Qo'shish"
        description="Yangi tenant, admin va birinchi filialni bir vaqtda yarating"
        iconColor="text-emerald-400"
      />
      <Suspense fallback={null}>
        <OnboardForm />
      </Suspense>
    </div>
    </div>
  );
}
