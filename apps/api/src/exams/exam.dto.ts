import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  Min,
  Max,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExamQuestionInputDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  options!: string[];

  @IsInt()
  @Min(0)
  correctIndex!: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  orderIndex?: number;
}

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100)
  passThreshold?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(180)
  timeLimitMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ExamQuestionInputDto)
  questions?: ExamQuestionInputDto[];
}

export class UpdateExamDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(100)
  passThreshold?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(180)
  timeLimitMinutes?: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  // When provided, replaces the entire question set in a single
  // transaction. Pass an empty array to clear all questions.
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ExamQuestionInputDto)
  questions?: ExamQuestionInputDto[];
}
