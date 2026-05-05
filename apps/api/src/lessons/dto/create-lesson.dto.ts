import {
  IsString,
  IsEnum,
  IsInt,
  IsUrl,
  IsBoolean,
  IsOptional,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

/**
 * tenantId is intentionally absent — the controller always injects it
 * from req.user.tenantId so neither superadmin nor filadmin can create
 * a lesson inside a tenant that isn't their own.
 */
export class CreateLessonDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum([
    'english',
    'personal_development',
    'critical_thinking',
    'experiment',
  ])
  type: string;

  @IsInt()
  @Min(1)
  orderNumber: number;

  @IsUrl()
  @IsOptional()
  youtubeUrl?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  nRepetitions?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(20)
  maxNOverride?: number;

  @IsBoolean()
  @IsOptional()
  mcqEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  wordOrderEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  vocabularyEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  hasExam?: boolean;

  @IsBoolean()
  @IsOptional()
  aiTutorEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  cameraEnabled?: boolean;

  @IsString()
  @IsOptional()
  aiTutorContext?: string;

  @IsString()
  @IsOptional()
  subcategory?: string;
}
