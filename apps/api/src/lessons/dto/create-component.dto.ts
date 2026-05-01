import { IsIn, IsObject, IsOptional } from 'class-validator';

/**
 * Pass 1: Allowed exercise component `type` values.
 *
 * Stored as a `String` in Postgres (loose enum) to avoid brittle ENUM
 * migrations every time we add a type. Strict enumeration is enforced at
 * the DTO layer via `@IsIn(COMPONENT_TYPES)`.
 *
 * Legacy types (Pass 0):
 *   - `mcq`            — multiple choice questions
 *   - `word_order`     — drag words to form a sentence
 *   - `vocabulary`     — Uzbek/English flashcards
 *
 * New Duolingo-style types (Pass 1 foundation, Pass 2-4 UIs):
 *   - `translate`        (A) — type the English translation of an Uzbek prompt
 *   - `listen_pick`      (B) — listen to English audio, pick correct option
 *   - `listen_type`      (C) — listen to English audio, type what you heard
 *   - `match_pairs`      (D) — match Uzbek/English pairs (memory game)
 *   - `pick_picture`     (E) — given English word, pick matching picture (1 of 4)
 *   - `fill_blank`       (F) — sentence with a missing word
 *   - `spelling`         (G) — listen and spell English word letter-by-letter
 *   - `order_sentences`  (H) — drag sentences into the correct order
 *   - `speak_sentence`   (I) — read full English sentence aloud (pronunciation)
 */
export const COMPONENT_TYPES = [
  'mcq',
  'word_order',
  'vocabulary',
  'translate',
  'listen_pick',
  'listen_type',
  'match_pairs',
  'pick_picture',
  'fill_blank',
  'spelling',
  'order_sentences',
  'speak_sentence',
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export class CreateLessonComponentDto {
  @IsIn(COMPONENT_TYPES as unknown as string[])
  type!: ComponentType;

  @IsObject()
  config!: Record<string, unknown>;
}

export class UpdateLessonComponentDto {
  @IsIn(COMPONENT_TYPES as unknown as string[])
  @IsOptional()
  type?: ComponentType;

  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;
}
