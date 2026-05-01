import {
  IsString,
  IsEnum,
  IsInt,
  IsUrl,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

/**
 * 25.B.1: Updates allow tweaking validation-bound fields. All fields optional;
 * each retains the original min/max bounds when present.
 */
export class UpdateLessonDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsEnum([
    'english',
    'personal_development',
    'critical_thinking',
    'experiment',
  ])
  @IsOptional()
  type?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  orderNumber?: number;

  @IsUrl()
  @IsOptional()
  youtubeUrl?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(10)
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
}
