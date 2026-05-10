import OpenAI from 'openai';

/**
 * Lightweight LLM wrapper around the NVIDIA NIM OpenAI-compatible endpoint.
 *
 * Replaces the old @google/genai usage. We target MiniMax-M2.7 as the
 * primary model (good multilingual + JSON instruction following). The
 * single class shape exposes:
 *   - chatText  — plain text responses (tutor chat, oral exam)
 *   - chatJson  — JSON-only responses (translation grader, error analyzer,
 *                 wrong-answer explainer)
 *
 * Both methods accept optional `apiKey` so callers that rotate through a
 * pool of keys (oral-exam.service per-attempt rotation) can keep the same
 * pattern they had with GoogleGenAI.
 */

const NVIDIA_BASE_URL =
  process.env.NVIDIA_NIM_BASE_URL ?? 'https://integrate.api.nvidia.com/v1';

const DEFAULT_MODEL = process.env.NVIDIA_NIM_MODEL ?? 'minimaxai/minimax-m2.7';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmCallOptions {
  /** Override the env-default model. */
  model?: string;
  /** API key to use for this single call. Falls back to NVIDIA_API_KEY env. */
  apiKey?: string;
  /** Sampling temperature. Default 0.7 for chat, 0.2-0.4 for graders. */
  temperature?: number;
  /** Max output tokens. Default 8192 to mirror the NVIDIA NIM example. */
  maxTokens?: number;
  /** Nucleus sampling. Default 0.95. */
  topP?: number;
}

function buildClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.NVIDIA_API_KEY || '';
  return new OpenAI({ baseURL: NVIDIA_BASE_URL, apiKey: key });
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
  const completion = await client.chat.completions.create({
    model: options.model ?? DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    top_p: options.topP ?? 0.95,
    max_tokens: options.maxTokens ?? 8192,
  });
  return completion.choices?.[0]?.message?.content ?? '';
}

/**
 * JSON-mode chat completion. Caller must include "JSON" in the system or
 * user message — the OpenAI spec requires this when `response_format` is
 * set to `json_object`. Returns the raw JSON string (still parse-and-
 * validate at the call site so we can apply our existing tolerant
 * parsers like AiService.parseGraderJson).
 */
export async function chatJson(
  messages: ChatMessage[],
  options: LlmCallOptions = {},
): Promise<string> {
  const client = buildClient(options.apiKey);
  const completion = await client.chat.completions.create({
    model: options.model ?? DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.3,
    top_p: options.topP ?? 0.95,
    max_tokens: options.maxTokens ?? 1024,
    response_format: { type: 'json_object' },
  });
  return completion.choices?.[0]?.message?.content ?? '';
}

/**
 * Convert the legacy Gemini chat format
 *   [{ role: 'user'|'model', parts: [{text}] }]
 * into the OpenAI message format used by chatText. Exposed for tests +
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

export const NVIDIA_NIM_MODEL = DEFAULT_MODEL;
