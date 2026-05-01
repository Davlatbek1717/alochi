import { ExamQueueService } from './exam-queue.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ExamQueueService', () => {
  const prisma = {
    examQueueEntry: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const svc = new ExamQueueService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('returns existing entry on duplicate join', async () => {
    prisma.examQueueEntry.findFirst.mockResolvedValue({ id: 'q-1' });
    const r = await svc.join({
      tenantId: 't',
      branchId: 'b',
      studentId: 's',
      lessonId: 'l',
    });
    expect(r).toEqual({ id: 'q-1' });
    expect(prisma.examQueueEntry.create).not.toHaveBeenCalled();
  });

  it('creates a new entry when none exists', async () => {
    prisma.examQueueEntry.findFirst.mockResolvedValue(null);
    prisma.examQueueEntry.create.mockResolvedValue({ id: 'q-2' });
    const r = await svc.join({
      tenantId: 't',
      branchId: 'b',
      studentId: 's',
      lessonId: 'l',
    });
    expect(r).toEqual({ id: 'q-2' });
  });

  it('marks an entry in_progress on start', async () => {
    prisma.examQueueEntry.update.mockResolvedValue({
      id: 'q-1',
      status: 'in_progress',
    });
    await svc.start('q-1');
    expect(prisma.examQueueEntry.update).toHaveBeenCalledWith({
      where: { id: 'q-1' },
      data: expect.objectContaining({ status: 'in_progress' }),
    });
  });
});
