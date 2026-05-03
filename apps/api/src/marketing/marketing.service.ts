import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private prisma: PrismaService) {}

  /**
   * Featured students grid. Active student users with at least one
   * lesson session, sorted by completed-lesson count desc so the
   * landing's "Bizning O'quvchilarimiz" leads with top performers.
   */
  async listStudents() {
    const students = await this.prisma.user.findMany({
      where: { role: 'student', status: 'active' },
      select: {
        id: true,
        name: true,
        region: true,
        school: true,
        avatarUrl: true,
        createdAt: true,
        studentProgress: {
          select: { sessionCount: true, academyCompleted: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Total lesson rows are needed to compute a percentage. We grab
    // the count once and divide per student.
    const totalLessons = await this.prisma.lesson.count({
      where: { isPublished: true },
    });

    return students.map((s) => {
      const completed = s.studentProgress.filter(
        (p) => p.academyCompleted,
      ).length;
      const sessions = s.studentProgress.reduce(
        (sum, p) => sum + p.sessionCount,
        0,
      );
      const progressPct =
        totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
      return {
        id: s.id,
        name: s.name,
        region: s.region,
        school: s.school,
        avatarUrl: s.avatarUrl,
        completedLessons: completed,
        totalLessons,
        sessions,
        progress: progressPct,
        joinedAt: s.createdAt,
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
    if (!student) throw new NotFoundException("O'quvchi topilmadi");

    const totalLessons = await this.prisma.lesson.count({
      where: { isPublished: true },
    });
    const completed = student.studentProgress.filter(
      (p) => p.academyCompleted,
    ).length;
    const progressPct =
      totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

    return {
      id: student.id,
      name: student.name,
      region: student.region,
      school: student.school,
      avatarUrl: student.avatarUrl,
      joinedAt: student.createdAt,
      completedLessons: completed,
      totalLessons,
      progress: progressPct,
      recent: student.studentProgress.map((p) => ({
        lessonTitle: p.lesson?.title ?? '',
        lessonOrder: p.lesson?.orderNumber ?? null,
        sessionCount: p.sessionCount,
        academyCompleted: p.academyCompleted,
        completedAt: p.completedAt,
      })),
    };
  }

  /**
   * Aggregate platform stats for the landing's stats strip and the
   * stats card on the showcase. Cheap counts, no joins.
   */
  async getStats() {
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
        this.prisma.studentProgress.count({
          where: { academyCompleted: true },
        }),
      ]);

    const avgProgress =
      totalStudents > 0 && totalLessons > 0
        ? Math.round((completedSessions / (totalStudents * totalLessons)) * 100)
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
    const rows = await this.prisma.user.findMany({
      where: { role: 'student', status: 'active', region: { not: null } },
      select: { region: true },
      distinct: ['region'],
    });
    return rows
      .map((r) => r.region)
      .filter((r): r is string => !!r)
      .sort((a, b) => a.localeCompare(b, 'uz'));
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

    const settings: Record<string, string> = {
      ...MarketingService.DEFAULT_SETTINGS,
    };
    for (const r of rows) settings[r.key] = r.value;

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
        milestones: (milestones.length > 0
          ? milestones.map((m) => {
              const meta = (m.meta as Record<string, unknown>) ?? {};
              const tierRaw = String(meta.tier ?? 'mini').toLowerCase();
              const tier: 'gold' | 'silver' | 'mini' =
                tierRaw === 'gold' || tierRaw === 'silver' ? tierRaw : 'mini';
              return {
                step: Number(meta.step) || 0,
                tier,
                label: m.title,
              };
            })
          : MarketingService.DEFAULT_MILESTONES),
      },
    };
  }

  // ─── CMS — admin write paths (superadmin only) ───────────────────────────

  async listSettings() {
    const rows = await this.prisma.siteSetting.findMany();
    const map: Record<string, string> = {
      ...MarketingService.DEFAULT_SETTINGS,
    };
    for (const r of rows) map[r.key] = r.value;
    return map;
  }

  /**
   * Bulk upsert — admin pages send the whole edited form back at once.
   * Empty values delete the row so the fallback default takes over.
   */
  async upsertSettings(updates: Record<string, string>) {
    const ops = Object.entries(updates).map(([key, value]) => {
      if (value === '' || value === undefined || value === null) {
        return this.prisma.siteSetting.deleteMany({ where: { key } });
      }
      return this.prisma.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    });
    await this.prisma.$transaction(ops);
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
