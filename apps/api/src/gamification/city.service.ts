import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CITY_LEVELS = [
  { min: 0, max: 100, level: 1, buildings: ['tent'] },
  { min: 101, max: 300, level: 2, buildings: ['tent', 'house'] },
  { min: 301, max: 600, level: 3, buildings: ['tent', 'house', 'shop'] },
  { min: 601, max: 1000, level: 4, buildings: ['tent', 'house', 'shop', 'school'] },
  { min: 1001, max: Infinity, level: 5, buildings: ['tent', 'house', 'shop', 'school', 'castle'] },
] as const;

@Injectable()
export class CityService {
  constructor(private prisma: PrismaService) {}

  async getCityLevel(studentId: string): Promise<{
    level: number;
    lessonsCompleted: number;
    nextLevelAt: number;
    buildings: string[];
  }> {
    const xpRecord = await this.prisma.studentXp.findUnique({ where: { studentId } });
    const totalXp = xpRecord?.totalXp ?? 0;

    const lessonsCompleted = await this.prisma.studentProgress.count({
      where: { studentId, academyCompleted: true },
    });

    const current = CITY_LEVELS.find((l) => totalXp >= l.min && totalXp <= l.max) ?? CITY_LEVELS[CITY_LEVELS.length - 1];
    const nextLevel = CITY_LEVELS.find((l) => l.level === current.level + 1);
    const nextLevelAt = nextLevel ? nextLevel.min : current.min;

    return {
      level: current.level,
      lessonsCompleted,
      nextLevelAt,
      buildings: [...current.buildings],
    };
  }
}
