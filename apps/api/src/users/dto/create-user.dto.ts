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
  @IsUUID()
  tenantId: string;

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
