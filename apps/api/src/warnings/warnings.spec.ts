import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WarningsService } from './warnings.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const mockPrisma = {
  warning: {
    create: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    update: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  },
};

const mockEvents = {
  emit: jest.fn(),
};

describe('WarningsService', () => {
  let service: WarningsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WarningsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEvents },
      ],
    }).compile();
    service = module.get(WarningsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('give', () => {
    const dto = {
      tenantId: 't1',
      studentId: 's1',
      givenBy: 'admin1',
      reasonType: 'discipline',
      reasonText: 'Late arrival',
    };

    it('throws BadRequestException when reasonText is blank', async () => {
      await expect(service.give({ ...dto, reasonText: '   ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates warning and emits warning.given when below block limit', async () => {
      const createdWarning = { id: 'w1', ...dto };
      mockPrisma.warning.create.mockResolvedValue(createdWarning);
      mockPrisma.warning.count.mockResolvedValue(2);

      const result = await service.give(dto);

      expect(mockPrisma.warning.create).toHaveBeenCalledWith({ data: dto });
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith('warning.given', {
        studentId: dto.studentId,
        count: 2,
        warning: createdWarning,
      });
      expect(result).toEqual({ warning: createdWarning, activeCount: 2 });
    });

    it('blocks student and emits student.blocked when active warnings reach 3', async () => {
      const createdWarning = { id: 'w2', ...dto };
      mockPrisma.warning.create.mockResolvedValue(createdWarning);
      mockPrisma.warning.count.mockResolvedValue(3);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.give(dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: dto.studentId },
        data: { status: 'blocked_warning' },
      });
      expect(mockEvents.emit).toHaveBeenCalledWith('student.blocked', {
        studentId: dto.studentId,
        reason: 'warning',
        activeCount: 3,
      });
      expect(result.activeCount).toBe(3);
    });
  });

  describe('cancel', () => {
    it('throws BadRequestException when cancelReason is blank', async () => {
      await expect(service.cancel('w1', 'admin1', '  ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cancels warning and unblocks student when active count drops below limit', async () => {
      const cancelledWarning = { id: 'w1', studentId: 's1', isCancelled: true };
      mockPrisma.warning.update.mockResolvedValue(cancelledWarning);
      mockPrisma.warning.count.mockResolvedValue(2);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: 's1', status: 'blocked_warning' });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.cancel('w1', 'admin1', 'Mistake');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'active' },
      });
      expect(result.activeCount).toBe(2);
    });

    it('does not change status when cancelled student was not blocked_warning', async () => {
      const cancelledWarning = { id: 'w1', studentId: 's1', isCancelled: true };
      mockPrisma.warning.update.mockResolvedValue(cancelledWarning);
      mockPrisma.warning.count.mockResolvedValue(1);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ id: 's1', status: 'active' });
      mockPrisma.user.update.mockResolvedValue({});

      await service.cancel('w1', 'admin1', 'Mistake');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'active' },
      });
    });
  });

  describe('findByStudent', () => {
    it('returns warnings ordered by createdAt desc', async () => {
      const warnings = [{ id: 'w1' }, { id: 'w2' }];
      mockPrisma.warning.findMany.mockResolvedValue(warnings);

      const result = await service.findByStudent('s1');

      expect(mockPrisma.warning.findMany).toHaveBeenCalledWith({
        where: { studentId: 's1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(warnings);
    });
  });
});
