import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LetterCollectionService {
  private readonly logger = new Logger(LetterCollectionService.name);

  constructor(private prisma: PrismaService) {}

  async listAll() {
    return this.prisma.letter.findMany({ orderBy: { char: 'asc' } });
  }

  async listOwned(studentId: string) {
    const all = await this.prisma.letter.findMany({
      orderBy: { char: 'asc' },
    });
    const owned = await this.prisma.studentLetter.findMany({
      where: { studentId },
      select: { letterId: true, earnedAt: true },
    });
    const ownedMap = new Map(owned.map((o) => [o.letterId, o.earnedAt]));
    return all.map((letter) => ({
      ...letter,
      owned: ownedMap.has(letter.id),
      earnedAt: ownedMap.get(letter.id) ?? null,
    }));
  }

  /**
   * Award a random unowned letter to the student.
   * Returns the letter (or null if all 36 already owned).
   */
  async awardRandom(studentId: string) {
    const owned = await this.prisma.studentLetter.findMany({
      where: { studentId },
      select: { letterId: true },
    });
    const ownedIds = new Set(owned.map((o) => o.letterId));

    const all = await this.prisma.letter.findMany({ select: { id: true } });
    const candidates = all.filter((l) => !ownedIds.has(l.id));
    if (candidates.length === 0) return null;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    try {
      await this.prisma.studentLetter.create({
        data: { studentId, letterId: pick.id },
      });
    } catch (e) {
      this.logger.warn(`awardRandom skip duplicate: ${(e as Error).message}`);
      return null;
    }
    const fresh = await this.prisma.letter.findUnique({
      where: { id: pick.id },
    });
    return fresh;
  }
}
