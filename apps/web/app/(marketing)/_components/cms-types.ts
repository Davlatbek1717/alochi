/** Shape returned by GET /marketing/landing */

export interface LandingItem {
  id: string;
  kind: 'prize' | 'sponsor' | 'milestone';
  title: string;
  description: string | null;
  meta: Record<string, string> | null;
  orderIndex: number;
  isVisible: boolean;
}

export type MilestoneTier = 'gold' | 'silver' | 'mini';

export interface JourneyMilestone {
  step: number;
  tier: MilestoneTier;
  label: string;
}

export interface LandingCms {
  hero: {
    badge: string;
    title: string;
    tagline: string;
    subtitle: string;
    cta: string;
  };
  contact: {
    phone: string;
    email: string;
    address: string;
    telegram: string;
    personal: string;
  };
  certificate: {
    title: string;
    description: string;
  };
  prizes: {
    title: string;
    subtitle: string;
    items: LandingItem[];
  };
  sponsors: {
    title: string;
    subtitle: string;
    items: LandingItem[];
  };
  journey: {
    badge: string;
    title: string;
    subtitle: string;
    cta: string;
    totalSteps: number;
    cols: number;
    legend: { mini: string; silver: string; gold: string };
    milestones: JourneyMilestone[];
  };
}
