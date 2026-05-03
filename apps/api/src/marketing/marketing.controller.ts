import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';

/**
 * Coerce a query-string number with a sane default and cap. The
 * service also clamps, but we sanitise here too so we never pass
 * NaN or absurd values into the data layer.
 */
function clampQueryNumber(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

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
  list(@Query('limit') limit?: string, @Query('skip') skip?: string) {
    return this.marketing.listStudents({
      limit: clampQueryNumber(limit, 50, 1, 100),
      skip: clampQueryNumber(skip, 0, 0, 10_000),
    });
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
