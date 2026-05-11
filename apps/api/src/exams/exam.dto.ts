import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsObject,
  Min,
  Max,
  IsArray,
  ValidateNested,
  IsNotEmpty,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 12 supported exercise types — same set as LessonComponent so the
 * student-side renderers can be reused 1:1.
 */
export const EXAM_QUESTION_TYPES = [
  'mcq',
  'word_order',
  'translate',
  'listen_pick',
  'listen_type',
  'match_pairs',
  'pick_picture',
  'fill_blank',
  'spelling',
  'order_sentences',
  'speak_sentence',
  'speak_words',
] as const;

export type ExamQuestionType = (typeof EXAM_QUESTION_TYPES)[number];

export class ExamQuestionInputDto {
  @IsString()
  @IsIn(EXAM_QUESTION_TYPES as unknown as string[])
  type!: ExamQuestionType;

  // Per-type payload — shape mirrors the corresponding lesson
  // component config the student-side runner already understands.
  @IsObject()
  config!: Record<string, unknown>;

  @IsInt()
  @IsOptional()
  @Min(0)
  orderIndex?: number;
}

export const EXAM_KINDS = ['test', 'ai_oral'] as const;
export type ExamKind = (typeof EXAM_KINDS)[number];

export const ORAL_LANGUAGES = ['uz', 'en'] as const;
export type OralLanguage = (typeof ORAL_LANGUAGES)[number];

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(EXAM_KINDS as unknown as string[])
  kind?: ExamKind;

  @IsString()
  @IsOptional()
  @IsIn(ORAL_LANGUAGES as unknown as string[])
  language?: OralLanguage;

  @IsString()
  @IsOptional()
  aiPrompt?: string;

  @IsInt()
  @IsOptional()
  @Min(2)
  @Max(60)
  maxMinutes?: number;

  @IsInt()
  @IsOptional()
  @Min(3)
  @Max(15)
  questionCount?: number;

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

  @IsString()
  @IsOptional()
  @IsIn(EXAM_KINDS as unknown as string[])
  kind?: ExamKind;

  @IsString()
  @IsOptional()
  @IsIn(ORAL_LANGUAGES as unknown as string[])
  language?: OralLanguage;

  @IsString()
  @IsOptional()
  aiPrompt?: string;

  @IsInt()
  @IsOptional()
  @Min(2)
  @Max(60)
  maxMinutes?: number;

  @IsInt()
  @IsOptional()
  @Min(3)
  @Max(15)
  questionCount?: number;

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
