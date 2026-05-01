import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Pass 1: Body for POST /ai/explain-answer.
 *
 * Used post-exercise when the student taps "Tushuntirish" — we ask Claude
 * for a kid-friendly Uzbek explanation of why their answer was wrong, plus
 * a one-line hint and 1-2 similar correct examples.
 */
export class ExplainAnswerDto {
  @IsString()
  @MaxLength(64)
  exerciseType!: string;

  @IsString()
  @MaxLength(500)
  question!: string;

  @IsString()
  @MaxLength(500)
  studentAnswer!: string;

  @IsString()
  @MaxLength(500)
  correctAnswer!: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  context?: string;
}

export interface ExplainAnswerResponse {
  explanation: string;
  hint: string;
  examples?: string[];
}
