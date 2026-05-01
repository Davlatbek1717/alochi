import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { CenterSize } from '@prisma/client';

export class CreateContactRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  centerName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  contactName!: string;

  @IsString()
  @Matches(/^\+?[0-9\s\-()]{6,20}$/, {
    message: "Telefon raqami noto'g'ri formatda",
  })
  phone!: string;

  @IsOptional()
  @IsEmail({}, { message: "Email noto'g'ri formatda" })
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsEnum(CenterSize)
  centerSize?: CenterSize;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
