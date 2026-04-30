import { Test } from '@nestjs/testing';
import { ManagerSessionsService } from './manager-sessions.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  managerSession: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('ManagerSessionsService', () => {
  let service: ManagerSessionsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ManagerSessionsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = moduleRef.get(ManagerSessionsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('create stores a new session with parsed scheduledAt', async () => {
    mockPrisma.managerSession.create.mockResolvedValue({ id: 'ms-1' });

    await service.create({
      managerId: 'm-1',
      studentId: 's-1',
      scheduledAt: '2026-05-10T10:00:00Z',
      notes: 'plan',
    });

    expect(mockPrisma.managerSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        managerId: 'm-1',
        studentId: 's-1',
        notes: 'plan',
      }),
    });
    const passed = mockPrisma.managerSession.create.mock.calls[0][0].data
      .scheduledAt as Date;
    expect(passed instanceof Date).toBe(true);
  });

  it('markComplete sets completedAt on existing manager session', async () => {
    mockPrisma.managerSession.findFirst.mockResolvedValue({
      id: 'ms-1',
      managerId: 'm-1',
    });
    mockPrisma.managerSession.update.mockResolvedValue({
      id: 'ms-1',
      completedAt: new Date(),
    });

    const result = await service.markComplete('ms-1', 'm-1', 'done');
    expect(mockPrisma.managerSession.update).toHaveBeenCalled();
    expect(result.id).toBe('ms-1');
  });
});
