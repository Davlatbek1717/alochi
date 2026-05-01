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

  /**
   * Canonical correct answer from the lesson config. Used (a) as ground
   * truth in the strict-match fallback when the AI call fails, and (b) as
   * an extra signal in the prompt so the AI doesn't have to re-guess the
   * "right" translation. Optional so existing callers keep working.
   */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  correctAnswer?: string;

  /**
   * Additional valid translations from lesson config. Used in the strict
   * fallback so authors can teach common variants ("I'm a student",
   * "I am a pupil", etc.) without re-validating through the AI.
   */
  @IsOptional()
  acceptedAnswers?: string[];

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
