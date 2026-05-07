import {
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardTenantPart {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]{3,50}$/, {
    message: "Slug faqat a-z, 0-9, - belgilarni o'z ichiga oladi (3-50 belgi)",
  })
  slug!: string;
}

export class OnboardAdminPart {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Login: faqat harflar, raqamlar, _ . -',
  })
  login!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}

export class OnboardBranchPart {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;
}

export class OnboardTenantDto {
  @IsObject()
  @ValidateNested()
  @Type(() => OnboardTenantPart)
  tenant!: OnboardTenantPart;

  @IsObject()
  @ValidateNested()
  @Type(() => OnboardAdminPart)
  admin!: OnboardAdminPart;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => OnboardBranchPart)
  branch?: OnboardBranchPart;
}
