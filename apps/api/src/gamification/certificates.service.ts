import { Injectable, Optional, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { FeedEventService } from '../social/feed-event.service';
import * as QRCode from 'qrcode';

export interface CertLevel {
  level: 'bronze' | 'silver' | 'gold' | 'diamond';
  minLessons: number;
  label: string;
  emoji: string;
  /** Optional uploaded certificate template image (data URL). */
  imageUrl: string | null;
}

// Defaults — used when no SiteSetting override is present.
// Stored in descending order so `find()` picks the highest eligible level.
const DEFAULT_CERT_LEVELS: CertLevel[] = [
  {
    level: 'diamond',
    minLessons: 500,
    label: "Olmos A'lojon",
    emoji: '💎',
    imageUrl: null,
  },
  {
    level: 'gold',
    minLessons: 250,
    label: "Oltin A'lojon",
    emoji: '🥇',
    imageUrl: null,
  },
  {
    level: 'silver',
    minLessons: 100,
    label: "Kumush A'lojon",
    emoji: '🥈',
    imageUrl: null,
  },
  {
    level: 'bronze',
    minLessons: 50,
    label: "Bronza A'lojon",
    emoji: '🥉',
    imageUrl: null,
  },
];

// SiteSetting keys where superadmin can override per-level config.
const LEVEL_MIN_LESSONS_KEYS: Record<CertLevel['level'], string> = {
  bronze: 'cert.bronze.minLessons',
  silver: 'cert.silver.minLessons',
  gold: 'cert.gold.minLessons',
  diamond: 'cert.diamond.minLessons',
};
const LEVEL_IMAGE_KEYS: Record<CertLevel['level'], string> = {
  bronze: 'cert.bronze.imageUrl',
  silver: 'cert.silver.imageUrl',
  gold: 'cert.gold.imageUrl',
  diamond: 'cert.diamond.imageUrl',
};

const CERT_NAMES: Record<string, string> = {
  bronze: "🥉 Bronze A'lojon",
  silver: "🥈 Silver A'lojon",
  gold: "🥇 Gold A'lojon",
  diamond: "💎 Diamond A'lojon",
};

@Injectable()
export class CertificatesService {
  constructor(
    private prisma: PrismaService,
    @Optional() private events?: EventEmitter2,
    @Optional()
    @Inject(forwardRef(() => FeedEventService))
    private feedEvent?: FeedEventService,
  ) {}

  /** Returns the configured cert levels (DB overrides > defaults), high → low. */
  async getLevels(): Promise<CertLevel[]> {
    const allKeys = [
      ...Object.values(LEVEL_MIN_LESSONS_KEYS),
      ...Object.values(LEVEL_IMAGE_KEYS),
    ];
    const rows = await this.prisma.siteSetting.findMany({
      where: { key: { in: allKeys } },
    });
    const override = new Map(rows.map((r) => [r.key, r.value]));

    return DEFAULT_CERT_LEVELS.map((def) => {
      const rawN = override.get(LEVEL_MIN_LESSONS_KEYS[def.level]);
      const minLessons =
        rawN !== undefined && Number.isFinite(Number(rawN)) && Number(rawN) > 0
          ? Number(rawN)
          : def.minLessons;
      const imageUrl = override.get(LEVEL_IMAGE_KEYS[def.level]) ?? null;
      return { ...def, minLessons, imageUrl };
    });
  }

  /**
   * Saves per-level config (threshold + optional template image) to
   * SiteSettings. Each level value can be either:
   *   - a number → updates `minLessons` only (legacy form)
   *   - an object `{ minLessons?, imageUrl? }` → updates either field
   */
  async saveLevels(
    updates: Partial<
      Record<
        CertLevel['level'],
        number | { minLessons?: number; imageUrl?: string | null }
      >
    >,
  ) {
    await this.prisma.$transaction(async (tx) => {
      for (const [levelKey, value] of Object.entries(updates)) {
        const level = levelKey as CertLevel['level'];
        const minN = typeof value === 'number' ? value : value?.minLessons;
        const img =
          typeof value === 'object' && value !== null
            ? value.imageUrl
            : undefined;

        if (typeof minN === 'number' && Number.isFinite(minN) && minN >= 1) {
          await tx.siteSetting.upsert({
            where: { key: LEVEL_MIN_LESSONS_KEYS[level] },
            create: {
              key: LEVEL_MIN_LESSONS_KEYS[level],
              value: String(minN),
            },
            update: { value: String(minN) },
          });
        }

        if (img !== undefined) {
          if (img === null || img === '') {
            await tx.siteSetting
              .delete({ where: { key: LEVEL_IMAGE_KEYS[level] } })
              .catch(() => undefined); // already absent — fine
          } else {
            await tx.siteSetting.upsert({
              where: { key: LEVEL_IMAGE_KEYS[level] },
              create: { key: LEVEL_IMAGE_KEYS[level], value: img },
              update: { value: img },
            });
          }
        }
      }
    });
    return this.getLevels();
  }

  /**
   * Returns the student's completed lesson count plus their progress
   * toward every certificate level.
   */
  async getCertificateProgress(studentId: string) {
    const [completedCount, earnedCerts, levels] = await Promise.all([
      this.prisma.studentProgress.count({
        where: { studentId, academyCompleted: true },
      }),
      this.prisma.certificate.findMany({
        where: { studentId },
        select: { level: true },
      }),
      this.getLevels(),
    ]);

    const earned = new Set(earnedCerts.map((c) => c.level));
    // Sort ascending so the roadmap renders low → high
    const sorted = [...levels].sort((a, b) => a.minLessons - b.minLessons);

    const milestones = sorted.map((lvl) => ({
      ...lvl,
      completed: completedCount >= lvl.minLessons,
      earned: earned.has(lvl.level),
      progress: Math.min(1, completedCount / lvl.minLessons),
    }));

    const next = milestones.find((m) => !m.completed) ?? null;

    return {
      completedLessons: completedCount,
      milestones,
      next: next
        ? {
            level: next.level,
            label: next.label,
            emoji: next.emoji,
            minLessons: next.minLessons,
            remaining: next.minLessons - completedCount,
          }
        : null,
    };
  }

  async checkAndAward(studentId: string, tenantId: string) {
    const [completedCount, levels] = await Promise.all([
      this.prisma.studentProgress.count({
        where: { studentId, academyCompleted: true },
      }),
      this.getLevels(),
    ]);

    const eligible = levels.find((l) => completedCount >= l.minLessons);
    if (!eligible) return null;

    const existing = await this.prisma.certificate.findFirst({
      where: { studentId, level: eligible.level },
    });
    if (existing) return null;

    const qrCode = await QRCode.toDataURL(
      `https://alojon.uz/verify/${tenantId}/${studentId}/${eligible.level}`,
    );

    const certificate = await this.prisma.certificate.create({
      data: {
        studentId,
        tenantId,
        level: eligible.level,
        lessonsCompleted: completedCount,
        qrCode,
      },
    });

    this.events?.emit('certificate.earned', {
      certificateId: certificate.id,
      studentId,
      tenantId,
      level: eligible.level,
      certName: CERT_NAMES[eligible.level] ?? eligible.level,
    });

    this.feedEvent
      ?.emit(tenantId, studentId, 'cert_earned', {
        certificateId: certificate.id,
        level: eligible.level,
      })
      .catch(() => undefined);

    return certificate;
  }

  async getStudentCertificates(studentId: string) {
    return this.prisma.certificate.findMany({
      where: { studentId },
      orderBy: { issuedAt: 'desc' },
    });
  }

  /**
   * Manager / filadmin helper — returns all certificates for students in
   * the given branch. Includes the student's name and id so the UI can
   * link to the student detail page.
   */
  async getCertificatesForBranch(branchId: string) {
    return this.prisma.certificate.findMany({
      where: { student: { branchId } },
      orderBy: { issuedAt: 'desc' },
      include: { student: { select: { id: true, name: true } } },
    });
  }

  async generatePdf(certificateId: string): Promise<Buffer> {
    const cert = await this.prisma.certificate.findUniqueOrThrow({
      where: { id: certificateId },
      include: {
        student: { select: { name: true } },
        tenant: { select: { name: true } },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape' });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));

    const levelLabels: Record<string, string> = {
      bronze: "🥉 Bronze A'lojon",
      silver: "🥈 Silver A'lojon",
      gold: "🥇 Gold A'lojon",
      diamond: "💎 Diamond A'lojon",
    };

    doc
      .fontSize(36)
      .font('Helvetica-Bold')
      .text("A'LOCHI SERTIFIKATI", { align: 'center' });

    doc.moveDown();
    doc
      .fontSize(20)
      .font('Helvetica')
      .text(cert.student.name, { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(24)
      .text(levelLabels[cert.level] ?? cert.level, { align: 'center' });

    doc.moveDown(0.5);
    doc
      .fontSize(14)
      .text(`${cert.lessonsCompleted} ta darsni muvaffaqiyatli tamomladı`, {
        align: 'center',
      });

    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .text(
        `${cert.tenant.name} | ${cert.issuedAt.toLocaleDateString('uz-UZ')}`,
        { align: 'center' },
      );

    const qrBuffer = Buffer.from(
      cert.qrCode.replace(/^data:image\/png;base64,/, ''),
      'base64',
    );
    doc.image(qrBuffer, { width: 80, align: 'center' });

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });
  }
}
