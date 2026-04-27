import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CITY_LEVELS = [
  {
    min: 0, max: 50, level: 1, name: 'Qishloq',
    buildings: ['uy', 'kocha', 'daraxt'],
  },
  {
    min: 51, max: 150, level: 2, name: 'Shaharcha',
    buildings: ['uy', 'kocha', 'daraxt', 'maktab', 'dokon', 'park'],
  },
  {
    min: 151, max: 300, level: 3, name: 'Shahar',
    buildings: ['uy', 'kocha', 'daraxt', 'maktab', 'dokon', 'park', 'kutubxona', 'teatr', 'maydon'],
  },
  {
    min: 301, max: 500, level: 4, name: 'Metropolis',
    buildings: ['uy', 'kocha', 'daraxt', 'maktab', 'dokon', 'park', 'kutubxona', 'teatr', 'maydon', 'aeroporti', 'universitet', 'minora'],
  },
  {
    min: 501, max: Infinity, level: 5, name: 'Megapolis',
    buildings: ['uy', 'kocha', 'daraxt', 'maktab', 'dokon', 'park', 'kutubxona', 'teatr', 'maydon', 'aeroporti', 'universitet', 'minora'],
  },
] as const;

@Injectable()
export class CityService {
  constructor(private prisma: PrismaService) {}

  async getCityLevel(studentId: string): Promise<{
    level: number;
    name: string;
    lessonsCompleted: number;
    nextLevelAt: number | null;
    buildings: string[];
  }> {
    const lessonsCompleted = await this.prisma.studentProgress.count({
      where: { studentId, academyCompleted: true },
    });

    const current = CITY_LEVELS.find((l) => lessonsCompleted >= l.min && lessonsCompleted <= l.max)
      ?? CITY_LEVELS[CITY_LEVELS.length - 1];
    const nextLevel = CITY_LEVELS.find((l) => l.level === current.level + 1);
    const nextLevelAt = nextLevel ? nextLevel.min : null;

    return {
      level: current.level,
      name: current.name,
      lessonsCompleted,
      nextLevelAt,
      buildings: [...current.buildings],
    };
  }
}
