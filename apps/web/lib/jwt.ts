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

export function getTenantIdFromToken(): string | null {
  return decodePayload()?.tenantId ?? null;
}

export function getRoleFromToken(): string | null {
  return decodePayload()?.role ?? null;
}
