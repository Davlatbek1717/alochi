import { ContactRequestsService } from '../src/contact-requests/contact-requests.service';
import { ContactRequestEventHandler } from '../src/contact-requests/contact-request-event.handler';
import { ContactRequestStatus, CenterSize } from '@prisma/client';

describe('ContactRequestsService', () => {
  function makePrisma() {
    return {
      contactRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
      },
    };
  }

  function makeEvents() {
    return { emit: jest.fn() };
  }

  beforeEach(() => jest.clearAllMocks());

  it('create() persists with status=new and emits contact_request.created', async () => {
    const prisma = makePrisma();
    const events = makeEvents();
    const created = {
      id: 'cr-1',
      centerName: 'Bilim',
      contactName: 'Akmal',
      phone: '+998901234567',
      status: ContactRequestStatus.new,
    };
    prisma.contactRequest.create.mockResolvedValue(created);

    const svc = new ContactRequestsService(prisma as never, events as never);
    const result = await svc.create(
      {
        centerName: 'Bilim',
        contactName: 'Akmal',
        phone: '+998901234567',
        centerSize: CenterSize.medium,
      },
      '127.0.0.1',
      'jest',
    );

    expect(prisma.contactRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        centerName: 'Bilim',
        contactName: 'Akmal',
        phone: '+998901234567',
        centerSize: CenterSize.medium,
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      }),
    });
    // No status passed = uses Prisma default (new)
    const data = prisma.contactRequest.create.mock.calls[0][0].data;
    expect(data.status).toBeUndefined();

    expect(events.emit).toHaveBeenCalledWith(
      'contact_request.created',
      created,
    );
    expect(result).toEqual(created);
  });

  it('findAll() filters by status when valid, ignores invalid status, returns counts', async () => {
    const prisma = makePrisma();
    prisma.contactRequest.findMany.mockResolvedValue([{ id: 'a' }]);
    prisma.contactRequest.groupBy.mockResolvedValue([
      { status: ContactRequestStatus.new, _count: { _all: 3 } },
      { status: ContactRequestStatus.contacted, _count: { _all: 1 } },
    ]);

    const svc = new ContactRequestsService(prisma as never, {} as never);
    const result = await svc.findAll({ status: 'new' });

    expect(prisma.contactRequest.findMany).toHaveBeenCalledWith({
      where: { status: ContactRequestStatus.new },
      orderBy: { createdAt: 'desc' },
    });
    expect(result.counts.new).toBe(3);
    expect(result.counts.contacted).toBe(1);
    expect(result.counts.total).toBe(4);
    expect(result.items).toHaveLength(1);

    // Invalid status falls through to no filter
    prisma.contactRequest.findMany.mockClear();
    await svc.findAll({ status: 'bogus' });
    expect(prisma.contactRequest.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findOne() throws NotFoundException when missing', async () => {
    const prisma = makePrisma();
    prisma.contactRequest.findUnique.mockResolvedValue(null);
    const svc = new ContactRequestsService(prisma as never, {} as never);
    await expect(svc.findOne('missing')).rejects.toThrow("So'rov topilmadi");
  });

  it('updateStatus() sets handledBy + handledAt when status changes', async () => {
    const prisma = makePrisma();
    prisma.contactRequest.findUnique.mockResolvedValue({ id: 'cr-1' });
    prisma.contactRequest.update.mockResolvedValue({ id: 'cr-1' });

    const svc = new ContactRequestsService(prisma as never, {} as never);
    await svc.updateStatus(
      'cr-1',
      { status: ContactRequestStatus.contacted },
      'sa-1',
    );

    const updateArg = prisma.contactRequest.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'cr-1' });
    expect(updateArg.data.status).toBe(ContactRequestStatus.contacted);
    expect(updateArg.data.handledBy).toBe('sa-1');
    expect(updateArg.data.handledAt).toBeInstanceOf(Date);
  });

  it('updateStatus() persists declineReason', async () => {
    const prisma = makePrisma();
    prisma.contactRequest.findUnique.mockResolvedValue({ id: 'cr-1' });
    prisma.contactRequest.update.mockResolvedValue({ id: 'cr-1' });

    const svc = new ContactRequestsService(prisma as never, {} as never);
    await svc.updateStatus(
      'cr-1',
      {
        status: ContactRequestStatus.declined,
        declineReason: 'Spam',
      },
      'sa-1',
    );
    const updateArg = prisma.contactRequest.update.mock.calls[0][0];
    expect(updateArg.data.declineReason).toBe('Spam');
    expect(updateArg.data.status).toBe(ContactRequestStatus.declined);
  });

  it('updateStatus() throws NotFound when request missing', async () => {
    const prisma = makePrisma();
    prisma.contactRequest.findUnique.mockResolvedValue(null);
    const svc = new ContactRequestsService(prisma as never, {} as never);
    await expect(
      svc.updateStatus(
        'missing',
        { status: ContactRequestStatus.contacted },
        'sa-1',
      ),
    ).rejects.toThrow("So'rov topilmadi");
  });

  it('markConverted() sets status, convertedTenantId, handler', async () => {
    const prisma = makePrisma();
    prisma.contactRequest.update.mockResolvedValue({ id: 'cr-1' });
    const svc = new ContactRequestsService(prisma as never, {} as never);
    await svc.markConverted('cr-1', 't-1', 'sa-1');
    expect(prisma.contactRequest.update).toHaveBeenCalledWith({
      where: { id: 'cr-1' },
      data: expect.objectContaining({
        status: ContactRequestStatus.converted,
        convertedTenantId: 't-1',
        handledBy: 'sa-1',
      }),
    });
  });
});

