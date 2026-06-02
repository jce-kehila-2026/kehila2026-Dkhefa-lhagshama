/**
 * Short-lived signed-URL helper.
 *
 * Avatars (and other PII-bearing assets) are NOT publicly readable — Storage
 * rules deny client reads. The backend mints a short-TTL signed read URL on
 * demand so only authorized callers (the owner, chat participants, …) ever
 * receive a working link, and the link expires quickly.
 *
 * Mirrors the TTL chosen in uploads.ts (1 hour). Reused by the profile-avatar
 * and chat-participants endpoints.
 */
import { storage } from '@/lib/firebaseAdmin';

/** Default signed-URL lifetime: 1 hour. */
export const SIGNED_URL_TTL_MS = 60 * 60 * 1000;

/**
 * Mint a short-lived signed read URL for a Storage object path.
 *
 * @param storagePath Object path within the bucket, e.g. `avatars/{uid}/avatar.png`.
 * @param ttlMs       Lifetime in milliseconds (default 1h).
 * @returns A signed read URL, or `null` when no path is given.
 */
export async function mintSignedReadUrl(
  storagePath: string | null | undefined,
  ttlMs: number = SIGNED_URL_TTL_MS,
): Promise<string | null> {
  if (!storagePath) return null;
  const [url] = await storage()
    .file(storagePath)
    .getSignedUrl({ action: 'read', expires: Date.now() + ttlMs });
  return url;
}
