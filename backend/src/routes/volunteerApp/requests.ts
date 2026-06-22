/**
 * Assignee-side request operations for /api/volunteer:
 *   PATCH /requests/:id        — edit urgency/deadline (req 17)
 *   POST  /requests/:id/drop   — drop back to the pool (req 18)
 *   POST  /requests/:id/close  — mutual-consent close handshake (req 25 + 27)
 *
 * Shared invariant: the router already gates these to volunteer/admin; each
 * handler additionally re-checks that the caller is the assigned volunteer
 * (admins bypass). All mutations go through the firebase-admin SDK and emit a
 * requestEvent (visibility 'all', so the beneficiary's timeline updates) plus
 * an audit log; those side-effects are best-effort and never fail the response.
 * Extracted verbatim from the original single-file router.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { applyCloseConsent } from '@/lib/closeConsent';
import { volunteerDisplayName } from '@/lib/displayName';
import { notifyBeneficiaryOfRequest } from '@/lib/notify';
import { removeVolunteerFromRequestChat } from '@/lib/chatOnAssign';

import { OpError } from './shared';

// ── PATCH /api/volunteer/requests/:id (req 17) ───────────────────────────────
// Body: { urgency?, deadline? (ISO|null) }. Assignee-only (admin allowed).
const editRequestSchema = z
  .object({
    urgency: z.enum(['low', 'medium', 'high']).optional(),
    deadline: z
      .union([
        z
          .string()
          .trim()
          .refine((s) => !Number.isNaN(Date.parse(s)), 'deadline must be a valid date'),
        z.null(),
      ])
      .optional(),
  })
  .refine((d) => d.urgency !== undefined || d.deadline !== undefined, {
    message: 'urgency or deadline is required',
  });

export async function editRequest(req: Request, res: Response): Promise<void> {
  const parsed = editRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const isAdmin = req.user!.role === 'admin';
  const requestId = req.params.id;
  const { urgency, deadline } = parsed.data;
  const ref = db().collection('requests').doc(requestId);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const data = snap.data() as { assignedVolunteerId?: string | null };
    if (!isAdmin && data.assignedVolunteerId !== uid) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const changed: Record<string, unknown> = {};
    if (urgency !== undefined) {
      update.urgency = urgency;
      changed.urgency = urgency;
    }
    if (deadline !== undefined) {
      update.deadline = deadline; // string or null
      changed.deadline = deadline;
    }

    await ref.update(update);

    // visibility 'all' so the beneficiary sees the urgency/deadline change.
    await writeRequestEvent({
      requestId,
      type: 'note_added',
      actorId: uid,
      visibility: 'all',
      details: { kind: 'request_edited', ...changed },
    });
    await writeAuditLog({
      actorId: uid,
      action: 'request.edit',
      entityType: 'requests',
      entityId: requestId,
      details: changed,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[volunteer] PATCH /requests/:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}

// ── POST /api/volunteer/requests/:id/drop (req 18) ───────────────────────────
// Body: { done?, reached?, stuck? }. Assignee-only (admin allowed). Returns the
// request to the pool and records a drop report.
const dropSchema = z.object({
  done: z.string().trim().max(4000).optional(),
  reached: z.string().trim().max(4000).optional(),
  stuck: z.string().trim().max(4000).optional(),
});

export async function dropRequest(req: Request, res: Response): Promise<void> {
  const parsed = dropSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const isAdmin = req.user!.role === 'admin';
  const requestId = req.params.id;
  const { done = '', reached = '', stuck = '' } = parsed.data;
  const ref = db().collection('requests').doc(requestId);

  const volunteerName = await volunteerDisplayName(uid, req.user!.email);

  try {
    // transaction so a concurrent claim/edit aborts (firestore code 10 →
    // 409 below) rather than silently clobbering the assignment.
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new OpError(404, 'not_found');
      }
      const data = snap.data() as { assignedVolunteerId?: string | null };
      if (!isAdmin && data.assignedVolunteerId !== uid) {
        throw new OpError(403, 'forbidden');
      }

      tx.update(ref, {
        assignedVolunteerId: null,
        handler: null,
        status: 'pending',
        poolStatus: 'available',
        wasPreviouslyTaken: true,
        // Back to the pool resets any pending consent-close handshake — the
        // proposing volunteer is gone, so nobody could resolve it (req 25).
        closeRequest: null,
        dropReports: FieldValue.arrayUnion({
          volunteerId: uid,
          volunteerName,
          done,
          reached,
          stuck,
          droppedAt: new Date().toISOString(),
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof OpError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    const code = (err as { code?: number }).code;
    if (code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    console.error('[volunteer] POST /requests/:id/drop:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  // Drop the volunteer from the request chat so they lose read/write/attachment
  // access to the beneficiary's conversation once they leave the case (req 13).
  // Best-effort: never let a chat-cleanup failure fail the drop response.
  try {
    await removeVolunteerFromRequestChat(requestId, uid);
  } catch (err) {
    console.error('[volunteer] POST /requests/:id/drop chat cleanup:', err);
  }

  // visibility 'all' so the beneficiary sees their request returned to the queue.
  try {
    await writeRequestEvent({
      requestId,
      type: 'status_changed',
      actorId: uid,
      visibility: 'all',
      details: { kind: 'dropped', to: 'pending', poolStatus: 'available' },
    });
    await writeAuditLog({
      actorId: uid,
      action: 'request.drop',
      entityType: 'requests',
      entityId: requestId,
      details: { done: done.length > 0, reached: reached.length > 0, stuck: stuck.length > 0 },
    });
  } catch (err) {
    console.error('[volunteer] POST /requests/:id/drop side-effects:', err);
  }

  res.json({ ok: true });
}

// ── POST /api/volunteer/requests/:id/close (req 25 + 27) ─────────────────────
// Volunteer side of the mutual-consent close handshake. The router is already
// gated to volunteer/admin; applyCloseConsent re-checks assignment defensively.
// On both sides approving (result.closed) we record a status_changed event +
// audit log AND notify the beneficiary that their request was closed (req 27),
// since the volunteer completed the close.
const closeSchema = z.object({
  action: z.enum(['propose', 'approve', 'decline']),
});

const CLOSE_HTTP: Record<string, number> = {
  ok: 200,
  not_found: 404,
  forbidden: 403,
  invalid_state: 409,
};

export async function closeRequest(req: Request, res: Response): Promise<void> {
  const parsed = closeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const requestId = req.params.id;
  const { action } = parsed.data;

  let result;
  try {
    result = await applyCloseConsent(requestId, 'volunteer', uid, action);
  } catch (err) {
    console.error('[volunteer] POST /requests/:id/close:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  if (result.status !== 'ok') {
    res.status(CLOSE_HTTP[result.status] ?? 500).json({ error: result.status });
    return;
  }

  if (result.closed) {
    try {
      await writeRequestEvent({
        requestId,
        type: 'status_changed',
        actorId: uid,
        visibility: 'all',
        details: { to: 'closed', via: 'consent' },
      });
      await writeAuditLog({
        actorId: uid,
        action: 'request.close',
        entityType: 'requests',
        entityId: requestId,
        details: { to: 'closed', via: 'consent', role: 'volunteer' },
      });
      // req 27: volunteer completed the close → notify the beneficiary.
      await notifyBeneficiaryOfRequest(requestId, 'closed');
    } catch (err) {
      console.error('[volunteer] POST /requests/:id/close side-effects:', err);
    }
  } else if (result.action) {
    // Propose/decline leave a timeline trace too, so admins can see a pending
    // (or withdrawn) consent-close handshake before it resolves.
    try {
      await writeRequestEvent({
        requestId,
        type: 'close_consent',
        actorId: uid,
        visibility: 'all',
        details: { action: result.action, role: 'volunteer' },
      });
    } catch (err) {
      console.error('[volunteer] POST /requests/:id/close consent-event side-effects:', err);
    }
  }

  res.json({ ok: true, closed: result.closed, closeRequest: result.closeRequest });
}
