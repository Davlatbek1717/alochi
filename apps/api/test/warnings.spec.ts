import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { WarningsService } from '../src/warnings/warnings.service';
import { WarningsController } from '../src/warnings/warnings.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ROLES_KEY } from '../src/auth/roles.decorator';

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
  tenant: {
    findUnique: jest.fn(),
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

    beforeEach(() => {
      // Default: no tenant override, falls back to default block limit (3).
      mockPrisma.tenant.findUnique.mockResolvedValue({ warningBlockLimit: 3 });
    });

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

    it('honours tenant.warningBlockLimit override (e.g. 5)', async () => {
      // Tenant configured to allow 5 active warnings before blocking.
      mockPrisma.tenant.findUnique.mockResolvedValue({ warningBlockLimit: 5 });
      mockPrisma.warning.create.mockResolvedValue({ id: 'w3', ...dto });
      // 4 active warnings → still under the new limit.
      mockPrisma.warning.count.mockResolvedValue(4);

      const result = await service.give(dto);

      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'warning.given',
        expect.objectContaining({ count: 4 }),
      );
      expect(result.activeCount).toBe(4);
    });

    it('falls back to default limit (3) when tenant lookup returns null', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.warning.create.mockResolvedValue({ id: 'w4', ...dto });
      mockPrisma.warning.count.mockResolvedValue(3);
      mockPrisma.user.update.mockResolvedValue({});

      await service.give(dto);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: dto.studentId },
        data: { status: 'blocked_warning' },
      });
    });
  });

  describe('cancel', () => {
    beforeEach(() => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ warningBlockLimit: 3 });
    });

    it('throws BadRequestException when cancelReason is blank', async () => {
      await expect(service.cancel('w1', 'admin1', '  ')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cancels warning and unblocks student when active count drops below limit', async () => {
      const cancelledWarning = {
        id: 'w1',
        studentId: 's1',
        tenantId: 't1',
        isCancelled: true,
      };
      mockPrisma.warning.update.mockResolvedValue(cancelledWarning);
      mockPrisma.warning.count.mockResolvedValue(2);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 's1',
        status: 'blocked_warning',
      });
      mockPrisma.user.update.mockResolvedValue({});

      const result = await service.cancel('w1', 'admin1', 'Mistake');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'active' },
      });
      expect(result.activeCount).toBe(2);
    });

    it('preserves existing status when student was not blocked_warning', async () => {
      const cancelledWarning = {
        id: 'w1',
        studentId: 's1',
        tenantId: 't1',
        isCancelled: true,
      };
      mockPrisma.warning.update.mockResolvedValue(cancelledWarning);
      mockPrisma.warning.count.mockResolvedValue(1);
      mockPrisma.user.findUniqueOrThrow.mockResolvedValue({
        id: 's1',
        status: 'active',
      });
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

describe('WarningsController — RBAC', () => {
  // Spec §3.1.4 + §3.2.4: only filadmin & superadmin may give/cancel warnings
  // (manager removed in Phase 5).
  const reflector = new Reflector();

  it('POST /warnings/:studentId allows filadmin & superadmin (manager 403)', () => {
    const roles = reflector.get<UserRole[]>(
      ROLES_KEY,
      WarningsController.prototype.give,
    );
    expect(roles).toContain(UserRole.filadmin);
    expect(roles).toContain(UserRole.superadmin);
    expect(roles).not.toContain(UserRole.manager);
  });

  it('PATCH /warnings/:warningId/cancel excludes manager', () => {
    const roles = reflector.get<UserRole[]>(
      ROLES_KEY,
      WarningsController.prototype.cancelWarning,
    );
    expect(roles).toContain(UserRole.filadmin);
    expect(roles).toContain(UserRole.superadmin);
    expect(roles).not.toContain(UserRole.manager);
  });
});
