import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  Min,
} from 'class-validator';

/**
 * Whitelisted policy fields only. policyVersion is server-managed and must
 * never be settable from the body, so it is intentionally absent.
 */
export class UpsertDevicePolicyDto {
  @IsString()
  @IsOptional()
  allowedHoursStart?: string;

  @IsString()
  @IsOptional()
  allowedHoursEnd?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedDomains?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  screenshotIntervalSec?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  cameraIntervalSec?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  pingIntervalSec?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  wifiSsidWhitelist?: string[];

  @IsBoolean()
  @IsOptional()
  blockCameraOutsideHours?: boolean;

  @IsString()
  @IsOptional()
  forceUpdateMinVersion?: string;
}
