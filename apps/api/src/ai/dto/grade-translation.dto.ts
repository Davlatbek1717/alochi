import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Pass 1: Body for POST /ai/grade-translation.
 *
 * Used by the `translate` exercise type — the student types an English
 * translation of an Uzbek prompt (or vice-versa) and we ask Claude for a
 * fuzzy grade that forgives typos / synonyms / capitalisation.
 */
export class GradeTranslationDto {
  @IsString()
  @MaxLength(500)
  sourceText!: string;

  @IsIn(['en', 'uz'])
  targetLanguage!: 'en' | 'uz';

  @IsString()
  @MaxLength(500)
  studentAnswer!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  context?: string;
}

export interface GradeTranslationResponse {
  correct: boolean;
  score: number;
  feedback: string;
  accepted_answers?: string[];
}
