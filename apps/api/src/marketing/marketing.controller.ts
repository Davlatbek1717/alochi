import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MarketingService } from './marketing.service';

/**
 * Public landing-page endpoints. NO auth guard — intentionally open
 * so the marketing site can render student cards / stats without a
 * login. Only safe-to-publish fields are exposed (see service).
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
}
