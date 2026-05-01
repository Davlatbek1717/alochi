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

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Single-flight refresh. Multiple parallel 401s share one /auth/refresh call —
 * otherwise the first refresh would invalidate the second's stale refresh token.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        // Refresh itself failed — clear creds; caller will redirect to /login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return null;
      }
      const json = (await res.json()) as
        | RefreshResponse
        | ApiSuccessEnvelope<RefreshResponse>;
      const data: RefreshResponse =
        'data' in json ? json.data : (json as RefreshResponse);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      return data.accessToken;
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function isLikelyAuthEndpoint(path: string): boolean {
  return path.startsWith('/auth/login') || path.startsWith('/auth/refresh');
}

/**
 * apiRequest — calls API and returns the standard envelope:
 *   { success, data, meta:{ timestamp } }.
 *
 * On 401 with an expired access token, this will silently:
 *   1. Call /auth/refresh with the stored refresh token (single-flight)
 *   2. Retry the original request once with the new access token
 *   3. If refresh fails → throw ApiError(401) so caller can redirect to /login
 *
 * Back-compat: if the API returns a non-enveloped JSON body, the body is
 * wrapped client-side into the same shape so callers always read `res.data`.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<ApiSuccessEnvelope<T>> {
  // Resolve token: prefer explicit arg, fall back to localStorage (most callers
  // pass token explicitly, but reading from storage covers the rest and lets
  // the retry below pick up a freshly refreshed token).
  let activeToken: string | undefined =
    token ??
    (typeof window !== 'undefined'
      ? localStorage.getItem('accessToken') ?? undefined
      : undefined);

  const result = await doFetch<T>(path, options, activeToken);
  if (
    result.kind === 'unauthorized' &&
    !isLikelyAuthEndpoint(path) &&
    typeof window !== 'undefined'
  ) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      activeToken = refreshed;
      const retry = await doFetch<T>(path, options, activeToken);
      if (retry.kind === 'success') return retry.envelope;
      throw retry.error;
    }
    // Refresh failed — surface the original 401 so the caller / global handler
    // can route to /login. The toast message is preserved.
    throw result.error;
  }

  if (result.kind === 'success') return result.envelope;
  throw result.error;
}

type FetchResult<T> =
  | { kind: 'success'; envelope: ApiSuccessEnvelope<T> }
  | { kind: 'unauthorized'; error: ApiError }
  | { kind: 'error'; error: ApiError };

async function doFetch<T>(
  path: string,
  options: RequestInit,
  token: string | undefined,
): Promise<FetchResult<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
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
    const error = new ApiError(message, res.status, code, details);
    return res.status === 401
      ? { kind: 'unauthorized', error }
      : { kind: 'error', error };
  }

  if (
    json &&
    typeof json === 'object' &&
    'success' in json &&
    'data' in (json as Record<string, unknown>)
  ) {
    return { kind: 'success', envelope: json as ApiSuccessEnvelope<T> };
  }

  return {
    kind: 'success',
    envelope: {
      success: true,
      data: json as T,
      meta: { timestamp: new Date().toISOString() },
    },
  };
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
