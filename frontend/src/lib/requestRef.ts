/**
 * Friendly request reference renderer (WS-3).
 *
 * Single source of truth for how a request is labeled in the UI. Every surface
 * that used to print the raw 36-char UUID (my-requests, chat list, chat rail,
 * admin chats/requests) now calls formatRequestRef instead. Invariant: prefer
 * the server-allocated `displayId` ("REQ-0042"); fall back to a short,
 * recognizable slice of the UUID for any doc that predates the field and has
 * not been backfilled yet. The full UUID is never shown to users.
 */

/** Short fallback for a request that has no displayId yet: first 8 UUID chars. */
export function shortFallback(uuid: string | null | undefined): string {
  const s = String(uuid ?? '').trim();
  if (!s) return '';
  return s.slice(0, 8);
}

/**
 * Render the reference for a request-like object. Accepts either the full id or
 * a `{ displayId, id }` shape so call sites can pass whichever they hold.
 */
export function formatRequestRef(
  req: { displayId?: string | null; id?: string | null } | null | undefined,
): string {
  if (!req) return '';
  const did = typeof req.displayId === 'string' ? req.displayId.trim() : '';
  if (did) return did;
  return shortFallback(req.id);
}
