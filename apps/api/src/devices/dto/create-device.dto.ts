import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
} from 'class-validator';

/**
 * tenantId is intentionally absent — the controller injects it from
 * req.user.tenantId. enrollmentToken/status/blocked are server-generated and
 * must never be settable from the body (mass-assignment guard).
 */
export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  serialNumber: string;

  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsString()
  @IsOptional()
  imei?: string;

  @IsString()
  @IsOptional()
  macAddress?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  osVersion?: string;

  @IsString()
  @IsOptional()
  androidId?: string;

  @IsDateString()
  @IsOptional()
  purchasedAt?: string;
}
