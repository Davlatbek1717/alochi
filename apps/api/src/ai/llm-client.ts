import { GoogleGenAI, type Content } from '@google/genai';

/**
 * Lightweight LLM wrapper around the Google Gemini API.
 *
 * Targets gemini-2.5-flash by default — good multilingual quality + JSON
 * mode + low latency at a price A'lochi's usage comfortably absorbs.
 * Exposes the same shape the rest of the app already calls through:
 *   - chatText  — plain text responses (tutor chat, oral exam)
 *   - chatJson  — JSON-only responses (translation grader, error analyzer,
 *                 wrong-answer explainer)
 *
 * Both methods accept optional `apiKey` so callers that rotate through a
 * pool of keys (oral-exam.service per-attempt rotation) can keep the same
 * pattern they had with the previous wrapper.
 */

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCallOptions {
  /** Override the env-default model. */
  model?: string;
  /** API key to use for this single call. Falls back to GEMINI_API_KEY env. */
  apiKey?: string;
  /** Sampling temperature. Default 0.7 for chat, 0.2-0.4 for graders. */
  temperature?: number;
  /** Max output tokens. Default 8192. */
  maxTokens?: number;
  /** Nucleus sampling. Default 0.95. */
  topP?: number;
}

function buildClient(apiKey?: string): GoogleGenAI {
  const key = apiKey || process.env.GEMINI_API_KEY || '';
  if (!key) {
    // Throw immediately so callers' catch blocks fall through to their
    // strict-match / canned-response fallbacks instead of burning a
    // network round trip we know will 401. Keeps the student-facing
    // UX from hanging for the full SDK timeout when ops hasn't set
    // GEMINI_API_KEY yet.
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenAI({ apiKey: key });
}

/**
 * Split an OpenAI-style messages array into a system instruction string
 * (Gemini handles that separately) and a list of Content turns. Adjacent
 * user/assistant turns are kept as-is; assistant maps to Gemini's "model"
 * role.
 */
function toGeminiHistory(messages: ChatMessage[]): {
  systemInstruction?: string;
  contents: Content[];
} {
  const systemParts: string[] = [];
  const contents: Content[] = [];
  for (const m of messages) {
    if (!m.content) continue;
    if (m.role === 'system') {
      systemParts.push(m.content);
      continue;
    }
    const role = m.role === 'assistant' ? 'model' : 'user';
    contents.push({ role, parts: [{ text: m.content }] });
  }
  return {
    systemInstruction: systemParts.length ? systemParts.join('\n\n') : undefined,
    contents,
  };
}

/**
 * Race a promise against a hard timeout. The Gemini SDK does honour the
 * environment's fetch timeout but doesn't expose one in the constructor,
 * so we enforce ours at the call site to match the old NVIDIA wrapper.
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch((e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

const CALL_TIMEOUT_MS = 10_000;

/**
 * Google returns RESOURCE_EXHAUSTED (HTTP 429) with a `retryDelay` field
 * (e.g. "12s") when the per-minute quota is hit. We honour that delay
 * once before giving up, so a single rate-limit blip doesn't blow up
 * the caller's request. Capped at 8s so a misbehaving model can't
 * stretch the request past our outer timeout budget.
 */
const MAX_RETRY_WAIT_MS = 8_000;

function parseRetryDelayMs(err: unknown): number | null {
  if (!err) return null;
  const message = err instanceof Error ? err.message : String(err);
  // The Gemini SDK serialises the error response into the Error message.
  // We look for either the explicit retryDelay field or a 429 status code.
  const retryMatch = message.match(/"retryDelay":\s*"(\d+(?:\.\d+)?)s"/);
  if (retryMatch) {
    const seconds = parseFloat(retryMatch[1]);
    return Math.min(MAX_RETRY_WAIT_MS, Math.ceil(seconds * 1000) + 250);
  }
  if (/RESOURCE_EXHAUSTED|"code":\s*429|status\s*[:=]\s*429/i.test(message)) {
    return MAX_RETRY_WAIT_MS;
  }
  return null;
}

async function generateWithRetry<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T> {
  try {
    return await withTimeout(fn(), CALL_TIMEOUT_MS, label);
  } catch (err) {
    const wait = parseRetryDelayMs(err);
    if (wait === null) throw err;
    await new Promise((r) => setTimeout(r, wait));
    // One retry. If the second attempt still fails, bubble the original
    // shape so the caller's fallback path fires the same way it always has.
    return await withTimeout(fn(), CALL_TIMEOUT_MS, label);
  }
}

/**
 * Plain-text chat completion. Pass full message array (system + history +
 * latest user turn). Returns the assistant's reply, or empty string when
 * the model produced no content.
 */
export async function chatText(
  messages: ChatMessage[],
  options: LlmCallOptions = {},
): Promise<string> {
  const client = buildClient(options.apiKey);
  const { systemInstruction, contents } = toGeminiHistory(messages);
  const response = await generateWithRetry(
    () =>
      client.models.generateContent({
        model: options.model ?? DEFAULT_MODEL,
        contents,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          temperature: options.temperature ?? 0.7,
          topP: options.topP ?? 0.95,
          // Gemini 2.5 Flash burns budget on hidden "thinking" tokens before
          // emitting visible output. For chat where prompts are simple, the
          // think pass adds latency + cost without a meaningful quality lift,
          // so disable it by default.
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: options.maxTokens ?? 8192,
        },
      }),
    'chatText',
  );
  return response.text ?? '';
}

/**
 * JSON-mode chat completion. Returns the raw JSON string (still parse-and-
 * validate at the call site so we can apply our existing tolerant
 * parsers like AiService.parseGraderJson).
 */
export async function chatJson(
  messages: ChatMessage[],
  options: LlmCallOptions = {},
): Promise<string> {
  const client = buildClient(options.apiKey);
  const { systemInstruction, contents } = toGeminiHistory(messages);
  const response = await generateWithRetry(
    () =>
      client.models.generateContent({
        model: options.model ?? DEFAULT_MODEL,
        contents,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          temperature: options.temperature ?? 0.3,
          topP: options.topP ?? 0.95,
          // Disable thinking-token budget — graders just need a structured
          // JSON object, not an open-ended reasoning pass. Without this the
          // model exhausts maxOutputTokens on hidden thoughts and returns
          // empty visible text (finishReason MAX_TOKENS), forcing callers
          // into their string-match fallback every time.
          thinkingConfig: { thinkingBudget: 0 },
          maxOutputTokens: options.maxTokens ?? 1024,
          responseMimeType: 'application/json',
        },
      }),
    'chatJson',
  );
  return response.text ?? '';
}

/**
 * Convert the legacy Gemini chat format
 *   [{ role: 'user'|'model', content }]
 * into the OpenAI-style message array used by chatText. Exposed for tests +
 * callers that still build Gemini-style history arrays.
 */
export function geminiHistoryToOpenAi(
  history: { role: string; content: string }[],
): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const turn of history) {
    if (!turn.content) continue;
    const role: ChatMessage['role'] =
      turn.role === 'assistant' || turn.role === 'model' ? 'assistant' : 'user';
    out.push({ role, content: turn.content });
  }
  return out;
}

export const GEMINI_MODEL = DEFAULT_MODEL;
