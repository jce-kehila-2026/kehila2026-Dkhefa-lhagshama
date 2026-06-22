/**
 * POST /api/requests/:id/done — volunteer-scoped "mark as done" (Note 6).
 *
 * Mechanical extraction from the former single-file routes/requests.ts —
 * the handler logic is unchanged.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { canTransition } from '@/lib/requestTransitions';

import { TransitionError } from './helpers';

// ── POST /api/requests/:id/done ──────────────────────────────────────────
// Volunteer-scoped "mark as done" (Note 6). ASSIGNED-HANDLER ONLY: the caller
// must be the request's assignedVolunteerId or handler (admins also allowed).
// Valid only for the transition in_progress → awaiting_review. Writes a
// timestamped requestEvent and returns the updated request.
export async function markDone(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const requestId = req.params.id;
  const actorId = req.user.uid;
  const ref = db().collection('requests').doc(requestId);

  let prevStatus: string | null = null;

  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new TransitionError(404, 'not_found');
      }
      const data = snap.data() as {
        status?: string;
        handler?: string | null;
        assignedVolunteerId?: string | null;
      };

      const isAdmin = req.user!.role === 'admin';
      const isAssigned =
        data.assignedVolunteerId === actorId || data.handler === actorId;

      // Assigned-handler gate: non-admin callers must own the request.
      if (!isAdmin && !isAssigned) {
        throw new TransitionError(403, 'forbidden');
      }

      prevStatus = data.status ?? null;

      // The volunteer's only legal move is in_progress → awaiting_review.
      const allowed = canTransition(prevStatus, 'awaiting_review', {
        role: isAdmin ? 'admin' : 'volunteer',
        isAssigned,
      });
      if (!allowed) {
        throw new TransitionError(409, 'invalid_transition', {
          from: prevStatus,
          to: 'awaiting_review',
        });
      }

      tx.update(ref, {
        status: 'awaiting_review',
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof TransitionError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    const code = (err as { code?: number }).code;
    if (code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[requests.done] failed:', err);
    res.status(500).json({ error: 'internal' });
    return;
  }

  // Side effects after the commit. Bookkeeping failures don't fail the response.
  try {
    await writeRequestEvent({
      requestId,
      type: 'status_changed',
      actorId,
      visibility: 'all',
      details: { from: prevStatus, to: 'awaiting_review', kind: 'done' },
    });
    await writeAuditLog({
      actorId,
      action: 'request.done',
      entityType: 'requests',
      entityId: requestId,
      details: { from: prevStatus, to: 'awaiting_review' },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.done] side-effects:', err);
  }

  // Return the updated request.
  try {
    const updated = await ref.get();
    const data = updated.data() ?? {};
    res.json({
      id: updated.id,
      ...data,
      createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? null,
      updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? null,
    });
  } catch {
    res.json({ id: requestId, status: 'awaiting_review' });
  }
}
