import { CertificatesService } from '../src/gamification/certificates.service';

describe('CertificatesService', () => {
  const mockPrisma = {
    studentProgress: {
      count: jest.fn(),
    },
    certificate: {
      create: jest.fn().mockResolvedValue({ id: 'cert-1', level: 'bronze' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  const service = new CertificatesService(mockPrisma as any);

  it('awards bronze at 50 lessons', async () => {
    mockPrisma.studentProgress.count.mockResolvedValue(50);
    const result = await service.checkAndAward('student-id', 'tenant-id');
    expect(result?.level).toBe('bronze');
  });

  it('awards gold at 250 lessons', async () => {
    mockPrisma.studentProgress.count.mockResolvedValue(250);
    mockPrisma.certificate.findFirst.mockResolvedValue(null);
    mockPrisma.certificate.create.mockResolvedValueOnce({
      id: 'cert-1',
      level: 'gold',
    });
    const result = await service.checkAndAward('student-id', 'tenant-id');
    expect(result?.level).toBe('gold');
  });

  it('does not award if already has that level', async () => {
    mockPrisma.studentProgress.count.mockResolvedValue(50);
    mockPrisma.certificate.findFirst.mockResolvedValue({
      id: 'existing',
      level: 'bronze',
    });
    const result = await service.checkAndAward('student-id', 'tenant-id');
    expect(result).toBeNull();
  });
});
