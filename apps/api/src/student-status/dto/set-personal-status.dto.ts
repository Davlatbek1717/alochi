import { IsUUID, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { StatusColor } from '../status.types';

// Re-export so existing imports of `StatusColor` from this DTO module
// keep working. New code should import from '../status.types' directly.
export type { StatusColor };

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
