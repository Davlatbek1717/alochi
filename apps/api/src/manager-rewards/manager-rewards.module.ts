import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ManagerRewardsService } from './manager-rewards.service';
import { ManagerRewardsController } from './manager-rewards.controller';

@Module({
  imports: [PrismaModule],
  providers: [ManagerRewardsService],
  controllers: [ManagerRewardsController],
  exports: [ManagerRewardsService],
})
export class ManagerRewardsModule {}
