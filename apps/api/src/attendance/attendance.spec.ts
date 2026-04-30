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
    create: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  branch: {
    findUnique: jest.fn(),
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
    beforeEach(() => {
      mockPrismaStaff.attendanceStaff.findFirst.mockResolvedValue(null);
    });

    it('marks isLate true and computes lateMinutes after workStart+grace', async () => {
      // Branch starts 09:00 with 5min grace; check-in at 09:30 local → 25min late.
      const now = new Date(2026, 3, 25, 9, 30, 0);
      jest.useFakeTimers().setSystemTime(now);
      mockPrismaStaff.branch.findUnique.mockResolvedValue({
        id: 'b1',
        workStartTime: '09:00',
        lateGraceMinutes: 5,
      });
      mockPrismaStaff.attendanceStaff.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'att1', ...data }),
      );

      const result = await service.checkIn('u1', 't1', 'b1', 'manual');

      expect(result.isLate).toBe(true);
      expect(result.lateMinutes).toBe(25);
      jest.useRealTimers();
    });

    it('marks isLate false and lateMinutes 0 when within grace window', async () => {
      // Branch starts 09:00 with 10min grace; check-in at 09:05 local → not late.
      const now = new Date(2026, 3, 25, 9, 5, 0);
      jest.useFakeTimers().setSystemTime(now);
      mockPrismaStaff.branch.findUnique.mockResolvedValue({
        id: 'b1',
        workStartTime: '09:00',
        lateGraceMinutes: 10,
      });
      mockPrismaStaff.attendanceStaff.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'att2', ...data }),
      );

      const result = await service.checkIn('u1', 't1', 'b1', 'face_id');

      expect(result.isLate).toBe(false);
      expect(result.lateMinutes).toBe(0);
      jest.useRealTimers();
    });

    it('uses each branch own workStartTime — three branches, three lateMinutes', async () => {
      const now = new Date(2026, 3, 25, 10, 0, 0);
      jest.useFakeTimers().setSystemTime(now);
      mockPrismaStaff.attendanceStaff.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'a', ...data }),
      );

      // Branch A: 08:00 start, 0 grace → 120 minutes late
      mockPrismaStaff.branch.findUnique.mockResolvedValueOnce({
        id: 'A',
        workStartTime: '08:00',
        lateGraceMinutes: 0,
      });
      const a = await service.checkIn('u1', 't1', 'A', 'manual');
      expect(a.lateMinutes).toBe(120);

      // Branch B: 09:30 start, 15 grace → 15 minutes late
      mockPrismaStaff.branch.findUnique.mockResolvedValueOnce({
        id: 'B',
        workStartTime: '09:30',
        lateGraceMinutes: 15,
      });
      const b = await service.checkIn('u2', 't1', 'B', 'manual');
      expect(b.lateMinutes).toBe(15);

      // Branch C: 10:30 start, 5 grace → not late (negative clamps to 0)
      mockPrismaStaff.branch.findUnique.mockResolvedValueOnce({
        id: 'C',
        workStartTime: '10:30',
        lateGraceMinutes: 5,
      });
      const c = await service.checkIn('u3', 't1', 'C', 'manual');
      expect(c.lateMinutes).toBe(0);
      expect(c.isLate).toBe(false);

      jest.useRealTimers();
    });

    it('throws ConflictException when a record already exists for today', async () => {
      const now = new Date(2026, 3, 25, 9, 30, 0);
      jest.useFakeTimers().setSystemTime(now);
      mockPrismaStaff.branch.findUnique.mockResolvedValue({
        id: 'b1',
        workStartTime: '09:00',
        lateGraceMinutes: 5,
      });
      mockPrismaStaff.attendanceStaff.findFirst.mockResolvedValue({
        id: 'existing',
        loginTime: new Date(2026, 3, 25, 9, 0, 0),
      });

      await expect(
        service.checkIn('u1', 't1', 'b1', 'face_auto'),
      ).rejects.toMatchObject({ status: 409 });
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
