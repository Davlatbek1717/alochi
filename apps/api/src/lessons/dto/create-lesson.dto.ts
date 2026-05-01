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
  IsUUID,
} from 'class-validator';

export class CreateLessonDto {
  @IsUUID()
  tenantId: string;

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
  youtubeUrl: string;

  @IsInt()
  @Min(1)
  @Max(10)
  nRepetitions: number;

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
  cameraEnabled?: boolean;

  @IsString()
  @IsOptional()
  aiTutorContext?: string;
}
