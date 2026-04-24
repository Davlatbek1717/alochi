import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug faqat kichik harflar, raqamlar va tire ("-") dan iborat bo\'lishi kerak' })
  slug: string;
}
