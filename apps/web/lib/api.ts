const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface ApiErrorPayload {
  code?: string;
  message?: string;
  details?: unknown;
}

export class ApiError extends Error {
  code?: string;
  details?: unknown;
  status: number;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiSuccessEnvelope<T> {
  success: boolean;
  data: T;
  meta: { timestamp: string };
}

/**
 * apiRequest — calls API and returns the standard envelope:
 *   { success, data, meta:{ timestamp } }.
 *
 * Back-compat: if the API returns a non-enveloped JSON body (legacy endpoint
 * during Phase 3 rollout, or skipped wrapper for Stream/Buffer responses),
 * the body is wrapped client-side into the same shape so callers always read
 * `res.data` consistently.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<ApiSuccessEnvelope<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // 204 / empty body
  const text = await res.text();
  const json: unknown = text ? safeParseJson(text) : null;

  if (!res.ok) {
    const errObj =
      json && typeof json === 'object'
        ? (json as { error?: ApiErrorPayload; message?: string })
        : null;
    const code = errObj?.error?.code;
    const message =
      errObj?.error?.message ??
      errObj?.message ??
      (typeof json === 'string' ? json : undefined) ??
      "So'rov bajarilmadi";
    const details = errObj?.error?.details;
    throw new ApiError(message, res.status, code, details);
  }

  // Already enveloped (Phase 3 ResponseInterceptor) — pass through.
  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in (json as Record<string, unknown>)
  ) {
    return json as ApiSuccessEnvelope<T>;
  }

  // Back-compat: wrap raw legacy bodies so callers can keep using `.data`.
  return {
    success: true,
    data: json as T,
    meta: { timestamp: new Date().toISOString() },
  };
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
