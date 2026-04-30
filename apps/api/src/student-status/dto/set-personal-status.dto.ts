import { IsUUID, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type StatusColor = 'yashil' | 'sariq' | 'qizil';

export class SetPersonalStatusDto {
  @IsUUID()
  studentId: string;

  @IsIn(['yashil', 'sariq', 'qizil'])
  color: StatusColor;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsString()
  date?: string;
}
