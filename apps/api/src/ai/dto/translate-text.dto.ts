import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for POST /ai/translate-text — the student-facing translator
 * tool. Source language is required so the model knows which direction
 * to go; targetLanguage is the opposite.
 */
export class TranslateTextDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text!: string;

  @IsString()
  @IsIn(['uz', 'en'])
  fromLang!: 'uz' | 'en';

  @IsString()
  @IsIn(['uz', 'en'])
  toLang!: 'uz' | 'en';
}

export interface TranslateTextResponse {
  translation: string;
  note?: string;
}
