import { IsIn, IsOptional, IsString } from 'class-validator';

export class RespondDelegationDto {
  @IsIn(['accepted', 'rejected'])
  action: 'accepted' | 'rejected';

  @IsString()
  @IsOptional()
  reason?: string;
}

export class CancelDelegationDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
