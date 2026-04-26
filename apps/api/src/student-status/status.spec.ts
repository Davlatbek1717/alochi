import { Test } from '@nestjs/testing';
import { StatusService } from './status.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  studentStatus: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('StatusService', () => {
  let service: StatusService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StatusService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(StatusService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('setStatus', () => {
    it('upserts a status record and returns it', async () => {
      const record = {
        id: 's1',
        studentId: 'u1',
        date: new Date('2026-04-25'),
        englishStatus: 'yashil',
        personalStatus: null,
        criticalStatus: null,
      };
      mockPrisma.studentStatus.upsert.mockResolvedValue(record);

      const result = await service.setStatus({
        tenantId: 't1',
        studentId: 'u1',
        date: '2026-04-25',
        englishStatus: 'yashil',
      });

      expect(mockPrisma.studentStatus.upsert).toHaveBeenCalledTimes(1);
      expect(result.englishStatus).toBe('yashil');
    });
  });

  describe('getLatest', () => {
    it('returns the most recent status record for a student', async () => {
      const record = {
        id: 's1',
        studentId: 'u1',
        date: new Date('2026-04-25'),
        criticalStatus: 'qizil',
      };
      mockPrisma.studentStatus.findFirst.mockResolvedValue(record);

      const result = await service.getLatest('u1');

      expect(mockPrisma.studentStatus.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 'u1' },
          orderBy: { date: 'desc' },
        }),
      );
      expect(result?.criticalStatus).toBe('qizil');
    });

    it('returns null when student has no status records', async () => {
      mockPrisma.studentStatus.findFirst.mockResolvedValue(null);
      const result = await service.getLatest('u-none');
      expect(result).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('returns up to 30 status records ordered by date desc', async () => {
      const records = Array.from({ length: 5 }, (_, i) => ({
        id: `s${i}`,
        studentId: 'u1',
        date: new Date(),
      }));
      mockPrisma.studentStatus.findMany.mockResolvedValue(records);

      const result = await service.getHistory('u1');

      expect(mockPrisma.studentStatus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 'u1' },
          take: 30,
        }),
      );
      expect(result).toHaveLength(5);
    });
  });

  describe('getRedStudents', () => {
    it('returns students whose latest record has at least one qizil status', async () => {
      const redStudents = [
        {
          id: 's1',
          studentId: 'u1',
          criticalStatus: 'qizil',
          englishStatus: 'yashil',
          personalStatus: 'sariq',
          student: { id: 'u1', name: 'Ali Valiyev' },
        },
      ];
      mockPrisma.studentStatus.findMany.mockResolvedValue(redStudents);

      const result = await service.getRedStudents('t1');

      expect(mockPrisma.studentStatus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: { tenantId: 't1' },
            OR: [
              { englishStatus: 'qizil' },
              { personalStatus: 'qizil' },
              { criticalStatus: 'qizil' },
            ],
          }),
          distinct: ['studentId'],
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].student.name).toBe('Ali Valiyev');
    });

    it('returns empty array when no students have qizil status', async () => {
      mockPrisma.studentStatus.findMany.mockResolvedValue([]);
      const result = await service.getRedStudents('t1');
      expect(result).toHaveLength(0);
    });
  });

  describe('getYellowStudents', () => {
    it('returns students whose latest record has at least one sariq status', async () => {
      const yellowStudents = [
        {
          id: 's2',
          studentId: 'u2',
          englishStatus: 'sariq',
          personalStatus: 'yashil',
          criticalStatus: 'yashil',
          student: { id: 'u2', name: 'Zulfiya Karimova' },
        },
      ];
      mockPrisma.studentStatus.findMany.mockResolvedValue(yellowStudents);

      const result = await service.getYellowStudents('t1');

      expect(mockPrisma.studentStatus.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: { tenantId: 't1' },
            OR: [
              { englishStatus: 'sariq' },
              { personalStatus: 'sariq' },
              { criticalStatus: 'sariq' },
            ],
          }),
          distinct: ['studentId'],
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].student.name).toBe('Zulfiya Karimova');
    });

    it('returns empty array when no students have sariq status', async () => {
      mockPrisma.studentStatus.findMany.mockResolvedValue([]);
      const result = await service.getYellowStudents('t1');
      expect(result).toHaveLength(0);
    });
  });
});
