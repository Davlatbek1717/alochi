import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { BrandingController } from './branding.controller';

@Module({
  providers: [TenantsService],
  controllers: [TenantsController, BrandingController],
  exports: [TenantsService],
})
export class TenantsModule {}
