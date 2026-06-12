/**
 * Shared best-effort display-name resolution for ANY uid (not just volunteers).
 *
 * The users/{uid} Firestore mirror is lazily created (and its displayName is
 * often empty), so name lookups fall through a chain of sources:
 *   1. users/{uid}.displayName, then firstName + lastName
 *   2. volunteers/{uid}.fullName / .name (volunteer roster keeps real names)
 *   3. Firebase Auth displayName
 *   4. Firebase Auth email local part (e.g. "e2e.bene" from e2e.bene@pff.test)
 * Returns null when nothing resolves — callers pick their own fallback (uid).
 *
 * Used by the chat participants endpoint (rail + bubbles), the admin chats
 * oversight list, and by the system messages that denormalize the affected
 * user's name at write time, so a removed participant keeps a readable name
 * in history. `volunteerDisplayName` below wraps the same chain for callers
 * that denormalize a volunteer's name into request docs.
 */
import { auth, db } from '@/lib/firebaseAdmin';

export async function resolveDisplayName(uid: string): Promise<string | null> {
  try {
    const userSnap = await db().collection('users').doc(uid).get();
    const u = userSnap.exists
      ? (userSnap.data() as {
          displayName?: string;
          firstName?: string;
          lastName?: string;
        })
      : null;
    const fromUsers =
      (typeof u?.displayName === 'string' && u.displayName.trim()) ||
      [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim();
    if (fromUsers) return fromUsers;

    const volSnap = await db().collection('volunteers').doc(uid).get();
    const v = volSnap.exists
      ? (volSnap.data() as { fullName?: string; name?: string })
      : null;
    const fromVolunteers =
      (typeof v?.fullName === 'string' && v.fullName.trim()) ||
      (typeof v?.name === 'string' && v.name.trim());
    if (fromVolunteers) return fromVolunteers;

    const rec = await auth().getUser(uid);
    if (rec.displayName?.trim()) return rec.displayName.trim();
    const emailLocal = rec.email?.split('@')[0]?.trim();
    return emailLocal || null;
  } catch {
    return null;
  }
}

/**
 * Best-effort display name for a volunteer, falling back to email/uid.
 * Used where a volunteer's name is denormalized onto request docs (claim/drop
 * notes, the admin list's `assignedVolunteerName`) so those flows resolve
 * through the exact same chain as the chat rail and the admin chats list.
 */
export async function volunteerDisplayName(uid: string, email?: string): Promise<string> {
  return (await resolveDisplayName(uid)) ?? email ?? uid;
}
