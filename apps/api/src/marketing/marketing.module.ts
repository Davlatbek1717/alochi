import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingAdminController } from './marketing.admin.controller';
import { MarketingService } from './marketing.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MarketingController, MarketingAdminController],
  providers: [MarketingService],
})
export class MarketingModule {}
