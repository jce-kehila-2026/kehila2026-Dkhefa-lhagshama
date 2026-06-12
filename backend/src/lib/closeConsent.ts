/**
 * Mutual-consent close for a request + its chat (req 25).
 *
 * Either the assigned volunteer or the beneficiary may PROPOSE a close; the
 * other party must APPROVE; once both sides approve, the request moves to
 * `closed` and its chat is marked inactive. Either side may DECLINE, which
 * clears the pending proposal. Admins keep the existing force-close path
 * (admin status endpoint) and are not required here.
 *
 * `request.closeRequest` shape:
 *   { proposedBy, proposedRole, proposedAt, volunteerApproved, beneficiaryApproved } | null
 */
import { FieldValue } from 'firebase-admin/firestore';

import { db } from '@/lib/firebaseAdmin';

export type CloseRole = 'volunteer' | 'beneficiary';
export type CloseAction = 'propose' | 'approve' | 'decline';

/** What effectively happened, for the caller's event trail (req 25). */
export type CloseEffect = 'proposed' | 'approved' | 'declined';

export interface CloseResult {
  /** HTTP-ish status for the route to surface. */
  status: 'ok' | 'not_found' | 'forbidden' | 'invalid_state';
  /** True when this action caused the request to actually close. */
  closed: boolean;
  /** Current close handshake state after the action (null if cleared). */
  closeRequest: Record<string, unknown> | null;
  /**
   * Effective action taken (an `approve` with no pending proposal starts a
   * fresh handshake, so it reports 'proposed'). Null when status !== 'ok'.
   */
  action: CloseEffect | null;
}

/** Statuses from which a consent-close is allowed. */
const CLOSEABLE = new Set(['in_progress', 'awaiting_review']);

/**
 * Apply a close-consent action. `actorUid` must already be authorized by the
 * caller as the given `role` for this request (route-level gate); this function
 * re-checks ownership defensively inside the transaction.
 */
export async function applyCloseConsent(
  requestId: string,
  role: CloseRole,
  actorUid: string,
  action: CloseAction,
): Promise<CloseResult> {
  const ref = db().collection('requests').doc(requestId);

  const result = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists)
      return { status: 'not_found', closed: false, closeRequest: null, action: null } as CloseResult;
    const data = snap.data() ?? {};

    const existing = (data.closeRequest as Record<string, unknown> | null | undefined) ?? null;

    // Defensive ownership check.
    const owns =
      role === 'beneficiary'
        ? data.beneficiaryId === actorUid
        : data.assignedVolunteerId === actorUid || data.handler === actorUid;
    if (!owns)
      return { status: 'forbidden', closed: false, closeRequest: null, action: null } as CloseResult;

    if (action === 'decline') {
      tx.update(ref, { closeRequest: null, updatedAt: FieldValue.serverTimestamp() });
      return { status: 'ok', closed: false, closeRequest: null, action: 'declined' } as CloseResult;
    }

    if (!CLOSEABLE.has(String(data.status))) {
      return { status: 'invalid_state', closed: false, closeRequest: null, action: null } as CloseResult;
    }

    // Build the next handshake state. propose (or approve with no existing
    // proposal) starts a fresh handshake with the proposer's side set.
    let next: Record<string, unknown>;
    let effect: CloseEffect;
    if (!existing || action === 'propose') {
      next = {
        proposedBy: actorUid,
        proposedRole: role,
        proposedAt: new Date().toISOString(),
        volunteerApproved: role === 'volunteer',
        beneficiaryApproved: role === 'beneficiary',
      };
      effect = 'proposed';
    } else {
      // approve an existing proposal — set this side true, keep the rest.
      next = {
        ...existing,
        volunteerApproved: existing.volunteerApproved === true || role === 'volunteer',
        beneficiaryApproved: existing.beneficiaryApproved === true || role === 'beneficiary',
      };
      effect = 'approved';
    }

    const bothApproved = next.volunteerApproved === true && next.beneficiaryApproved === true;

    if (bothApproved) {
      tx.update(ref, {
        status: 'closed',
        closeRequest: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'ok', closed: true, closeRequest: null, action: effect } as CloseResult;
    }

    tx.update(ref, { closeRequest: next, updatedAt: FieldValue.serverTimestamp() });
    return { status: 'ok', closed: false, closeRequest: next, action: effect } as CloseResult;
  });

  // When closed, mark the linked chat(s) inactive (outside the request tx).
  if (result.closed) {
    try {
      const chats = await db().collection('chats').where('requestId', '==', requestId).get();
      await Promise.all(
        chats.docs.map((c) =>
          c.ref.update({ active: false, updatedAt: FieldValue.serverTimestamp() }),
        ),
      );
    } catch {
      /* non-fatal: the request is closed; chat flag is best-effort */
    }
  }

  return result;
}
