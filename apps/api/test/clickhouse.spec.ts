import { ClickHouseService } from '../src/clickhouse/clickhouse.service';

describe('ClickHouseService', () => {
  function makeMockClient() {
    return {
      ping: jest.fn().mockResolvedValue({ success: true }),
      command: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue(undefined),
      query: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
  }

  function makeMockConfig(values: Record<string, string> = {}) {
    return {
      get: jest.fn((key: string) => values[key]),
    };
  }

  beforeEach(() => jest.clearAllMocks());

  it('isReady returns false before init', () => {
    const service = new ClickHouseService(makeMockConfig() as never);
    expect(service.isReady()).toBe(false);
  });

  it('insertEvent throws when client not initialized', async () => {
    const service = new ClickHouseService(makeMockConfig() as never);
    await expect(
      service.insertEvent({
        event_id: 'e1',
        tenant_id: 't1',
        event_type: 'test',
        student_id: null,
        branch_id: null,
        lesson_id: null,
        session_count: 0,
        is_present: null,
        is_late: null,
        new_streak: null,
        data: '{}',
        created_at: new Date().toISOString(),
      }),
    ).rejects.toThrow('not initialized');
  });

  it('insertEvent calls client.insert with correct table and format', async () => {
    const service = new ClickHouseService(makeMockConfig() as never);
    const mockClient = makeMockClient();
    (service as unknown as { client: typeof mockClient }).client = mockClient;

    await service.insertEvent({
      event_id: 'e1',
      tenant_id: 't1',
      event_type: 'lesson_completed',
      student_id: 's1',
      branch_id: 'b1',
      lesson_id: 'l1',
      session_count: 3,
      is_present: null,
      is_late: null,
      new_streak: null,
      data: '{"lessonId":"l1"}',
      created_at: '2026-04-30T10:00:00.000Z',
    });

    expect(mockClient.insert).toHaveBeenCalledWith({
      table: 'events',
      values: [
        expect.objectContaining({
          event_id: 'e1',
          event_type: 'lesson_completed',
        }),
      ],
      format: 'JSONEachRow',
    });
  });

  it('query passes tenant_id through query_params (parameterized)', async () => {
    const service = new ClickHouseService(makeMockConfig() as never);
    const mockClient = makeMockClient();
    mockClient.query.mockResolvedValue({
      json: jest.fn().mockResolvedValue([{ count: '5' }]),
    });
    (service as unknown as { client: typeof mockClient }).client = mockClient;

    const rows = await service.query<{ count: string }>(
      `SELECT count() AS count FROM events WHERE tenant_id = {tenantId:UUID}`,
      { tenantId: 't1' },
    );

    expect(rows).toEqual([{ count: '5' }]);
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.objectContaining({
        query_params: { tenantId: 't1' },
        format: 'JSONEachRow',
      }),
    );
  });
});
