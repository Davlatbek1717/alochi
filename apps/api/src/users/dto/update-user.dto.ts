import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { UserRole } from '@prisma/client';

/**
 * Whitelist of fields a superadmin/filadmin is allowed to PATCH on a
 * user record. Anything not declared here (passwordHash, tenantId,
 * login, status, createdAt, …) is stripped by the global
 * ValidationPipe `whitelist: true` before it reaches the service.
 *
 * Status changes go through PATCH /users/:id/status and password
 * resets through POST /users/:id/reset-password — those have their
 * own audit-logged code paths and must NOT be reachable from here.
 */
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  phone?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  // groupId can be null to detach a student from a group.
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  @IsOptional()
  groupId?: string | null;

  // Marketing-showcase fields — safe to publish, edited by admin.
  @IsString()
  @IsOptional()
  @MaxLength(80)
  region?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  school?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  avatarUrl?: string;

  // Student profile self-edit fields. Locked under the same admin
  // guard for now; if/when we add a student-self endpoint, those
  // fields move there. Telegram IDs are numeric strings or @handles
  // — short caps to keep abusive payloads out.
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsString()
  @IsOptional()
  @MaxLength(60)
  parentTelegramId?: string | null;

  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  @IsOptional()
  birthDate?: string | null;

  // CRM-imported student profile fields. All optional — platform-native
  // students don't have these. Sent as part of admin edit-student form.
  @IsString()
  @IsOptional()
  @MaxLength(80)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  district?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(15)
  grade?: number;

  @IsOptional()
  steps?: unknown;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100)
  percentage?: number;

  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  blockedReason?: string;

  @ValidateIf((_, v) => v !== null && v !== '')
  @IsDateString()
  @IsOptional()
  joinedAt?: string | null;

  @IsInt()
  @IsOptional()
  @Min(0)
  totalPoints?: number;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  timeSlot?: string;

  @IsOptional()
  warnings?: unknown;

  @IsInt()
  @IsOptional()
  @Min(0)
  warningsCount?: number;
}
