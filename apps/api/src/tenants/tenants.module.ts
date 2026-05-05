import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { BrandingController } from './branding.controller';
import { I18nModule } from '../i18n/i18n.module';

@Module({
  imports: [I18nModule],
  providers: [TenantsService],
  controllers: [TenantsController, BrandingController],
  exports: [TenantsService],
})
export class TenantsModule {}
