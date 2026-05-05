/**
 * Pass 1: Shared TypeScript interfaces for the 9 new Duolingo-style
 * exercise component configs. Each interface mirrors the JSON shape stored
 * in `LessonComponent.config` for that `type`.
 *
 * Pass 2-4 student-side components import from here. Pass 5 reuses the
 * same shapes for the superadmin lesson configurator forms, ensuring the
 * editor and the runner agree byte-for-byte on what's stored.
 *
 * Keep these in sync with the corresponding entries in
 * `apps/api/src/lessons/dto/create-component.dto.ts` (`COMPONENT_TYPES`).
 */

/** A — Uzbek prompt → English text input. AI grades fuzzy. */
export interface TranslateConfig {
  /** The Uzbek (or English, if `targetLanguage='uz'`) prompt shown to the student. */
  sourceText: string;
  /** The canonical correct answer used for fallback matching. */
  correctAnswer: string;
  /** Direction: which language the student is typing IN. */
  targetLanguage?: 'en' | 'uz';
  /** Optional list of additional accepted variants (offline grading). */
  acceptedAnswers?: string[];
  /** Optional hint shown if the student taps the "?" button. */
  hint?: string;
}

/** B — Audio plays English text, student picks 1 of 4 options. */
export interface ListenPickConfig {
  /** English text to be spoken via /ai/tts (language='en'). */
  text: string;
  options: { id: string; label: string; imageUrl?: string }[];
  correctOptionId: string;
}

/** C — Audio plays English text, student types what they heard. */
export interface ListenTypeConfig {
  /** English text to be spoken via /ai/tts (language='en'). */
  text: string;
  /** Optional list of additional accepted variants. */
  acceptedAnswers?: string[];
  /** Optional context hint passed to the grader. */
  context?: string;
}

/** D — Match Uzbek/English pairs (memory game). 4-6 pairs typical. */
export interface MatchPairsConfig {
  pairs: { left: string; right: string }[];
}

/** E — Given an English word, pick the matching picture (1 of 4). */
export interface PickPictureConfig {
  /** English word the student must visually identify. */
  word: string;
  options: { id: string; imageUrl: string }[];
  correctOptionId: string;
}

/** F — Sentence with one missing word; tap or type. */
export interface FillBlankConfig {
  /** Sentence with `___` marking the blank. e.g. "The ___ is red". */
  sentence: string;
  /** The correct fill word/phrase. */
  blank: string;
  /** Optional alternative correct fills (synonyms). */
  acceptedAnswers?: string[];
  /** Word bank for tap mode; if omitted, student types the answer. */
  alternatives?: string[];
}

/** G — Audio plays English word, student spells it letter-by-letter. */
export interface SpellingConfig {
  /** English word the student spells. */
  word: string;
  /** Whether to autoplay TTS on mount (default true). */
  audioPlay?: boolean;
}

/** H — Drag sentences into the correct order. */
export interface OrderSentencesConfig {
  /** Sentences in their CORRECT order; the UI shuffles for display. */
  sentences: string[];
}

/** I — Read a full English sentence aloud (pronunciation scoring). */
export interface SpeakSentenceConfig {
  /** English sentence the student reads. */
  sentence: string;
  /** Pass threshold (0-100). Defaults to 70 client-side. */
  minScore?: number;
}

/**
 * J — Word-by-word read-aloud exercise (Monkeytype-style coloring).
 * The student speaks each word in sequence; live STT marks each word
 * green (correct), red (wrong with correct-pronunciation playback),
 * or active (currently expected). Passes when the % of correct words
 * meets `minScore`. Always en-US, browser SpeechRecognition only —
 * no server fallback because there is no server-side word-stream API.
 */
export interface SpeakWordsConfig {
  /** Full English text the student reads. Auto-tokenized on whitespace. */
  text: string;
  /** Pass threshold = % of correctly-pronounced words. Default 70. */
  minScore?: number;
}

/**
 * Discriminated union of every new component's `(type, config)` pair.
 * Pass 2-4 lesson runners narrow on `type` and pull the typed `config`.
 */
export type NewExerciseComponent =
  | { type: 'translate'; config: TranslateConfig }
  | { type: 'listen_pick'; config: ListenPickConfig }
  | { type: 'listen_type'; config: ListenTypeConfig }
  | { type: 'match_pairs'; config: MatchPairsConfig }
  | { type: 'pick_picture'; config: PickPictureConfig }
  | { type: 'fill_blank'; config: FillBlankConfig }
  | { type: 'spelling'; config: SpellingConfig }
  | { type: 'order_sentences'; config: OrderSentencesConfig }
  | { type: 'speak_sentence'; config: SpeakSentenceConfig }
  | { type: 'speak_words'; config: SpeakWordsConfig };

/**
 * String literal of every new component type. Used by Pass 5's
 * configurator drop-down. Mirrors COMPONENT_TYPES in the API DTO.
 */
export const NEW_EXERCISE_TYPES = [
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

export type NewExerciseType = (typeof NEW_EXERCISE_TYPES)[number];
