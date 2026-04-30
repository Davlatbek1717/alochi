import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { LetterCollectionService } from './letter-collection.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('letters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LetterCollectionController {
  constructor(private letters: LetterCollectionService) {}

  @Get()
  @Roles(
    UserRole.student,
    UserRole.manager,
    UserRole.mentor,
    UserRole.filadmin,
    UserRole.superadmin,
  )
  listAll() {
    return this.letters.listAll();
  }

  @Get('mine')
  @Roles(UserRole.student)
  listMine(@Request() req: any) {
    return this.letters.listOwned(req.user.userId);
  }

  @Get(':studentId')
  @Roles(
    UserRole.manager,
    UserRole.mentor,
    UserRole.filadmin,
    UserRole.superadmin,
  )
  listForStudent(@Param('studentId') studentId: string) {
    return this.letters.listOwned(studentId);
  }

  @Post(':studentId/award')
  @Roles(UserRole.superadmin, UserRole.manager)
  awardRandom(@Param('studentId') studentId: string) {
    return this.letters.awardRandom(studentId);
  }
}
