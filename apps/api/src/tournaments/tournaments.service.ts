import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    return this.prisma.tournament.findMany({
      where: { tenantId, status: { in: ['upcoming', 'active'] } },
      orderBy: { startsAt: 'asc' },
      include: {
        _count: { select: { registrations: true } },
      },
    });
  }

  async create(
    tenantId: string,
    body: {
      title: string;
      type: string;
      startsAt: string;
      endsAt: string;
    },
  ) {
    return this.prisma.tournament.create({
      data: {
        tenantId,
        title: body.title,
        type: body.type,
        startsAt: new Date(body.startsAt),
        endsAt: new Date(body.endsAt),
      },
    });
  }

  async register(tournamentId: string, studentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });
    if (!tournament) throw new NotFoundException('Turnir topilmadi');

    return this.prisma.tournamentRegistration.upsert({
      where: { tournamentId_studentId: { tournamentId, studentId } },
      update: {},
      create: { tournamentId, studentId },
    });
  }

  async getRegistrations(tournamentId: string) {
    return this.prisma.tournamentRegistration.findMany({
      where: { tournamentId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { registeredAt: 'asc' },
    });
  }
}
