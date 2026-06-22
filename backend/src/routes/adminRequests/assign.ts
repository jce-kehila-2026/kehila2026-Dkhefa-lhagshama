/**
 * POST /api/admin/requests/:id/assign — assign a volunteer (#75).
 *
 * Extracted verbatim from the original single-file router.
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

// ── POST /api/admin/requests/:id/assign ──────────────────────────────────
// Body: { volunteerId: string }
// Sets assignedVolunteerId + assignedAt, fires 'assigned' event.
// Also calls ensureChatForRequest to create/guarantee a chat (#71).
const assignSchema = z.object({
  volunteerId: z.string().min(1),
});

export async function assignVolunteer(req: Request, res: Response): Promise<void> {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const { volunteerId } = parsed.data;
  const requestId = req.params.id;
  const actorId = req.user!.uid;

  try {
    const ref = db().collection('requests').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const data = snap.data()!;

    // Reject assignment on a terminal request (closed/referred/rejected):
    // assigning would create an active chat on a dead request and fire a
    // misleading "assigned" notification. The admin UI also disables the
    // control for these states; this 409 is the hard server-side guard.
    const TERMINAL_STATUSES = new Set(['closed', 'referred', 'rejected']);
    if (TERMINAL_STATUSES.has(data.status as string)) {
      res.status(409).json({ error: 'request_terminal' });
      return;
    }

    // Verify the target is a real, active volunteer before granting it
    // handler-level access. Downstream authorization keys off
    // handler/assignedVolunteerId (the staff projection serves internal notes +
    // national ID, and the chat participant guard lets that uid read/post the
    // beneficiary's chat), so a fat-fingered or pasted-wrong uid (a
    // beneficiary's, or a deactivated volunteer's) would otherwise silently
    // expose one request's PII. Mirror the terminal-status guard's 409 shape.
    const volSnap = await db().collection('volunteers').doc(volunteerId).get();
    if (!volSnap.exists || volSnap.data()?.active !== true) {
      res.status(409).json({ error: 'volunteer_inactive' });
      return;
    }

    const prevVolunteerId = data.assignedVolunteerId ?? null;

    // Assigning a volunteer to a still-pending request also starts the work:
    // move pending → in_progress so the status reflects reality without a
    // separate "Start handling" click. Re-assigning a request that is already
    // in_progress / awaiting_review leaves its status untouched.
    const willStart = (data.status as string) === 'pending';

    // Denormalize the display name so list views never need an N+1 lookup
    // (and former volunteers keep a readable name after deactivation).
    const assignedVolunteerName = await volunteerDisplayName(volunteerId);

    await ref.update({
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

    // Create chat between beneficiary and volunteer (#71). Admin task requests
    // (req 20) have no beneficiary, so there is no one to open a chat with —
    // skip chat creation for them (otherwise participants would contain
    // `undefined` and the write fails).
    const beneficiaryId = data.beneficiaryId as string | undefined;
    if (beneficiaryId) {
      await ensureChatForRequest({
        requestId,
        beneficiaryId,
        volunteerId,
        // Re-assign: drop the former volunteer from the chat so they lose
        // read/write/attachment access to a case they no longer serve (req 13).
        prevVolunteerId,
      });
    }

    // Notify the beneficiary that a volunteer was put on their request (req 27).
    // Fire-and-forget: never let a notification failure break the response.
    void notifyBeneficiaryOfRequest(requestId, 'accepted').catch((err) => {
      console.error('[adminRequests] notify accepted failed:', err);
    });

    res.json({ ok: true, status: willStart ? 'in_progress' : (data.status as string) });
  } catch (err) {
    console.error('[adminRequests] POST /:id/assign:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}
