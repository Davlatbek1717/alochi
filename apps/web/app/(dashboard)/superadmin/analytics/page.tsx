'use client';
import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { ActivityTab } from './_components/ActivityTab';
import { LessonsTab } from './_components/LessonsTab';
import { BranchesTab } from './_components/BranchesTab';
import { CohortTab } from './_components/CohortTab';
import { FunnelTab } from './_components/FunnelTab';
import { LifecycleTab } from './_components/LifecycleTab';
import { FailuresTab } from './_components/FailuresTab';
import { ComparisonTab } from './_components/ComparisonTab';
import { PageHeader, Card } from '@/components/ui';

type TabId =
  | 'activity'
  | 'lessons'
  | 'branches'
  | 'cohort'
  | 'funnel'
  | 'lifecycle'
  | 'failures'
  | 'comparison';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'activity', label: 'Faollik' },
  { id: 'lessons', label: 'Darslar' },
  { id: 'branches', label: 'Filiallar' },
  { id: 'cohort', label: 'Cohort' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'failures', label: 'Failures' },
  { id: 'comparison', label: 'Markazlar' },
];

function isValidTab(value: string): value is TabId {
  return TABS.some((t) => t.id === value);
}

export default function AnalyticsPage() {
  const [active, setActive] = useState<TabId>('activity');

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && isValidTab(hash)) setActive(hash);
  }, []);

  function changeTab(id: TabId) {
    setActive(id);
    window.location.hash = id;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        icon={<TrendingUp size={20} />}
        title="Analytics Dashboard"
        description="Filial va dars statistikasi, foydalanuvchi faolligi"
        iconColor="text-emerald-400"
      />

      <div className="border-b border-slate-700 flex gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => changeTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
              active === tab.id
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        {active === 'activity' && <ActivityTab />}
        {active === 'lessons' && <LessonsTab />}
        {active === 'branches' && <BranchesTab />}
        {active === 'cohort' && <CohortTab />}
        {active === 'funnel' && <FunnelTab />}
        {active === 'lifecycle' && <LifecycleTab />}
        {active === 'failures' && <FailuresTab />}
        {active === 'comparison' && <ComparisonTab />}
      </Card>
    </div>
  );
}
