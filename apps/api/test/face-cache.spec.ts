import { CacheService } from '../src/face/cache.service';

describe('FaceCacheService', () => {
  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([
      {
        user_id: 'u-1',
        name: 'Test User',
        embedding: '[0.1,0.2,0.3]',
        work_start_time: '09:00',
        late_grace_minutes: 5,
      },
    ]),
    branchDevice: {
      update: jest.fn().mockResolvedValue({}),
    },
  };

  const service = new CacheService(mockPrisma as any);

  it('generates cache package for branch', async () => {
    const cache = await service.generateBranchCache('branch-id', 'tenant-id');
    expect(cache.branch_id).toBe('branch-id');
    expect(cache.embeddings).toHaveLength(1);
    expect(cache.generated_at).toBeDefined();
  });

  it('returns empty embeddings when no rows', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);
    const cache = await service.generateBranchCache('branch-id', 'tenant-id');
    expect(cache.embeddings).toHaveLength(0);
  });
});
