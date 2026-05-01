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

  /**
   * 25.C.4: Build a single-elimination bracket from current registrations.
   * Each match is a pair (or single-bye) at the lowest round; subsequent
   * rounds are blank placeholders. Stable order is by registeredAt.
   */
  async getBracket(tournamentId: string) {
    const regs = await this.prisma.tournamentRegistration.findMany({
      where: { tournamentId },
      include: { student: { select: { id: true, name: true } } },
      orderBy: { registeredAt: 'asc' },
    });

    const players = regs.map((r) => ({
      id: r.student.id,
      name: r.student.name,
    }));

    type Player = { id: string; name: string } | null;
    type Match = { matchId: string; a: Player; b: Player };

    const round1: Match[] = [];
    for (let i = 0; i < players.length; i += 2) {
      round1.push({
        matchId: `r1-${i / 2 + 1}`,
        a: players[i] ?? null,
        b: players[i + 1] ?? null,
      });
    }

    const rounds: Match[][] = [round1];
    let prev = round1.length;
    let r = 2;
    while (prev > 1) {
      const next = Math.ceil(prev / 2);
      const round: Match[] = [];
      for (let i = 0; i < next; i += 1) {
        round.push({ matchId: `r${r}-${i + 1}`, a: null, b: null });
      }
      rounds.push(round);
      prev = next;
      r += 1;
    }

    return { tournamentId, players, rounds };
  }
}
