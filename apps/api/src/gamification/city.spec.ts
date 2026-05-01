import { Test } from '@nestjs/testing';
import { CityService } from './city.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeedEventService } from '../social/feed-event.service';

const mockPrisma = {
  studentBuilding: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
};

const mockFeedEvent = { emit: jest.fn().mockResolvedValue(undefined) };

describe('CityService', () => {
  let service: CityService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CityService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FeedEventService, useValue: mockFeedEvent },
      ],
    }).compile();
    service = module.get(CityService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('addBuildingForLesson', () => {
    it('returns existing row without creating a duplicate (idempotent on lessonId)', async () => {
      const existing = {
        id: 'b1',
        studentId: 's1',
        type: 'house',
        tier: 1,
        index: 0,
        lessonId: 'l1',
        unlockedAt: new Date(),
      };
      mockPrisma.studentBuilding.findUnique.mockResolvedValue(existing);

      const result = await service.addBuildingForLesson('s1', 't1', 'l1');

      expect(result).toBe(existing);
      expect(mockPrisma.studentBuilding.create).not.toHaveBeenCalled();
    });

    it('creates the first Qishloq building (house) for a brand-new student', async () => {
      mockPrisma.studentBuilding.findUnique.mockResolvedValue(null);
      mockPrisma.studentBuilding.count
        .mockResolvedValueOnce(0) // total count
        .mockResolvedValueOnce(0); // tier count
      mockPrisma.studentBuilding.create.mockResolvedValue({
        id: 'b1',
        studentId: 's1',
        type: 'house',
        tier: 1,
        index: 0,
        lessonId: 'l1',
        unlockedAt: new Date(),
      });

      const result = await service.addBuildingForLesson('s1', 't1', 'l1');

      expect(mockPrisma.studentBuilding.create).toHaveBeenCalledWith({
        data: {
          studentId: 's1',
          type: 'house',
          tier: 1,
          index: 0,
          lessonId: 'l1',
        },
      });
      expect(result.type).toBe('house');
      // No tier-upgrade emit on the very first building.
      expect(mockFeedEvent.emit).not.toHaveBeenCalled();
    });

    it('cycles through the tier 1 pool: house → road → tree → well → fence → house', async () => {
      // For the 6th building (index 5) within tier 1 the pool wraps.
      mockPrisma.studentBuilding.findUnique.mockResolvedValue(null);
      mockPrisma.studentBuilding.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(5); // tier
      mockPrisma.studentBuilding.create.mockResolvedValue({
        id: 'b6',
        studentId: 's1',
        type: 'house',
        tier: 1,
        index: 5,
        lessonId: 'l6',
        unlockedAt: new Date(),
      });

      const result = await service.addBuildingForLesson('s1', 't1', 'l6');

      expect(result.type).toBe('house');
      expect(mockPrisma.studentBuilding.create).toHaveBeenCalledWith({
        data: {
          studentId: 's1',
          type: 'house',
          tier: 1,
          index: 5,
          lessonId: 'l6',
        },
      });
    });

    it('switches to Shaharcha pool on the 51st building and emits city_upgraded', async () => {
      mockPrisma.studentBuilding.findUnique.mockResolvedValue(null);
      mockPrisma.studentBuilding.count
        .mockResolvedValueOnce(50) // total — next is 51
        .mockResolvedValueOnce(0); // first of tier 2
      mockPrisma.studentBuilding.create.mockResolvedValue({
        id: 'b51',
        studentId: 's1',
        type: 'school',
        tier: 2,
        index: 50,
        lessonId: 'l51',
        unlockedAt: new Date(),
      });

      await service.addBuildingForLesson('s1', 't1', 'l51');

      expect(mockPrisma.studentBuilding.create).toHaveBeenCalledWith({
        data: {
          studentId: 's1',
          type: 'school',
          tier: 2,
          index: 50,
          lessonId: 'l51',
        },
      });
      expect(mockFeedEvent.emit).toHaveBeenCalledWith(
        't1',
        's1',
        'city_upgraded',
        { toLevel: 2, name: 'Shaharcha' },
      );
    });

    it('switches to Megapolis pool past lesson 500', async () => {
      mockPrisma.studentBuilding.findUnique.mockResolvedValue(null);
      mockPrisma.studentBuilding.count
        .mockResolvedValueOnce(500) // total — next is 501
        .mockResolvedValueOnce(0);
      mockPrisma.studentBuilding.create.mockResolvedValue({
        id: 'bX',
        studentId: 's1',
        type: 'skyscraper',
        tier: 5,
        index: 500,
        lessonId: 'l501',
        unlockedAt: new Date(),
      });

      const result = await service.addBuildingForLesson('s1', 't1', 'l501');

      expect(result.type).toBe('skyscraper');
      expect(result.tier).toBe(5);
    });
  });

  describe('getCity', () => {
    it('returns empty list + Qishloq tier for a new student', async () => {
      mockPrisma.studentBuilding.findMany.mockResolvedValue([]);

      const city = await service.getCity('s1');

      expect(city.buildings).toEqual([]);
      expect(city.tier).toEqual({ level: 1, name: 'Qishloq' });
      expect(city.lessonsCompleted).toBe(0);
      expect(city.nextTierAt).toBe(51);
      // back-compat
      expect(city.level).toBe(1);
      expect(city.name).toBe('Qishloq');
      expect(city.nextLevelAt).toBe(51);
    });

    it('marks the last building as isNewest', async () => {
      const now = new Date('2024-01-01T00:00:00Z');
      mockPrisma.studentBuilding.findMany.mockResolvedValue([
        { id: 'b1', type: 'house', tier: 1, index: 0, unlockedAt: now },
        { id: 'b2', type: 'road', tier: 1, index: 1, unlockedAt: now },
        { id: 'b3', type: 'tree', tier: 1, index: 2, unlockedAt: now },
      ]);

      const city = await service.getCity('s1');

      expect(city.buildings).toHaveLength(3);
      expect(city.buildings[0].isNewest).toBe(false);
      expect(city.buildings[1].isNewest).toBe(false);
      expect(city.buildings[2].isNewest).toBe(true);
      expect(city.lessonsCompleted).toBe(3);
    });

    it('reports Shaharcha when student has 51 buildings', async () => {
      const buildings = Array.from({ length: 51 }, (_, i) => ({
        id: `b${i}`,
        type: i < 50 ? 'house' : 'school',
        tier: i < 50 ? 1 : 2,
        index: i,
        unlockedAt: new Date(),
      }));
      mockPrisma.studentBuilding.findMany.mockResolvedValue(buildings);

      const city = await service.getCity('s1');

      expect(city.tier).toEqual({ level: 2, name: 'Shaharcha' });
      expect(city.nextTierAt).toBe(151);
    });
  });

  describe('getCityLevel (back-compat)', () => {
    it('returns the legacy shape with building type strings', async () => {
      mockPrisma.studentBuilding.findMany.mockResolvedValue([
        { id: 'b1', type: 'house', tier: 1, index: 0, unlockedAt: new Date() },
        { id: 'b2', type: 'road', tier: 1, index: 1, unlockedAt: new Date() },
      ]);

      const legacy = await service.getCityLevel('s1');

      expect(legacy).toEqual({
        level: 1,
        name: 'Qishloq',
        lessonsCompleted: 2,
        nextLevelAt: 51,
        buildings: ['house', 'road'],
      });
    });
  });
});
