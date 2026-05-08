/**
 * Minimal JWT helpers for the web app. We never verify signatures here —
 * the backend is the source of truth. These are read-only helpers used to
 * derive scoping fields (branchId, groupId) from the access token so we
 * can issue properly scoped API calls.
 */

interface AccessTokenPayload {
  sub?: string;
  role?: string;
  tenantId?: string;
  branchId?: string | null;
  groupId?: string | null;
}

function decodePayload(): AccessTokenPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const token = localStorage.getItem('accessToken');
    if (!token) return null;
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part)) as AccessTokenPayload;
  } catch {
    return null;
  }
}

export function getBranchIdFromToken(): string | null {
  return decodePayload()?.branchId ?? null;
}

export function getGroupIdFromToken(): string | null {
  return decodePayload()?.groupId ?? null;
}

/**
 * Live groupId — falls back to /users/my-profile when the JWT's
 * groupId is stale (e.g. an admin re-assigned the user to a group
 * AFTER their token was issued). Use this in dashboards where the
 * group can change while the user is logged in.
 */
export async function fetchMyGroupId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  // JWT first — if it already has a value, trust it (cheap, no network).
  const fromToken = decodePayload()?.groupId ?? null;
  if (fromToken) return fromToken;
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    if (!token) return null;
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${base}/users/my-profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { groupId?: string | null } };
    return json?.data?.groupId ?? null;
  } catch {
    return null;
  }
}

/**
 * Live branchId — same fallback semantics as fetchMyGroupId.
 */
export async function fetchMyBranchId(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const fromToken = decodePayload()?.branchId ?? null;
  if (fromToken) return fromToken;
  try {
    const token = localStorage.getItem('accessToken') ?? '';
    if (!token) return null;
    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${base}/users/my-profile`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { branchId?: string | null } };
    return json?.data?.branchId ?? null;
  } catch {
    return null;
  }
}

export function getTenantIdFromToken(): string | null {
  return decodePayload()?.tenantId ?? null;
}

export function getRoleFromToken(): string | null {
  return decodePayload()?.role ?? null;
}

/** Returns the authenticated user's own ID (JWT `sub` claim). */
export function getSubFromToken(): string | null {
  return decodePayload()?.sub ?? null;
}
