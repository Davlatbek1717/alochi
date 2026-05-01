import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContactRequestStatus } from '@prisma/client';

export class UpdateContactRequestDto {
  @IsOptional()
  @IsEnum(ContactRequestStatus)
  status?: ContactRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  declineReason?: string;
}
