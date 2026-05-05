import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';

/**
 * Public endpoints — no authentication required.
 *
 * The login page calls GET /branding/:slug before the user has a token
 * so it can render per-tenant logo, name, and accent colour.  Only
 * safe-to-publish fields are returned (see TenantsService.getBrandingBySlug).
 */
@ApiTags('branding')
@Controller('branding')
export class BrandingController {
  constructor(private tenants: TenantsService) {}

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.tenants.getBrandingBySlug(slug);
  }
}
