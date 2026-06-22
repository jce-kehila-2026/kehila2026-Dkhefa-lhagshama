/**
 * apiClient — the single front door from the Next.js frontend to the Express backend.
 *
 * every call goes through here so the Firebase ID token is attached uniformly and
 * the base url is resolved consistently (relative '/api' in prod via the hosting
 * rewrite, localhost:3001 in dev). two exports: apiFetch (raw Response, used when
 * the caller wants status/headers/streaming) and apiJson (parses json + throws a
 * structured ApiError on non-2xx, used by read paths). callers should not call
 * fetch() against the backend directly.
 */
import { getIdToken } from './auth';

// base url for backend calls. empty string in prod (relative '/api', same-origin via
// hosting rewrite) so the ?? fallback only kicks in for local dev where the env is unset.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

// shape thrown by apiJson on a non-2xx response; detail holds the parsed error body.
export interface ApiError {
  status: number;
  error: string;
  detail?: unknown;
}

// fetch the backend with the caller's init, adding the auth header + default json content-type.
// returns the raw Response (does not throw on http errors). absolute urls bypass API_BASE.
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const idToken = await getIdToken();

  const headers = new Headers(init.headers);
  // default to json but let the caller override (e.g. multipart uploads set their own type)
  headers.set('Content-Type', headers.get('Content-Type') ?? 'application/json');
  // no token = anonymous call (public reads); backend rejects protected routes
  if (idToken) headers.set('Authorization', `Bearer ${idToken}`);

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  return fetch(url, { ...init, headers });
}

// apiFetch + json parse + throw ApiError on non-2xx. convenience for read paths that
// expect a typed body and treat any error status as exceptional.
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) {
    let body: unknown;
    // prefer json error body, fall back to raw text when the response isn't json
    try { body = await res.json(); } catch { body = await res.text(); }
    const err: ApiError = { status: res.status, error: `http_${res.status}`, detail: body };
    throw err;
  }
  return (await res.json()) as T;
}
