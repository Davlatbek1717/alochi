import { Module } from '@nestjs/common';
import { MarketingController } from './marketing.controller';
import { MarketingAdminController } from './marketing.admin.controller';
import { MarketingService } from './marketing.service';
import { PrismaModule } from '../prisma/prisma.module';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [PrismaModule, I18nModule],
  controllers: [MarketingController, MarketingAdminController],
  providers: [MarketingService],
})
export class MarketingModule {}
