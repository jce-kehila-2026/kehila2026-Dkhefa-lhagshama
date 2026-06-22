/**
 * Shared helpers for the /api/admin/requests handler modules (#75).
 *
 * Extracted verbatim from the original single-file router so behavior is
 * preserved exactly. Used across the status / refer / archive handlers.
 */
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/lib/firebaseAdmin';
import { type RequestStatus } from '@/routes/requests';

// ── Chat lifecycle consistency ─────────────────────────────────────────────
// `chats.active` must be false on ALL request end states (closed, rejected,
// referred), not just the mutual-consent close. Mirrors closeConsent.ts:
// best-effort update of every chat linked to the request, never fatal.
export const CHAT_END_STATES = new Set<RequestStatus>(['closed', 'rejected', 'referred']);

export async function setChatsActiveForRequest(requestId: string, active: boolean): Promise<void> {
  try {
    const chats = await db().collection('chats').where('requestId', '==', requestId).get();
    await Promise.all(
      chats.docs.map((c) =>
        c.ref.update({ active, updatedAt: FieldValue.serverTimestamp() }),
      ),
    );
  } catch {
    /* non-fatal: the request write committed; the chat flag is best-effort */
  }
}

/** Thrown inside the transaction to bail out with a specific HTTP status. */
export class TransitionError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'TransitionError';
  }
}
