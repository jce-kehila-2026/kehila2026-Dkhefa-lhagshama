/**
 * Admin "assign a volunteer to a request" handler (#75), mounted as
 * POST /api/admin/requests/:id/assign on the adminRequests router.
 *
 * Responsibility: atomically bind a request to one active volunteer and bring
 * the surrounding state in sync. Sets handler/assignedVolunteerId (the key
 * downstream authorization reads), denormalizes the volunteer name, auto-starts
 * a pending request, clears the claim pool, logs an audit + request-event trail,
 * guarantees the beneficiary<->volunteer chat, and notifies the beneficiary.
 *
 * Invariant the guards protect: only an active, real volunteer may be assigned,
 * and never to a terminal (closed/referred/rejected) request. Both matter
 * because the assignment hands out request PII (staff projection + chat access).
 *
 * Collaborates with: firebaseAdmin (db), audit, requestEvents, notify,
 * displayName, chatOnAssign.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { notifyBeneficiaryOfRequest } from '@/lib/notify';
import { volunteerDisplayName } from '@/lib/displayName';
import { ensureChatForRequest } from '@/lib/chatOnAssign';
import { TransitionError } from './shared';

// ── POST /api/admin/requests/:id/assign ──────────────────────────────────
// Body: { volunteerId: string }
// Sets assignedVolunteerId + assignedAt, fires 'assigned' event.
// Also calls ensureChatForRequest to create/guarantee a chat (#71).
const assignSchema = z.object({
  volunteerId: z.string().min(1),
});

// Validates body {volunteerId}, runs the not-found/terminal/inactive guards,
// then performs the assign write + side effects. Responds 200 {ok, status}
// (status reflects the auto-start), or 400/404/409/500 on the failure paths.
export async function assignVolunteer(req: Request, res: Response): Promise<void> {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const { volunteerId } = parsed.data;
  const requestId = req.params.id;
  const actorId = req.user!.uid;

  const ref = db().collection('requests').doc(requestId);
  const volRef = db().collection('volunteers').doc(volunteerId);

  // Denormalize the display name so list views never need an N+1 lookup (and
  // former volunteers keep a readable name after deactivation). Computed BEFORE
  // the transaction on purpose: it is a best-effort DISPLAY value resolved via
  // its own users/volunteers/Auth chain, not part of the race-critical state, so
  // it does not need to be transactional.
  const assignedVolunteerName = await volunteerDisplayName(volunteerId);

  // Terminal states a request can never be assigned out of.
  const TERMINAL_STATUSES = new Set(['closed', 'referred', 'rejected']);

  // Captured inside the transaction, consumed by the post-commit side effects.
  let prevVolunteerId: string | null = null;
  let willStart = false;
  let currentStatus = '';
  let beneficiaryId: string | undefined;

  try {
    // RACE FIX (audit MODERATE): assign was the only lifecycle writer doing a
    // plain .get()-then-.update(). If a mutual-consent close or an admin status
    // change committed BETWEEN the read and the write, assign's terminal guard
    // saw the stale (pre-close) snapshot and re-bound a now-closed request — an
    // illegal transition that also re-granted chat/PII access on a dead case.
    // Doing the read-check-write inside a transaction makes Firestore detect the
    // conflict and abort (retried, then surfaced as 409), so a concurrent
    // transition can never be clobbered. Mirrors status.ts / done.ts.
    await db().runTransaction(async (tx) => {
      // Firestore requires ALL reads before ANY write in a transaction.
      const snap = await tx.get(ref);
      const volSnap = await tx.get(volRef);

      if (!snap.exists) throw new TransitionError(404, 'not_found');
      const data = snap.data()!;

      // Reject assignment on a terminal request (closed/referred/rejected):
      // assigning would create an active chat on a dead request and fire a
      // misleading "assigned" notification.
      currentStatus = (data.status as string) ?? '';
      if (TERMINAL_STATUSES.has(currentStatus)) {
        throw new TransitionError(409, 'request_terminal');
      }

      // Verify the target is a real, ACTIVE volunteer before granting it
      // handler-level access. Downstream authorization keys off
      // handler/assignedVolunteerId (the staff projection serves internal notes
      // + national ID, and the chat participant guard lets that uid read/post
      // the beneficiary's chat), so a fat-fingered/pasted-wrong or deactivated
      // uid would otherwise expose one request's PII. Read inside the txn so a
      // concurrent deactivation cannot slip through.
      if (!volSnap.exists || volSnap.data()?.active !== true) {
        throw new TransitionError(409, 'volunteer_inactive');
      }

      prevVolunteerId = (data.assignedVolunteerId as string | null) ?? null;
      beneficiaryId = data.beneficiaryId as string | undefined;
      // Assigning to a still-pending request also starts the work
      // (pending → in_progress); re-assigning an in_progress / awaiting_review
      // request leaves its status untouched.
      willStart = currentStatus === 'pending';

      tx.update(ref, {
        assignedVolunteerId: volunteerId,
        assignedVolunteerName,
        assignedAt: FieldValue.serverTimestamp(),
        handler: volunteerId,
        ...(willStart ? { status: 'in_progress' } : {}),
        // Claim flow (req 22): the chosen volunteer wins the pool; any other
        // pending claims are dropped and the request leaves the available pool.
        poolStatus: 'none',
        hasClaims: false,
        claims: [],
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof TransitionError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    // gRPC ABORTED (code 10): the txn lost a race after retries — a genuine
    // concurrent/stale write. Surface 409 (matches status.ts).
    if ((err as { code?: number }).code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    console.error('[adminRequests] POST /:id/assign:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  // ── Post-commit side effects (run only after the assign write committed) ──
  // The audit trail + request events are bookkeeping: log a failure but still
  // report success so the admin UI reflects the committed state.
  try {
    await writeRequestEvent({
      requestId,
      type: 'assigned',
      actorId,
      visibility: 'all',
      details: { volunteerId, prevVolunteerId },
    });

    if (willStart) {
      await writeRequestEvent({
        requestId,
        type: 'status_changed',
        actorId,
        visibility: 'all',
        details: { from: 'pending', to: 'in_progress', via: 'assign' },
      });
    }

    await writeAuditLog({
      actorId,
      action: 'request.assign',
      entityType: 'requests',
      entityId: requestId,
      details: { volunteerId, prevVolunteerId },
    });
  } catch (err) {
    console.error('[adminRequests] POST /:id/assign side-effects:', err);
  }

  // Create/sync the beneficiary<->volunteer chat (#71). Admin task requests
  // (req 20) have no beneficiary, so skip (participants would contain
  // `undefined` and the write would fail).
  if (beneficiaryId) {
    try {
      await ensureChatForRequest({
        requestId,
        beneficiaryId,
        volunteerId,
        // Re-assign: drop the former volunteer from the chat so they lose
        // read/write/attachment access to a case they no longer serve (req 13).
        prevVolunteerId,
      });
    } catch (err) {
      // Do NOT 500 here — the assignment already committed (audit: a chat-sync
      // failure must not leave the request pointing at the new volunteer while
      // the client sees an error). Log loudly so the drift is visible.
      console.error('[adminRequests] POST /:id/assign chat-sync failed:', err);
    }
  }

  // Notify the beneficiary that a volunteer was put on their request (req 27).
  // Fire-and-forget: never let a notification failure break the response.
  void notifyBeneficiaryOfRequest(requestId, 'accepted').catch((err) => {
    console.error('[adminRequests] notify accepted failed:', err);
  });

  res.json({ ok: true, status: willStart ? 'in_progress' : currentStatus });
}
