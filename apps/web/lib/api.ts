const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<{ success: boolean; data: T; meta: { timestamp: string } }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> ?? {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const json = await res.json();

  if (!res.ok) throw new Error(json.error ?? 'So\'rov bajarilmadi');
  return json;
}
