import { IsString, IsNotEmpty } from 'class-validator';

export class CancelWarningDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
