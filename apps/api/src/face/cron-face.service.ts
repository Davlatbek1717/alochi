import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';

@Injectable()
export class CronFaceService {
  private readonly logger = new Logger(CronFaceService.name);

  constructor(
    private prisma: PrismaService,
    private cacheService: CacheService,
  ) {}

  @Cron('0 23 * * *', { name: 'face_cache_generate' })
  async generateAllCaches() {
    this.logger.log('Face ID: kesh generatsiya boshlanmoqda...');

    const branches = await this.prisma.branch.findMany({
      include: { users: { where: { status: 'active' } } },
    });

    for (const branch of branches) {
      try {
        await this.cacheService.generateBranchCache(branch.id, branch.tenantId);
        this.logger.log(`Branch ${branch.name}: kesh yangilandi`);
      } catch (err) {
        this.logger.error(`Branch ${branch.name}: kesh xatosi — ${err}`);
      }
    }
  }

  @Cron('0 8 * * *', { name: 'face_cache_stale_alert' })
  async alertStaleCache() {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const staleDevices = await this.prisma.branchDevice.findMany({
      where: {
        isActive: true,
        OR: [{ lastCacheSync: { lt: twoDaysAgo } }, { lastCacheSync: null }],
      },
      include: { branch: { select: { name: true, filadminId: true } } },
    });

    for (const device of staleDevices) {
      this.logger.warn(`Stale cache: ${device.deviceName} (${device.branch.name})`);
    }
  }
}
