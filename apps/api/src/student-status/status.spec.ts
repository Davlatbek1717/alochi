import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole } from '@prisma/client';
import { StatusService } from './status.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  studentStatus: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  lesson: {
    count: jest.fn(),
  },
};

const mockEvents = { emit: jest.fn() };

describe('StatusService', () => {
  let service: StatusService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        StatusService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();
    service = module.get(StatusService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('setPersonalStatus', () => {
    const actor = {
      userId: 'mentor1',
      tenantId: 't1',
      role: UserRole.mentor,
    };

    it('upserts personalStatus and emits status.updated', async () => {
      mockPrisma.studentStatus.findUnique.mockResolvedValue(null);
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        personalStatus: 'sariq',
        englishStatus: null,
        criticalStatus: null,
      });

      await service.setPersonalStatus(actor, {
        studentId: 'u1',
        color: 'sariq',
        note: 'Bugun darsda',
      });

      expect(mockPrisma.studentStatus.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = mockPrisma.studentStatus.upsert.mock.calls[0][0];
      expect(upsertArg.create.personalStatus).toBe('sariq');
      // No auto-yellow when color != yashil → criticalStatus must NOT be set.
      expect(upsertArg.create.criticalStatus).toBeUndefined();
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'status.updated',
        expect.objectContaining({ studentId: 'u1' }),
      );
    });

    it('does NOT auto-set critical when only personal=yashil (english≠yashil)', async () => {
      mockPrisma.studentStatus.findUnique.mockResolvedValue({
        englishStatus: 'sariq',
        criticalStatus: 'sariq',
      });
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        personalStatus: 'yashil',
        englishStatus: 'sariq',
        criticalStatus: 'sariq',
      });

      await service.setPersonalStatus(actor, {
        studentId: 'u1',
        color: 'yashil',
      });

      const upsertArg = mockPrisma.studentStatus.upsert.mock.calls[0][0];
      expect(upsertArg.update.criticalStatus).toBeUndefined();
      // No notification.new emitted because no auto-flip occurred.
      const notifCalls = mockEvents.emit.mock.calls.filter(
        (c) => c[0] === 'notification.new',
      );
      expect(notifCalls).toHaveLength(0);
    });

    it('AUTO-flips critical to yashil when personal+english both yashil and prior critical≠yashil', async () => {
      mockPrisma.studentStatus.findUnique.mockResolvedValue({
        englishStatus: 'yashil',
        criticalStatus: 'sariq',
      });
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        personalStatus: 'yashil',
        englishStatus: 'yashil',
        criticalStatus: 'yashil',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        branchId: 'b1',
        tenantId: 't1',
      });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'manager1' });

      await service.setPersonalStatus(actor, {
        studentId: 'u1',
        color: 'yashil',
      });

      const upsertArg = mockPrisma.studentStatus.upsert.mock.calls[0][0];
      expect(upsertArg.update.criticalStatus).toBe('yashil');
      const notifCalls = mockEvents.emit.mock.calls.filter(
        (c) => c[0] === 'notification.new',
      );
      expect(notifCalls).toHaveLength(1);
      expect(notifCalls[0][1]).toMatchObject({
        userId: 'manager1',
        type: 'status.auto_green',
      });
    });

    it('does NOT auto-flip when prior critical was already yashil', async () => {
      mockPrisma.studentStatus.findUnique.mockResolvedValue({
        englishStatus: 'yashil',
        criticalStatus: 'yashil',
      });
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        personalStatus: 'yashil',
        englishStatus: 'yashil',
        criticalStatus: 'yashil',
      });

      await service.setPersonalStatus(actor, {
        studentId: 'u1',
        color: 'yashil',
      });

      const upsertArg = mockPrisma.studentStatus.upsert.mock.calls[0][0];
      expect(upsertArg.update.criticalStatus).toBeUndefined();
    });
  });

  describe('setCriticalStatus', () => {
    const actor = {
      userId: 'manager1',
      tenantId: 't1',
      role: UserRole.manager,
    };

    it('upserts critical and emits status.updated', async () => {
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        criticalStatus: 'qizil',
        personalStatus: null,
        englishStatus: null,
      });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'filadmin1' });

      await service.setCriticalStatus(actor, {
        studentId: 'u1',
        color: 'qizil',
      });

      expect(mockPrisma.studentStatus.upsert).toHaveBeenCalledTimes(1);
      const events = mockEvents.emit.mock.calls.map((c) => c[0]);
      expect(events).toContain('status.updated');
      expect(events).toContain('notification.new');
    });

    it('emits filadmin notification on sariq escalation', async () => {
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        criticalStatus: 'sariq',
        personalStatus: null,
        englishStatus: null,
      });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'filadmin1' });

      await service.setCriticalStatus(actor, {
        studentId: 'u1',
        color: 'sariq',
      });

      const notifCall = mockEvents.emit.mock.calls.find(
        (c) => c[0] === 'notification.new',
      );
      expect(notifCall).toBeDefined();
      expect(notifCall![1]).toMatchObject({
        userId: 'filadmin1',
        type: 'status.critical_escalation',
        color: 'sariq',
      });
    });

    it('does NOT emit filadmin notification when color = yashil', async () => {
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        criticalStatus: 'yashil',
        personalStatus: null,
        englishStatus: null,
      });

      await service.setCriticalStatus(actor, {
        studentId: 'u1',
        color: 'yashil',
      });

      const notifCalls = mockEvents.emit.mock.calls.filter(
        (c) => c[0] === 'notification.new',
      );
      expect(notifCalls).toHaveLength(0);
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

  describe('setEnglishStatus', () => {
    it('persists englishStatus and emits status.updated', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        tenantId: 't1',
        branchId: 'b1',
      });
      mockPrisma.studentStatus.findUnique.mockResolvedValue(null);
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        englishStatus: 'sariq',
        personalStatus: null,
        criticalStatus: null,
      });

      await service.setEnglishStatus('u1', 'sariq', {
        source: 'ai_evaluation',
        lessonId: 'l1',
        score: 65,
      });

      expect(mockPrisma.studentStatus.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = mockPrisma.studentStatus.upsert.mock.calls[0][0];
      expect(upsertArg.create.englishStatus).toBe('sariq');
      // No auto-flip because score=sariq (not yashil) → criticalStatus
      // must NOT be touched.
      expect(upsertArg.create.criticalStatus).toBeUndefined();
      const updatedCall = mockEvents.emit.mock.calls.find(
        (c) => c[0] === 'status.updated',
      );
      expect(updatedCall).toBeDefined();
      expect(updatedCall![1]).toMatchObject({
        studentId: 'u1',
        source: 'ai_evaluation',
        lessonId: 'l1',
        score: 65,
        changedBy: 'system',
      });
    });

    it('does NOT auto-flip critical when englishStatus=yashil but personal≠yashil', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        tenantId: 't1',
        branchId: 'b1',
      });
      mockPrisma.studentStatus.findUnique.mockResolvedValue({
        englishStatus: 'sariq',
        personalStatus: 'sariq',
        criticalStatus: 'sariq',
      });
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        englishStatus: 'yashil',
        personalStatus: 'sariq',
        criticalStatus: 'sariq',
      });

      await service.setEnglishStatus('u1', 'yashil');

      const upsertArg = mockPrisma.studentStatus.upsert.mock.calls[0][0];
      expect(upsertArg.update.criticalStatus).toBeUndefined();
      const notifCalls = mockEvents.emit.mock.calls.filter(
        (c) => c[0] === 'notification.new',
      );
      expect(notifCalls).toHaveLength(0);
    });

    it('AUTO-flips critical when englishStatus=yashil AND personal=yashil AND prior critical≠yashil', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ tenantId: 't1', branchId: 'b1' }) // student lookup
        .mockResolvedValueOnce({ tenantId: 't1', branchId: 'b1' }); // findBranchManager → student
      mockPrisma.studentStatus.findUnique.mockResolvedValue({
        englishStatus: 'sariq',
        personalStatus: 'yashil',
        criticalStatus: 'sariq',
      });
      mockPrisma.studentStatus.upsert.mockResolvedValue({
        studentId: 'u1',
        englishStatus: 'yashil',
        personalStatus: 'yashil',
        criticalStatus: 'yashil',
      });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'manager1' });

      await service.setEnglishStatus('u1', 'yashil', { score: 92 });

      const upsertArg = mockPrisma.studentStatus.upsert.mock.calls[0][0];
      expect(upsertArg.update.criticalStatus).toBe('yashil');
      const notif = mockEvents.emit.mock.calls.find(
        (c) => c[0] === 'notification.new',
      );
      expect(notif).toBeDefined();
      expect(notif![1]).toMatchObject({
        userId: 'manager1',
        type: 'status.auto_green',
      });
    });

    it('returns null when student does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.setEnglishStatus('ghost', 'qizil');
      expect(result).toBeNull();
      expect(mockPrisma.studentStatus.upsert).not.toHaveBeenCalled();
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
