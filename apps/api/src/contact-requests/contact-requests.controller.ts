import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ContactRequestsService } from './contact-requests.service';
import { CreateContactRequestDto } from './dto/create-contact-request.dto';
import { UpdateContactRequestDto } from './dto/update-contact-request.dto';

/**
 * Public demo-request endpoint + superadmin triage CRUD.
 *
 * Auth model: the `POST /contact-requests` create endpoint is intentionally
 * public — landing-page visitors are not logged in. The global
 * ThrottlerGuard plus the per-method `@Throttle` decorator keeps spam to
 * 5 requests / minute / IP. All other endpoints require superadmin.
 */
@ApiTags('contact-requests')
@Controller('contact-requests')
export class ContactRequestsController {
  constructor(private service: ContactRequestsService) {}

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  create(@Body() dto: CreateContactRequestDto, @Request() req: any) {
    const ip =
      (typeof req.ip === 'string' && req.ip) ||
      (typeof req.headers?.['x-forwarded-for'] === 'string'
        ? (req.headers['x-forwarded-for'] as string).split(',')[0]?.trim()
        : undefined);
    const ua =
      typeof req.headers?.['user-agent'] === 'string'
        ? (req.headers['user-agent'] as string)
        : undefined;
    return this.service.create(dto, ip, ua);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  list(@Query('status') status?: string) {
    return this.service.findAll({ status });
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  getOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContactRequestDto,
    @Request() req: any,
  ) {
    return this.service.updateStatus(id, dto, req.user.userId);
  }
}
