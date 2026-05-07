import {
  IsString,
  IsEnum,
  IsUUID,
  MinLength,
  IsOptional,
  IsNotEmpty,
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
}
