import { Test } from '@nestjs/testing';
import { PrismaService } from '../src/prisma/prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
    await service.onModuleInit();
  });

  afterAll(async () => {
    await service.onModuleDestroy();
  });

  it('should connect to database', async () => {
    await expect(service.$queryRaw`SELECT 1`).resolves.toBeDefined();
  });
});
