import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AttendanceStudentsService } from './attendance-students.service';
import { AttendanceStaffService } from './attendance-staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

const mockAnalytics = { logEvent: jest.fn().mockResolvedValue(undefined) };
const mockEvents = { emit: jest.fn() };

const mockPrismaStudents = {
  attendanceStudent: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockPrismaStaff = {
  attendanceStaff: {
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('AttendanceStudentsService', () => {
  let service: AttendanceStudentsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AttendanceStudentsService,
        { provide: PrismaService, useValue: mockPrismaStudents },
        { provide: AnalyticsService, useValue: mockAnalytics },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();
    service = module.get(AttendanceStudentsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('markBulk', () => {
    it('upserts one record per student and returns results array', async () => {
      const records = [
        {
          studentId: 'u1',
          status: 'present',
          tenantId: 't1',
          branchId: 'b1',
          date: '2026-04-25',
        },
        {
          studentId: 'u2',
          status: 'absent',
          tenantId: 't1',
          branchId: 'b1',
          date: '2026-04-25',
        },
      ];
      mockPrismaStudents.attendanceStudent.upsert
        .mockResolvedValueOnce({ id: 'a1', studentId: 'u1', status: 'present' })
        .mockResolvedValueOnce({ id: 'a2', studentId: 'u2', status: 'absent' });

      const result = await service.markBulk(records);

      expect(mockPrismaStudents.attendanceStudent.upsert).toHaveBeenCalledTimes(
        2,
      );
      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('present');
      expect(result[1].status).toBe('absent');
    });

    it('returns empty array when given empty records list', async () => {
      const result = await service.markBulk([]);

      expect(
        mockPrismaStudents.attendanceStudent.upsert,
      ).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });

  describe('getDailyList', () => {
    it('returns attendance records filtered by branchId and date', async () => {
      const attendance = [
        {
          id: 'a1',
          studentId: 'u1',
          status: 'present',
          student: { id: 'u1', name: 'Ali Valiyev' },
        },
      ];
      mockPrismaStudents.attendanceStudent.findMany.mockResolvedValue(
        attendance,
      );

      const result = await service.getDailyList('b1', '2026-04-25');

      expect(
        mockPrismaStudents.attendanceStudent.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: 'b1', date: new Date('2026-04-25') },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0].student.name).toBe('Ali Valiyev');
    });
  });
});

describe('AttendanceStaffService', () => {
  let service: AttendanceStaffService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AttendanceStaffService,
        { provide: PrismaService, useValue: mockPrismaStaff },
      ],
    }).compile();
    service = module.get(AttendanceStaffService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('checkIn', () => {
    it('marks isLate true when checking in after 09:00 UTC', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-25T09:30:00Z'));
      mockPrismaStaff.attendanceStaff.upsert.mockResolvedValue({
        id: 'att1',
        userId: 'u1',
        isLate: true,
        loginTime: new Date('2026-04-25T09:30:00Z'),
      });

      const result = await service.checkIn('u1', 't1', 'b1', 'manual');

      expect(result.isLate).toBe(true);
      jest.useRealTimers();
    });

    it('marks isLate false when checking in before 09:00 UTC', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-04-25T08:00:00Z'));
      mockPrismaStaff.attendanceStaff.upsert.mockResolvedValue({
        id: 'att2',
        userId: 'u1',
        isLate: false,
        loginTime: new Date('2026-04-25T08:00:00Z'),
      });

      const result = await service.checkIn('u1', 't1', 'b1', 'face_id');

      expect(result.isLate).toBe(false);
      jest.useRealTimers();
    });
  });

  describe('confirm', () => {
    it('updates confirmedAt and confirmedBy for the given userId and date', async () => {
      const confirmedAt = new Date('2026-04-25T09:05:00Z');
      mockPrismaStaff.attendanceStaff.update.mockResolvedValue({
        id: 'att1',
        userId: 'u1',
        confirmedAt,
        confirmedBy: 'admin1',
      });

      const result = await service.confirm('u1', 'admin1', '2026-04-25');

      expect(mockPrismaStaff.attendanceStaff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_date: { userId: 'u1', date: new Date('2026-04-25') },
          },
          data: expect.objectContaining({ confirmedBy: 'admin1' }),
        }),
      );
      expect(result.confirmedBy).toBe('admin1');
      expect(result.confirmedAt).toEqual(confirmedAt);
    });
  });
});
