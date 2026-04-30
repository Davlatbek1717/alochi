import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateTenantSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  warningBlockLimit?: number;
}
