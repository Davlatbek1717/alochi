import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LessonsService } from './lessons.service';
import { PrismaService } from '../prisma/prisma.service';
import { I18nService } from '../i18n/i18n.service';
import { translateError } from '../i18n/errors';

const mockI18n = { t: (key: string) => translateError(key as any) };
const mockCache = {
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  lesson: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  studentProgress: {
    findMany: jest.fn(),
  },
};

describe('LessonsService', () => {
  let service: LessonsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LessonsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: mockI18n },
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();
    service = module.get(LessonsService);
  });

  afterEach(() => jest.clearAllMocks());

  const baseDto = {
    tenantId: 'tenant-1',
    title: 'Present Simple',
    type: 'english' as any,
    orderNumber: 1,
    youtubeUrl: 'https://youtu.be/abc',
    nRepetitions: 3,
  };

  describe('create', () => {
    it('creates and returns a lesson when orderNumber is unique', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);
      mockPrisma.lesson.create.mockResolvedValue({
        id: 'lesson-1',
        ...baseDto,
      });

      const result = await service.create(baseDto, 'tenant-test');

      expect(mockPrisma.lesson.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: 'Present Simple' }),
        }),
      );
      expect(result.id).toBe('lesson-1');
    });

    it('throws ConflictException when orderNumber already exists in tenant', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.create(baseDto, 'tenant-test')).rejects.toThrow(
        ConflictException,
      );
    });

    it('stores component flags derived from dto booleans', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);
      mockPrisma.lesson.create.mockResolvedValue({ id: 'lesson-2' });

      await service.create(
        {
          ...baseDto,
          mcqEnabled: true,
          wordOrderEnabled: true,
        },
        'tenant-test',
      );

      const callArg = mockPrisma.lesson.create.mock.calls[0][0];
      expect(callArg.data.components.mcq).toBe(true);
      expect(callArg.data.components.word_order).toBe(true);
      expect(callArg.data.components.ai_tutor).toBe(false);
    });

    it('enables ai_tutor component when aiTutorEnabled is true', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);
      mockPrisma.lesson.create.mockResolvedValue({ id: 'lesson-3' });

      await service.create({ ...baseDto, aiTutorEnabled: true }, 'tenant-test');

      const callArg = mockPrisma.lesson.create.mock.calls[0][0];
      expect(callArg.data.components.ai_tutor).toBe(true);
    });
  });

  describe('findByTenant', () => {
    it('returns lessons ordered by orderNumber', async () => {
      const lessons = [
        { id: 'l1', orderNumber: 1 },
        { id: 'l2', orderNumber: 2 },
      ];
      mockPrisma.lesson.findMany.mockResolvedValue(lessons);

      const result = await service.findByTenant('tenant-1');

      expect(mockPrisma.lesson.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId: 'tenant-1' } }),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('publish', () => {
    it('sets isPublished to true', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue({
        id: 'lesson-1',
        tenantId: 'tenant-1',
      });
      mockPrisma.lesson.update.mockResolvedValue({
        id: 'lesson-1',
        isPublished: true,
      });

      const result = await service.publish('lesson-1', 'tenant-1');

      expect(mockPrisma.lesson.update).toHaveBeenCalledWith({
        where: { id: 'lesson-1' },
        data: { isPublished: true },
      });
      expect(result.isPublished).toBe(true);
    });

    it('throws NotFoundException when lesson does not exist', async () => {
      mockPrisma.lesson.findFirst.mockResolvedValue(null);

      await expect(service.publish('no-lesson', 'tenant-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
