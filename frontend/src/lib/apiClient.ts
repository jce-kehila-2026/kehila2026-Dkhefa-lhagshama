/**
 * apiFetch — thin wrapper around fetch() that attaches the Firebase ID token
 * to every request. Use this for any call to the Express backend.
 *
 * Example:
 *   const res = await apiFetch('/api/me');
 *   if (res.ok) { const me = await res.json(); ... }
 */
import { getIdToken } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

export interface ApiError {
  status: number;
  error: string;
  detail?: unknown;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const idToken = await getIdToken();

  const headers = new Headers(init.headers);
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  if (idToken) headers.set('Authorization', `Bearer ${idToken}`);

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, { ...init, headers });
}

/** apiFetch + json parse + throw on non-2xx. Convenience for read paths. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    let body: unknown;
    try { body = await res.json(); } catch { body = await res.text(); }
    const err: ApiError = { status: res.status, error: `http_${res.status}`, detail: body };
    throw err;
  }
  return (await res.json()) as T;
}
