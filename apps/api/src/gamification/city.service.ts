import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeedEventService } from '../social/feed-event.service';

// 25 distinct building types — 5 per tier, cycling within each tier as the
// student keeps adding buildings beyond the tier's first 5 lessons. The
// pool order is intentional: simpler/humbler shapes first, more iconic
// later, so a Qishloq fills with houses before getting wells and fences.
const TIER_POOLS: Record<number, readonly string[]> = {
  1: ['house', 'road', 'tree', 'well', 'fence'], // Qishloq
  2: ['school', 'shop', 'park', 'bus_stop', 'garden'], // Shaharcha
  3: ['library', 'theatre', 'fountain', 'hospital', 'square'], // Shahar
  4: ['airport', 'university', 'tower', 'stadium', 'museum'], // Metropolis
  5: ['skyscraper', 'monorail', 'planetarium', 'cathedral', 'satellite_dish'], // Megapolis
};

const TIERS = [
  { level: 1, name: 'Qishloq', min: 1, max: 50 },
  { level: 2, name: 'Shaharcha', min: 51, max: 150 },
  { level: 3, name: 'Shahar', min: 151, max: 300 },
  { level: 4, name: 'Metropolis', min: 301, max: 500 },
  { level: 5, name: 'Megapolis', min: 501, max: 99999 },
] as const;

export type CityTier = {
  level: number;
  name: string;
};

export type CityBuilding = {
  id: string;
  type: string;
  tier: number;
  index: number;
  unlockedAt: string;
  isNewest: boolean;
};

export type CityResponse = {
  buildings: CityBuilding[];
  tier: CityTier;
  lessonsCompleted: number;
  nextTierAt: number | null;
  // Back-compat fields for callers that still expect the old shape.
  level: number;
  name: string;
  nextLevelAt: number | null;
};

@Injectable()
export class CityService {
  constructor(
    private prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => FeedEventService))
    private feedEvent?: FeedEventService,
  ) {}

  private getTierForLessonCount(n: number) {
    const safe = Math.max(1, n);
    return TIERS.find((t) => safe >= t.min && safe <= t.max) ?? TIERS[0];
  }

  /**
   * Insert exactly one building for the given lesson. Idempotent on
   * (studentId, lessonId): if a row already exists for this pair the
   * existing one is returned and no new building is added. The chosen
   * tier and type follow the student's current total building count
   * across all tiers.
   *
   * Best-effort: callers should treat a thrown error as non-fatal — the
   * absence of a building must never roll back the lesson the student
   * just completed. The wiring in progress.service.completeSession
   * already swallows errors with .catch().
   */
  async addBuildingForLesson(
    studentId: string,
    tenantId: string,
    lessonId: string,
  ) {
    const existing = await this.prisma.studentBuilding.findUnique({
      where: { studentId_lessonId: { studentId, lessonId } },
    });
    if (existing) return existing;

    const totalCount = await this.prisma.studentBuilding.count({
      where: { studentId },
    });
    const nextLessonNumber = totalCount + 1;
    const tier = this.getTierForLessonCount(nextLessonNumber);
    const pool =
      TIER_POOLS[tier.level as keyof typeof TIER_POOLS] ?? TIER_POOLS[1];

    const tierCount = await this.prisma.studentBuilding.count({
      where: { studentId, tier: tier.level },
    });
    const buildingType = pool[tierCount % pool.length];

    const created = await this.prisma.studentBuilding.create({
      data: {
        studentId,
        type: buildingType,
        tier: tier.level,
        index: totalCount,
        lessonId,
      },
    });

    // Tier transition — emit a feed event the FIRST time a tier gets a
    // building. tierCount === 0 here means "this is the first building
    // of this tier". Skip on the very first building (tier 1 #1) since
    // there's no transition to celebrate yet.
    if (tierCount === 0 && nextLessonNumber > 1 && this.feedEvent) {
      this.feedEvent
        .emit(tenantId, studentId, 'city_upgraded', {
          toLevel: tier.level,
          name: tier.name,
        })
        .catch(() => undefined);
    }

    return created;
  }

  /**
   * Full per-student city: every unlocked building in insertion order,
   * the current tier metadata, and the lesson-count threshold at which
   * the student crosses into the next tier.
   */
  async getCity(studentId: string): Promise<CityResponse> {
    const [buildings, progressCount] = await Promise.all([
      this.prisma.studentBuilding.findMany({
        where: { studentId },
        orderBy: { index: 'asc' },
      }),
      // Count lessons the student has actually completed in StudentProgress.
      // This covers students who finished lessons before the city feature
      // was deployed (they have progress rows but no building rows yet).
      this.prisma.studentProgress.count({
        where: {
          studentId,
          OR: [{ homeCompleted: true }, { academyCompleted: true }],
        },
      }),
    ]);
    const total = buildings.length;
    // Use the higher of the two counts so the stat is never incorrect for
    // students whose completions pre-date the city feature.
    const lessonsCompleted = Math.max(total, progressCount);
    const tier = this.getTierForLessonCount(Math.max(1, lessonsCompleted));
    const nextTier = TIERS.find((t) => t.level === tier.level + 1);
    const nextThreshold = nextTier ? nextTier.min : null;

    return {
      buildings: buildings.map((b) => ({
        id: b.id,
        type: b.type,
        tier: b.tier,
        index: b.index,
        unlockedAt: b.unlockedAt.toISOString(),
        isNewest: b.index === total - 1,
      })),
      tier: { level: tier.level, name: tier.name },
      lessonsCompleted,
      nextTierAt: nextThreshold,
      // Back-compat aliases
      level: tier.level,
      name: tier.name,
      nextLevelAt: nextThreshold,
    };
  }

  /**
   * Back-compat wrapper preserving the old shape. New callers should
   * prefer getCity() so they can render individual buildings.
   */
  async getCityLevel(studentId: string): Promise<{
    level: number;
    name: string;
    lessonsCompleted: number;
    nextLevelAt: number | null;
    buildings: string[];
  }> {
    const city = await this.getCity(studentId);
    return {
      level: city.level,
      name: city.name,
      lessonsCompleted: city.lessonsCompleted,
      nextLevelAt: city.nextLevelAt,
      buildings: city.buildings.map((b) => b.type),
    };
  }

  /**
   * Legacy entry point preserved for the academy-completion path. It
   * defers to addBuildingForLesson when both tenantId and lessonId are
   * supplied, otherwise it's a no-op (the new flow always passes both).
   */
  async checkCityLevelUp(
    studentId: string,
    tenantId: string,
    _oldCount: number,
    _newCount: number,
    lessonId?: string,
  ): Promise<void> {
    if (!lessonId) return;
    await this.addBuildingForLesson(studentId, tenantId, lessonId).catch(
      () => undefined,
    );
  }
}
