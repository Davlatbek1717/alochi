import { IsString, IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';

const DEVICE_STATUSES = [
  'active',
  'inactive',
  'lost',
  'damaged',
  'retired',
  'suspicious',
] as const;

/**
 * Whitelisted update fields only. Without this DTO the endpoint spread an
 * arbitrary body straight into prisma.device.update, letting a caller flip
 * tenantId, blocked, enrollmentToken etc. (mass-assignment).
 */
export class UpdateDeviceDto {
  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  osVersion?: string;

  @IsString()
  @IsOptional()
  appVersion?: string;

  @IsString()
  @IsOptional()
  fcmToken?: string;

  @IsIn(DEVICE_STATUSES)
  @IsOptional()
  status?: (typeof DEVICE_STATUSES)[number];

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  batteryLevel?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  storageFreePct?: number;
}
