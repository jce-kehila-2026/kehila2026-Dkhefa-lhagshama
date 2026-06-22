/**
 * POST /api/admin/requests/:id/archive — archive a closed/referred request (#75).
 *
 * Extracted verbatim from the original single-file router.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { canArchive } from '@/lib/requestTransitions';
import { TransitionError } from './shared';

// ── POST /api/admin/requests/:id/archive ──────────────────────────────────
// Sets archived=true. Only allowed when the request is `closed` or `referred`
// (Note 6). Archived requests stay queryable for stats but drop out of the
// default active list.
export async function archiveRequest(req: Request, res: Response): Promise<void> {
  const requestId = req.params.id;
  const actorId = req.user!.uid;
  const ref = db().collection('requests').doc(requestId);

  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new TransitionError(404, 'not_found');
      }
      const status = (snap.data()!.status as string) ?? null;
      if (!canArchive(status)) {
        throw new TransitionError(409, 'invalid_archive', { status });
      }
      tx.update(ref, {
        archived: true,
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
    console.error('[adminRequests] POST /:id/archive:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  try {
    await writeRequestEvent({
      requestId,
      type: 'status_changed',
      actorId,
      visibility: 'internal',
      details: { kind: 'archived', archived: true },
    });
    await writeAuditLog({
      actorId,
      action: 'request.archive',
      entityType: 'requests',
      entityId: requestId,
      details: { archived: true },
    });
  } catch (err) {
    console.error('[adminRequests] POST /:id/archive side-effects:', err);
  }

  res.json({ ok: true, archived: true });
}
