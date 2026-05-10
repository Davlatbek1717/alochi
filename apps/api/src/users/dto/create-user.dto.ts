import {
  IsString,
  IsEnum,
  IsUUID,
  MinLength,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  // Server-derived from JWT in the controller — kept on the type so the
  // service can read it after the controller fills it in. Optional at the
  // request boundary so single-tenant clients don't have to send it.
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsUUID()
  @IsOptional()
  groupId?: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  phone?: string;

  // Optional CRM-imported student profile fields. Populated by the
  // legacy alochibolajon CRM importer and the admin "edit student"
  // form. All optional — platform-native users do not need them.
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
  region?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  school?: string;

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

  @IsDateString()
  @IsOptional()
  joinedAt?: string;

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

  @IsString()
  @IsOptional()
  @MaxLength(64)
  crmStudentId?: string;
}
