import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Pass 1: Body for POST /ai/tts.
 *
 * Originally Uzbek-only (Pass 25.H.3). Now accepts `language: 'en' | 'uz'`
 * so the same endpoint serves listening / spelling exercises (English) AND
 * vocabulary playback (Uzbek). When the language is omitted we keep the
 * legacy English default for back-compat with older callers.
 */
export class TtsDto {
  @IsString()
  @MaxLength(500)
  text!: string;

  @IsIn(['en', 'uz'])
  @IsOptional()
  language?: 'en' | 'uz';

  /** English accent: 'us' (American, default) or 'uk' (British). */
  @IsIn(['us', 'uk'])
  @IsOptional()
  accent?: 'us' | 'uk';

  @IsString()
  @IsOptional()
  voice?: string;
}

export interface TtsResponse {
  audioBase64: string;
  mimeType: string;
}
