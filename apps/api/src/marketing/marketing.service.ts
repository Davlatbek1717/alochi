import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';

function clampInt(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Public-facing data for the marketing landing page. Only exposes
 * fields that are safe to publish (no logins, phones, parent IDs).
 * Aggregates progress from `StudentProgress` so the showcase can
 * highlight active learners without leaking grades.
 */
@Injectable()
export class MarketingService {
  constructor(
    private prisma: PrismaService,
    private i18n: I18nService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private async cacheGet<T>(key: string): Promise<T | null> {
    const val = await this.cache.get<T>(key).catch(() => undefined);
    return val ?? null;
  }

  private async cacheSet(
    key: string,
    value: unknown,
    ttlMs: number,
  ): Promise<void> {
    await this.cache.set(key, value, ttlMs).catch(() => undefined);
  }

  /**
   * Featured students grid. Active student users with at least one
   * lesson session, sorted by completed-lesson count desc so the
   * landing's "Bizning O'quvchilarimiz" leads with top performers.
   *
   * Hard limit: this endpoint is unauthenticated, so a missing limit
   * meant the entire active-student table was returned in one request
   * — both a leak and a DoS vector. We cap each page to 100 rows and
   * accept a `skip` offset for the rare case the showcase wants to
   * page through.
   */
  async listStudents(opts: { limit?: number; skip?: number } = {}) {
    const limit = Math.max(1, Math.min(100, opts.limit ?? 50));
    const skip = Math.max(0, opts.skip ?? 0);
    const KEY = `mc:students:${limit}:${skip}`;
    const cached = await this.cacheGet<unknown[]>(KEY);
    if (cached) return cached;
    const result = await this.fetchStudents(limit, skip);
    await this.cacheSet(KEY, result, 30_000);
    return result;
  }

  private async fetchStudents(limit: number, skip: number) {
    const [students, totalLessons] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'student', status: 'active' },
        select: {
          id: true,
          name: true,
          region: true,
          school: true,
          avatarUrl: true,
          createdAt: true,
          _count: {
            select: {
              studentProgress: { where: { academyCompleted: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.lesson.count({ where: { isPublished: true } }),
    ]);

    return students.map((s) => {
      const completed = s._count.studentProgress;
      const progressPct =
        totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
      // Same privacy rounding as the detail endpoint — keeps faollik %
      // consistent between the showcase card and the profile page.
      const joinedMonth = new Date(
        Date.UTC(
          s.createdAt.getUTCFullYear(),
          s.createdAt.getUTCMonth(),
          1,
        ),
      );
      return {
        id: s.id,
        name: s.name,
        region: s.region,
        school: s.school,
        avatarUrl: s.avatarUrl,
        completedLessons: completed,
        totalLessons,
        sessions: 0,
        progress: progressPct,
        joinedAt: joinedMonth,
      };
    });
  }

  /**
   * Public profile of a single student — safe-to-publish fields plus
   * recent progress timeline so a parent / scout can verify the
   * student is active.
   */
  async getStudent(studentId: string) {
    const student = await this.prisma.user.findFirst({
      where: { id: studentId, role: 'student', status: 'active' },
      select: {
        id: true,
        name: true,
        region: true,
        school: true,
        avatarUrl: true,
        createdAt: true,
        studentProgress: {
          select: {
            lessonId: true,
            sessionCount: true,
            academyCompleted: true,
            completedAt: true,
            lesson: { select: { title: true, orderNumber: true } },
          },
          orderBy: { completedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!student) throw new NotFoundException(this.i18n.t('user_not_found'));

    const totalLessons = await this.prisma.lesson.count({
      where: { isPublished: true },
    });
    const completed = student.studentProgress.filter(
      (p) => p.academyCompleted,
    ).length;
    const progressPct =
      totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

    // PII trim: this endpoint is unauthenticated, so a scraper that
    // walks UUIDs (or just enumerates /marketing/students) shouldn't
    // be able to reconstruct each child's day-by-day learning calendar.
    // Round the join date to the start of its month and drop the exact
    // per-lesson completedAt timestamps — keep only the public signal
    // that the student is active and how far along they are.
    const joinedMonth = new Date(
      Date.UTC(
        student.createdAt.getUTCFullYear(),
        student.createdAt.getUTCMonth(),
        1,
      ),
    );

    return {
      id: student.id,
      name: student.name,
      region: student.region,
      school: student.school,
      avatarUrl: student.avatarUrl,
      joinedAt: joinedMonth,
      completedLessons: completed,
      totalLessons,
      progress: progressPct,
      recent: student.studentProgress.map((p) => ({
        lessonTitle: p.lesson?.title ?? '',
        lessonOrder: p.lesson?.orderNumber ?? null,
        sessionCount: p.sessionCount,
        academyCompleted: p.academyCompleted,
      })),
    };
  }

  /**
   * Aggregate platform stats for the landing's stats strip and the
   * stats card on the showcase. Cheap counts, no joins.
   */
  async getStats() {
    const KEY = 'mc:stats';
    const cached = await this.cacheGet<unknown>(KEY);
    if (cached) return cached;
    const result = await this.computeStats();
    await this.cacheSet(KEY, result, 60_000);
    return result;
  }

  private async computeStats() {
    const [totalStudents, totalSchools, totalLessons, completedSessions] =
      await Promise.all([
        this.prisma.user.count({
          where: { role: 'student', status: 'active' },
        }),
        this.prisma.user.findMany({
          where: { role: 'student', status: 'active', school: { not: null } },
          select: { school: true },
          distinct: ['school'],
        }),
        this.prisma.lesson.count({ where: { isPublished: true } }),
        // Without the student-status filter this counted progress rows
        // owned by deactivated/blocked accounts too — and the avgProgress
        // ratio uses `totalStudents` (active-only), so the numerator and
        // denominator drifted out of agreement, inflating the headline.
        // Scope both sides to active students.
        this.prisma.studentProgress.count({
          where: {
            academyCompleted: true,
            student: { status: 'active' },
          },
        }),
      ]);

    const avgProgress =
      totalStudents > 0 && totalLessons > 0
        ? Math.min(
            100,
            Math.round(
              (completedSessions / (totalStudents * totalLessons)) * 100,
            ),
          )
        : 0;

    return {
      totalStudents,
      totalSchools: totalSchools.length,
      totalLessons,
      completedSessions,
      avgProgress,
    };
  }

  /**
   * Distinct list of regions that the showcase can use as filter
   * chips. Sorted alphabetically.
   */
  async getRegions() {
    const KEY = 'mc:regions';
    const cached = await this.cacheGet<string[]>(KEY);
    if (cached) return cached;
    const rows = await this.prisma.user.findMany({
      where: { role: 'student', status: 'active', region: { not: null } },
      select: { region: true },
      distinct: ['region'],
    });
    const result = rows
      .map((r) => r.region)
      .filter((r): r is string => !!r)
      .sort((a, b) => {
        try {
          return a.localeCompare(b, 'uz');
        } catch {
          return a.localeCompare(b);
        }
      });
    await this.cacheSet(KEY, result, 300_000);
    return result;
  }

  // ─── CMS — singleton settings ────────────────────────────────────────────
  //
  // Default copy that's used when the corresponding row is missing
  // from `SiteSetting`. Keeps the landing rendering even before the
  // superadmin has touched the new admin pages. Values can be plain
  // strings or JSON strings (the consumer parses where needed).
  private static DEFAULT_SETTINGS: Record<string, string> = {
    'hero.badge': "Premium Ta'lim Platformasi",
    'hero.title': "A'LOCHI",
    'hero.tagline': 'revolyutsiya',
    'hero.subtitle':
      "3-7 sinf o'quvchilari uchun zamonaviy ta'lim platformasi — AI suhbatlar, kamera nazorati va ota-onalar uchun Telegram hisobotlar.",
    'hero.cta': 'Hoziroq Boshlash',
    'contact.phone': '+998 88 081 81 88',
    'contact.email': 'javohir.uh@gmail.com',
    'contact.address': "Buxoro viloyati, G'ijduvon tumani",
    'contact.telegram': 'https://t.me/alochibolajon',
    'contact.personal': 'https://t.me/Javohir_UH',
    'certificate.title': 'Sertifikat',
    'certificate.description':
      "Har bir bo'limni tugatgan o'quvchi rasmiy A'lochi sertifikatini oladi.",
    'travel.title': 'Sayohat homiylari',
    'travel.subtitle': "Eng zo'r o'quvchilarga ekskursiya yo'llanmalari",
    'prizes.title': 'Mukofotlar',
    'prizes.subtitle': 'Yutuqlar uchun mukofotlar',
    'journey.badge': 'Gamifikatsiya',
    'journey.title': '500 Qadamlik Sayohat',
    'journey.subtitle':
      'Har bir qadam yangi yutuq, har bir marra yangi imkoniyat!',
    'journey.cta': 'Hoziroq Boshlash',
    'journey.totalSteps': '500',
    'journey.cols': '25',
    'journey.legend.mini': 'Mini Prize (50 qadam)',
    'journey.legend.silver': 'Silver Prize (200 qadam)',
    'journey.legend.gold': 'Gold Prize (400–500 qadam)',
  };

  /**
   * If the DB has no milestone rows yet (legacy installs), serve this
   * static fallback so the landing keeps showing the same shape it did
   * before the journey CMS shipped.
   */
  private static DEFAULT_MILESTONES: Array<{
    step: number;
    tier: 'gold' | 'silver' | 'mini';
    label: string;
  }> = [
    { step: 50, tier: 'mini', label: 'Mini Prize' },
    { step: 100, tier: 'mini', label: 'Mini Prize' },
    { step: 150, tier: 'mini', label: 'Mini Prize' },
    { step: 200, tier: 'silver', label: 'Silver Prize' },
    { step: 250, tier: 'silver', label: 'Silver Prize' },
    { step: 300, tier: 'silver', label: 'Silver Prize' },
    { step: 350, tier: 'silver', label: 'Silver Prize' },
    { step: 400, tier: 'gold', label: 'Gold Prize' },
    { step: 450, tier: 'gold', label: 'Gold Prize' },
    { step: 500, tier: 'gold', label: 'Gold Prize' },
  ];

  /**
   * Public — returns the FULL landing payload in one call: every
   * singleton setting (defaults applied where missing) plus visible
   * prize and sponsor lists in their author-defined order.
   */
  async getLandingContent() {
    const KEY = 'mc:landing';
    const cached = await this.cacheGet<unknown>(KEY);
    if (cached) return cached;
    const result = await this.computeLandingContent();
    await this.cacheSet(KEY, result, 60_000);
    return result;
  }

  private async computeLandingContent() {
    const [rows, prizes, sponsors, milestones] = await Promise.all([
      this.prisma.siteSetting.findMany(),
      this.prisma.landingItem.findMany({
        where: { kind: 'prize', isVisible: true },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.landingItem.findMany({
        where: { kind: 'sponsor', isVisible: true },
        orderBy: { orderIndex: 'asc' },
      }),
      this.prisma.landingItem.findMany({
        where: { kind: 'milestone', isVisible: true },
        orderBy: { orderIndex: 'asc' },
      }),
    ]);

    // Build the lookup on a null-prototype object so a malicious DB row
    // (e.g. key="__proto__") can't poison Object.prototype when copied
    // into the merged map. We then only read keys that exist in
    // DEFAULT_SETTINGS so even if pollution slipped past upsertSettings,
    // it can't escape into the response.
    const settings: Record<string, string> = Object.assign(
      Object.create(null) as Record<string, string>,
      MarketingService.DEFAULT_SETTINGS,
    );
    const allowedKeys = new Set(Object.keys(MarketingService.DEFAULT_SETTINGS));
    for (const r of rows) {
      if (allowedKeys.has(r.key)) settings[r.key] = r.value;
    }

    return {
      hero: {
        badge: settings['hero.badge'] ?? '',
        title: settings['hero.title'] ?? '',
        tagline: settings['hero.tagline'] ?? '',
        subtitle: settings['hero.subtitle'] ?? '',
        cta: settings['hero.cta'] ?? '',
      },
      contact: {
        phone: settings['contact.phone'] ?? '',
        email: settings['contact.email'] ?? '',
        address: settings['contact.address'] ?? '',
        telegram: settings['contact.telegram'] ?? '',
        personal: settings['contact.personal'] ?? '',
      },
      certificate: {
        title: settings['certificate.title'] ?? '',
        description: settings['certificate.description'] ?? '',
      },
      prizes: {
        title: settings['prizes.title'] ?? '',
        subtitle: settings['prizes.subtitle'] ?? '',
        items: prizes.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          meta: (p.meta as Record<string, unknown>) ?? {},
          orderIndex: p.orderIndex,
        })),
      },
      sponsors: {
        title: settings['travel.title'] ?? '',
        subtitle: settings['travel.subtitle'] ?? '',
        items: sponsors.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          meta: (s.meta as Record<string, unknown>) ?? {},
          orderIndex: s.orderIndex,
        })),
      },
      journey: {
        badge: settings['journey.badge'] ?? '',
        title: settings['journey.title'] ?? '',
        subtitle: settings['journey.subtitle'] ?? '',
        cta: settings['journey.cta'] ?? '',
        // Total steps + columns are stored as strings; coerce to numbers
        // and clamp so a typo can't blow up the layout (max 1000 dots
        // is plenty and keeps the grid renderable).
        totalSteps: clampInt(settings['journey.totalSteps'], 500, 1, 1000),
        cols: clampInt(settings['journey.cols'], 25, 5, 60),
        legend: {
          mini: settings['journey.legend.mini'] ?? '',
          silver: settings['journey.legend.silver'] ?? '',
          gold: settings['journey.legend.gold'] ?? '',
        },
        milestones:
          milestones.length > 0
            ? milestones.map((m) => {
                const meta = (m.meta as Record<string, unknown>) ?? {};
                const tierRaw = String(meta.tier ?? 'mini').toLowerCase();
                const tier: 'gold' | 'silver' | 'mini' =
                  tierRaw === 'gold' || tierRaw === 'silver' ? tierRaw : 'mini';
                const totalSteps = clampInt(
                  settings['journey.totalSteps'],
                  500,
                  1,
                  1000,
                );
                const rawStep = Number(meta.step);
                const step = Number.isFinite(rawStep)
                  ? Math.max(1, Math.min(totalSteps, Math.round(rawStep)))
                  : 1;
                return {
                  step,
                  tier,
                  label: m.title,
                };
              })
            : MarketingService.DEFAULT_MILESTONES,
      },
    };
  }

  // ─── CMS — admin write paths (superadmin only) ───────────────────────────

  async listSettings() {
    const rows = await this.prisma.siteSetting.findMany();
    const map: Record<string, string> = Object.assign(
      Object.create(null) as Record<string, string>,
      MarketingService.DEFAULT_SETTINGS,
    );
    const allowedKeys = new Set(Object.keys(MarketingService.DEFAULT_SETTINGS));
    for (const r of rows) {
      if (allowedKeys.has(r.key)) map[r.key] = r.value;
    }
    return map;
  }

  /**
   * Bulk upsert — admin pages send the whole edited form back at once.
   * Empty values delete the row so the fallback default takes over.
   *
   * Hard guard: only keys present in DEFAULT_SETTINGS are written. This
   * prevents a compromised superadmin (or a malicious request body) from
   * planting prototype-pollution keys like `__proto__` / `constructor`,
   * and keeps the schema closed so callers can't drift the CMS contract
   * by squatting random keys.
   */
  async upsertSettings(updates: Record<string, string>) {
    const allowedKeys = new Set(Object.keys(MarketingService.DEFAULT_SETTINGS));
    const filtered = Object.entries(updates).filter(([key]) =>
      allowedKeys.has(key),
    );
    const rejected = Object.keys(updates).filter((k) => !allowedKeys.has(k));
    if (rejected.length > 0) {
      throw new BadRequestException(
        `Noma'lum sozlama kalitlari: ${rejected.join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [key, value] of filtered) {
        if (value === '' || value === undefined || value === null) {
          await tx.siteSetting.deleteMany({ where: { key } });
        } else {
          await tx.siteSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          });
        }
      }
    });
    return this.listSettings();
  }

  async listItems(kind: 'prize' | 'sponsor' | 'milestone') {
    return this.prisma.landingItem.findMany({
      where: { kind },
      orderBy: { orderIndex: 'asc' },
    });
  }

  async createItem(input: {
    kind: 'prize' | 'sponsor' | 'milestone';
    title: string;
    description?: string;
    meta?: Record<string, unknown>;
    orderIndex?: number;
    isVisible?: boolean;
  }) {
    const orderIndex =
      input.orderIndex ??
      (await this.prisma.landingItem.count({ where: { kind: input.kind } }));
    return this.prisma.landingItem.create({
      data: {
        kind: input.kind,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        meta: (input.meta ?? {}) as unknown as object,
        orderIndex,
        isVisible: input.isVisible ?? true,
      },
    });
  }

  async updateItem(
    id: string,
    input: {
      title?: string;
      description?: string;
      meta?: Record<string, unknown>;
      orderIndex?: number;
      isVisible?: boolean;
    },
  ) {
    return this.prisma.landingItem.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() || null }
          : {}),
        ...(input.meta !== undefined
          ? { meta: input.meta as unknown as object }
          : {}),
        ...(input.orderIndex !== undefined
          ? { orderIndex: input.orderIndex }
          : {}),
        ...(input.isVisible !== undefined
          ? { isVisible: input.isVisible }
          : {}),
      },
    });
  }

  async deleteItem(id: string) {
    await this.prisma.landingItem.delete({ where: { id } });
    return { ok: true };
  }
}
