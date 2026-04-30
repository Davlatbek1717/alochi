import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;
}
