import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  warningBlockLimit?: number;

  /** Tenant's display name shown in the dashboard and login page. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brandName?: string;

  /** Absolute URL to the tenant logo (SVG or PNG, shown 32–48 px tall). */
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  logoUrl?: string;

  /** Absolute URL to the tenant favicon (.ico or 32×32 PNG). */
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  faviconUrl?: string;

  /**
   * CSS hex colour used as the primary accent in the tenant's UI.
   * Must be a 3- or 6-digit hex with leading #.
   * Example: "#6d28d9"
   */
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'primaryColor must be a valid hex colour (e.g. #6d28d9)',
  })
  primaryColor?: string;
}