describe('ContactRequestEventHandler', () => {
  function makeDeps() {
    return {
      prisma: {
        user: { findMany: jest.fn() },
      },
      notifications: { send: jest.fn() },
      telegram: { sendTemplate: jest.fn() },
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('sends in-app + Telegram to all active superadmins on create event', async () => {
    const deps = makeDeps();
    deps.prisma.user.findMany.mockResolvedValue([
      { id: 'sa-1', telegramId: BigInt(123), tenantId: 't-1' },
      { id: 'sa-2', telegramId: null, tenantId: 't-2' },
    ]);

    const handler = new ContactRequestEventHandler(
      deps.prisma as never,
      deps.notifications as never,
      deps.telegram as never,
    );

    await handler.onCreated({
      id: 'cr-1',
      centerName: 'Bilim',
      contactName: 'Akmal',
      phone: '+998901112233',
      message: 'Salom',
      centerSize: CenterSize.medium,
    } as never);

    expect(deps.notifications.send).toHaveBeenCalledTimes(2);
    expect(deps.telegram.sendTemplate).toHaveBeenCalledTimes(1);
    expect(deps.telegram.sendTemplate).toHaveBeenCalledWith(
      BigInt(123),
      'contact_request.new',
      expect.objectContaining({
        centerName: 'Bilim',
        contactName: 'Akmal',
        phone: '+998901112233',
      }),
      't-1',
    );
  });

  it('handles zero superadmins gracefully (logs, no fan-out)', async () => {
    const deps = makeDeps();
    deps.prisma.user.findMany.mockResolvedValue([]);
    const handler = new ContactRequestEventHandler(
      deps.prisma as never,
      deps.notifications as never,
      deps.telegram as never,
    );
    await handler.onCreated({ id: 'cr-1' } as never);
    expect(deps.notifications.send).not.toHaveBeenCalled();
    expect(deps.telegram.sendTemplate).not.toHaveBeenCalled();
  });

  it('continues if one in-app send throws', async () => {
    const deps = makeDeps();
    deps.prisma.user.findMany.mockResolvedValue([
      { id: 'sa-1', telegramId: null, tenantId: 't-1' },
      { id: 'sa-2', telegramId: null, tenantId: 't-2' },
    ]);
    deps.notifications.send
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({});

    const handler = new ContactRequestEventHandler(
      deps.prisma as never,
      deps.notifications as never,
      deps.telegram as never,
    );

    // Should not throw despite first send failing
    await expect(
      handler.onCreated({
        id: 'cr-1',
        centerName: 'Bilim',
        contactName: 'A',
        phone: '+9989',
      } as never),
    ).resolves.toBeUndefined();
    expect(deps.notifications.send).toHaveBeenCalledTimes(2);
  });
});
