'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart2, ArrowLeft } from 'lucide-react';
import { ActivityTab } from './_components/ActivityTab';
import { LessonsTab } from './_components/LessonsTab';
import { BranchesTab } from './_components/BranchesTab';
import { CohortTab } from './_components/CohortTab';
import { FunnelTab } from './_components/FunnelTab';
import { LifecycleTab } from './_components/LifecycleTab';
import { FailuresTab } from './_components/FailuresTab';
import { ComparisonTab } from './_components/ComparisonTab';
import { StudyTimeTab } from './_components/StudyTimeTab';
import { ChurnTab } from './_components/ChurnTab';
import { GrowthTab } from './_components/GrowthTab';
import { LoyaltyTab } from './_components/LoyaltyTab';

type TabId =
  | 'activity'
  | 'studytime'
  | 'churn'
  | 'growth'
  | 'loyalty'
  | 'lessons'
  | 'branches'
  | 'cohort'
  | 'funnel'
  | 'lifecycle'
  | 'failures'
  | 'comparison';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'activity', label: 'Faollik' },
  { id: 'studytime', label: "O'quv vaqti" },
  { id: 'churn', label: 'Churn xavfi' },
  { id: 'growth', label: "O'sish" },
  { id: 'loyalty', label: 'Sodiqlik' },
  { id: 'lessons', label: 'Darslar' },
  { id: 'branches', label: 'Filiallar' },
  { id: 'cohort', label: 'Cohort' },
  { id: 'funnel', label: 'Funnel' },
  { id: 'lifecycle', label: 'Lifecycle' },
  { id: 'failures', label: 'Muvaffaqiyatsizliklar' },
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

    function onHashChange() {
      const h = window.location.hash.replace('#', '');
      if (h && isValidTab(h)) setActive(h);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function changeTab(id: TabId) {
    setActive(id);
    window.location.hash = id;
  }

  return (
    <div className="min-h-full bg-[#f7f4ef]">
      {/* Dark header */}
      <div className="bg-[#0f172a] px-5 pt-5 pb-6 relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-52 h-52 rounded-full opacity-10"
          style={{
            background: 'radial-gradient(circle, #6d28d9 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
        />
        <div className="relative z-10">
          <Link
            href="/superadmin"
            className="inline-flex items-center gap-1.5 text-[#94a3b8] hover:text-white text-xs mb-4 transition-colors"
            aria-label="Superadmin paneliga qaytish"
          >
            <ArrowLeft size={13} />
            Superadmin
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#6d28d9]/20 flex items-center justify-center">
              <BarChart2 size={18} className="text-[#a78bfa]" />
            </div>
            <div>
              <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wider">
                Superadmin
              </p>
              <p className="text-white font-bold text-lg">Tahlil</p>
            </div>
          </div>
          <p className="text-[#64748b] text-sm mt-1 ml-12">
            Filiallar, darslar va o&apos;quvchilar statistikasi
          </p>
        </div>
      </div>

      <div className="px-4 pt-5 pb-8 space-y-4">
        {/* Tab list */}
        <div
          role="tablist"
          aria-label="Tahlil bo'limlari"
          className="bg-white border-[1.5px] border-[#ede9e1] rounded-2xl p-1.5 flex gap-1 overflow-x-auto"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active === tab.id}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => changeTab(tab.id)}
              className={`px-3.5 py-2 text-sm font-medium whitespace-nowrap rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6d28d9]/50 ${
                active === tab.id
                  ? 'bg-[#0f172a] text-white'
                  : 'bg-transparent text-[#64748b] hover:bg-[#f7f4ef] hover:text-[#0f172a]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div className="bg-white border-[1.5px] border-[#ede9e1] rounded-2xl p-5">
          <div
            role="tabpanel"
            id={`panel-${active}`}
            aria-labelledby={`tab-${active}`}
          >
            {active === 'activity' && <ActivityTab />}
            {active === 'studytime' && <StudyTimeTab />}
            {active === 'churn' && <ChurnTab />}
            {active === 'growth' && <GrowthTab />}
            {active === 'loyalty' && <LoyaltyTab />}
            {active === 'lessons' && <LessonsTab />}
            {active === 'branches' && <BranchesTab />}
            {active === 'cohort' && <CohortTab />}
            {active === 'funnel' && <FunnelTab />}
            {active === 'lifecycle' && <LifecycleTab />}
            {active === 'failures' && <FailuresTab />}
            {active === 'comparison' && <ComparisonTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
