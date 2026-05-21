import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { VisitStatus } from '@prisma/client';

/** Haversine distance in metres between two GPS points. */
function haversineMetres(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const VISIT_INCLUDE = {
  photos: true,
  checklistItems: true,
  actionItems: true,
  issues: true,
} as const;

@Injectable()
export class VisitsService {
  constructor(private prisma: PrismaService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: {
    studentId: string;
    visitorId: string;
    branchId: string;
    scheduledFor: Date;
    homeAddress?: string;
    homeLatitude?: number;
    homeLongitude?: number;
    riskScoreAtPlan?: number;
    tenantId: string;
  }) {
    return this.prisma.homeVisit.create({ data: dto, include: VISIT_INCLUDE });
  }

  async findAll(
    tenantId: string,
    query: {
      date?: string;
      status?: VisitStatus;
      visitorId?: string;
      branchId?: string;
    },
  ) {
    const start = query.date ? new Date(`${query.date}T00:00:00+05:00`) : undefined;
    const end = query.date ? new Date(`${query.date}T23:59:59+05:00`) : undefined;
    return this.prisma.homeVisit.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.visitorId ? { visitorId: query.visitorId } : {}),
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(start && end ? { scheduledFor: { gte: start, lte: end } } : {}),
      },
      orderBy: { scheduledFor: 'asc' },
      include: VISIT_INCLUDE,
    });
  }

  async findToday(tenantId: string, visitorId: string) {
    return this.findAll(tenantId, {
      date: new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10),
      visitorId,
    });
  }

  async findById(id: string, tenantId: string) {
    const visit = await this.prisma.homeVisit.findFirst({
      where: { id, tenantId },
      include: VISIT_INCLUDE,
    });
    if (!visit) throw new NotFoundException('Tashrif topilmadi');
    return visit;
  }

  async update(id: string, tenantId: string, data: Partial<{
    scheduledFor: Date;
    homeAddress: string;
    homeLatitude: number;
    homeLongitude: number;
    outcome: string;
    notes: string;
    followUpDate: Date;
    followUpReason: string;
  }>) {
    await this.findById(id, tenantId);
    return this.prisma.homeVisit.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
      include: VISIT_INCLUDE,
    });
  }

  async cancel(id: string, tenantId: string, cancelReason: string) {
    const visit = await this.findById(id, tenantId);
    if (visit.status === 'completed' || visit.status === 'cancelled') {
      throw new BadRequestException('Bu tashrif allaqachon yakunlangan yoki bekor qilingan');
    }
    return this.prisma.homeVisit.update({
      where: { id },
      data: { status: 'cancelled', cancelReason, cancelledAt: new Date() },
      include: VISIT_INCLUDE,
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async checkin(
    id: string,
    tenantId: string,
    coords: {
      latitude: number;
      longitude: number;
      accuracy: number;
    },
  ) {
    const visit = await this.findById(id, tenantId);

    if (coords.accuracy > 50) {
      throw new BadRequestException(
        `GPS aniqligi yetarli emas (${Math.round(coords.accuracy)}m). 50m dan kam bo'lishi kerak.`,
      );
    }

    let distance: number | undefined;
    let isSuspicious = false;

    if (visit.homeLatitude && visit.homeLongitude) {
      distance = haversineMetres(
        visit.homeLatitude, visit.homeLongitude,
        coords.latitude, coords.longitude,
      );
      isSuspicious = distance > 200;
    }

    const updated = await this.prisma.homeVisit.update({
      where: { id },
      data: {
        status: 'in_progress',
        startedAt: new Date(),
        checkinLatitude: coords.latitude,
        checkinLongitude: coords.longitude,
        checkinAccuracy: coords.accuracy,
        checkinDistance: distance,
      },
      include: VISIT_INCLUDE,
    });

    if (isSuspicious) {
      await this.prisma.visitIssue.create({
        data: {
          visitId: id,
          category: 'gps_anomaly',
          severity: 'medium',
          description: `Check-in ${Math.round(distance!)}m uzoqda (uy manzilidan)`,
        },
      });
    }

    return { ...updated, suspicious: isSuspicious, distance };
  }

  async addPhoto(
    id: string,
    tenantId: string,
    data: {
      category: string;
      s3Key: string;
      thumbnailKey: string;
      caption?: string;
      geoLatitude?: number;
      geoLongitude?: number;
    },
  ) {
    await this.findById(id, tenantId);
    return this.prisma.visitPhoto.create({ data: { visitId: id, ...data } });
  }

  async setChecklist(
    id: string,
    tenantId: string,
    items: Array<{
      templateKey: string;
      label: string;
      status: string;
      notes?: string;
      evidence?: string;
    }>,
  ) {
    await this.findById(id, tenantId);
    // Upsert by templateKey
    for (const item of items) {
      await this.prisma.visitChecklistItem.upsert({
        where: { id: `${id}:${item.templateKey}` },
        create: { id: `${id}:${item.templateKey}`, visitId: id, ...item },
        update: { status: item.status, notes: item.notes, evidence: item.evidence },
      });
    }
    return this.prisma.visitChecklistItem.findMany({ where: { visitId: id } });
  }

  async addIssue(
    id: string,
    tenantId: string,
    data: {
      category: string;
      severity: string;
      description: string;
    },
  ) {
    await this.findById(id, tenantId);
    return this.prisma.visitIssue.create({ data: { visitId: id, ...data } });
  }

  async addActionItem(
    id: string,
    tenantId: string,
    data: {
      description: string;
      priority: string;
      assigneeId?: string;
      dueDate?: Date;
      generatedBy?: string;
    },
  ) {
    await this.findById(id, tenantId);
    return this.prisma.visitActionItem.create({
      data: { visitId: id, generatedBy: data.generatedBy ?? 'user', ...data },
    });
  }

  async addNotes(id: string, tenantId: string, notes: string) {
    await this.findById(id, tenantId);
    return this.prisma.homeVisit.update({
      where: { id },
      data: { notes },
      include: VISIT_INCLUDE,
    });
  }

  async parentSignature(id: string, tenantId: string, pin: string) {
    await this.findById(id, tenantId);
    const hashedPin = await bcrypt.hash(pin, 10);
    return this.prisma.homeVisit.update({
      where: { id },
      data: { parentPin: hashedPin, parentSignedAt: new Date() },
      include: VISIT_INCLUDE,
    });
  }

  async complete(
    id: string,
    tenantId: string,
    outcome: string,
    notes?: string,
  ) {
    const visit = await this.findById(id, tenantId);
    if (visit.status === 'completed') {
      throw new BadRequestException('Tashrif allaqachon yakunlangan');
    }

    const durationMin = visit.startedAt
      ? Math.round((Date.now() - visit.startedAt.getTime()) / 60_000)
      : undefined;

    return this.prisma.homeVisit.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        outcome,
        notes: notes ?? visit.notes,
        durationMin,
      },
      include: VISIT_INCLUDE,
    });
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  async getStudentHistory(studentId: string, tenantId: string) {
    return this.prisma.homeVisit.findMany({
      where: { studentId, tenantId },
      orderBy: { scheduledFor: 'desc' },
      include: VISIT_INCLUDE,
    });
  }

  async getStats(
    tenantId: string,
    from: Date,
    to: Date,
  ) {
    const [total, completed, cancelled, noShow] = await Promise.all([
      this.prisma.homeVisit.count({ where: { tenantId, scheduledFor: { gte: from, lte: to } } }),
      this.prisma.homeVisit.count({ where: { tenantId, status: 'completed', scheduledFor: { gte: from, lte: to } } }),
      this.prisma.homeVisit.count({ where: { tenantId, status: 'cancelled', scheduledFor: { gte: from, lte: to } } }),
      this.prisma.homeVisit.count({ where: { tenantId, status: 'no_show', scheduledFor: { gte: from, lte: to } } }),
    ]);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, cancelled, noShow, completionRate };
  }

  async getBranchCoverage(branchId: string, tenantId: string) {
    const [totalStudents, visitedStudents] = await Promise.all([
      this.prisma.user.count({ where: { branchId, tenantId, role: 'student', status: { not: 'inactive' } } }),
      this.prisma.homeVisit.groupBy({
        by: ['studentId'],
        where: { branchId, tenantId, status: 'completed' },
      }),
    ]);
    const visited = visitedStudents.length;
    const coveragePct = totalStudents > 0 ? Math.round((visited / totalStudents) * 100) : 0;
    return { totalStudents, visited, coveragePct };
  }
}
