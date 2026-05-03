import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';

/**
 * Public landing-page endpoints. NO auth guard — intentionally open
 * so the marketing site can render student cards / stats / CMS copy
 * without a login. Only safe-to-publish fields are exposed.
 */
@ApiTags('marketing')
@Controller('marketing')
export class MarketingController {
  constructor(private marketing: MarketingService) {}

  @Get('students')
  list() {
    return this.marketing.listStudents();
  }

  @Get('students/:id')
  getOne(@Param('id') id: string) {
    return this.marketing.getStudent(id);
  }

  @Get('stats')
  stats() {
    return this.marketing.getStats();
  }

  @Get('regions')
  regions() {
    return this.marketing.getRegions();
  }

  /**
   * Single-call payload that drives the entire CMS-backed landing —
   * hero copy, contact details, certificate text, plus the prize and
   * sponsor lists. Defaults from the service kick in when a key has
   * never been set, so the landing is never blank.
   */
  @Get('landing')
  landing() {
    return this.marketing.getLandingContent();
  }
}
