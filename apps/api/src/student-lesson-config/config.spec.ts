import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StudentConfigService } from './config.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  lesson: {
    findFirst: jest.fn(),
  },
  studentLessonConfig: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  kpiOverrideLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('StudentConfigService', () => {
  let service: StudentConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StudentConfigService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(StudentConfigService);
  });

  afterEach(() => jest.clearAllMocks());

  const baseDto = {
    studentId: 's-1',
    lessonId: 'l-1',
    tenantId: 't-1',
    managerId: 'm-1',
    nRepetitions: 5,
  };

  describe('setNOverride', () => {
    it('saves config when nRepetitions is within valid range', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({
        id: 'l-1',
        maxNOverride: 10,
      });
      mockPrisma.studentLessonConfig.findUnique.mockResolvedValue(null);
      mockPrisma.studentLessonConfig.upsert.mockResolvedValue({
        nRepetitionsOverride: 5,
      });
      mockPrisma.kpiOverrideLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.setNOverride(baseDto);

      expect(mockPrisma.studentLessonConfig.upsert).toHaveBeenCalled();
      expect(result.nRepetitionsOverride).toBe(5);
    });

    it('writes a kpiOverrideLog row capturing previous N (Phase 20.9)', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({
        id: 'l-1',
        maxNOverride: 10,
      });
      mockPrisma.studentLessonConfig.findUnique.mockResolvedValue({
        nRepetitionsOverride: 3,
      });
      mockPrisma.studentLessonConfig.upsert.mockResolvedValue({
        nRepetitionsOverride: 5,
      });
      mockPrisma.kpiOverrideLog.create.mockResolvedValue({ id: 'log-1' });

      await service.setNOverride({ ...baseDto, reason: 'too easy' });

      expect(mockPrisma.kpiOverrideLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          studentId: 's-1',
          lessonId: 'l-1',
          oldN: 3,
          newN: 5,
          changedBy: 'm-1',
          reason: 'too easy',
        }),
      });
    });

    it('throws BadRequestException when nRepetitions is below 1', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({
        id: 'l-1',
        maxNOverride: 10,
      });

      await expect(
        service.setNOverride({ ...baseDto, nRepetitions: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when nRepetitions exceeds maxNOverride', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({
        id: 'l-1',
        maxNOverride: 10,
      });

      await expect(
        service.setNOverride({ ...baseDto, nRepetitions: 15 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);

      await expect(service.setNOverride(baseDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStudentConfigs', () => {
    it('returns all configs for a student', async () => {
      const configs = [{ lessonId: 'l-1', nRepetitionsOverride: 5 }];
      mockPrisma.studentLessonConfig.findMany.mockResolvedValue(configs);

      const result = await service.getStudentConfigs('s-1');

      expect(mockPrisma.studentLessonConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's-1' } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getOverrideHistory', () => {
    it('returns override history for student/lesson pair', async () => {
      const rows = [{ id: 'log-1', oldN: 3, newN: 5 }];
      mockPrisma.kpiOverrideLog.findMany.mockResolvedValue(rows);

      const result = await service.getOverrideHistory('s-1', 'l-1');

      expect(mockPrisma.kpiOverrideLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 's-1', lessonId: 'l-1' },
        }),
      );
      expect(result).toHaveLength(1);
    });
  });
});
