import { Router, Request, Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';
import { writeAuditLog } from '@/lib/audit';

const router = Router();

// All routes require a verified admin token
router.use(authenticate, requireRole('admin'));

// Approvable collections. `organizations` was removed: nothing writes to that
// collection — orgs live in `answers`, split by orgType (ngo / partner). The
// z.enum below now rejects 'organizations' as an invalid entityType (400).
const ENTITY_TYPES = ['businesses', 'answers'] as const;

const actionSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId:   z.string().min(1),
  note:       z.string().max(500).optional(),
});

// GET /api/admin/pending — list all pending entities across collections
router.get('/pending', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshots = await Promise.all(
      ENTITY_TYPES.map((entityType) =>
        db()
          .collection(entityType)
          .where('status', '==', 'pending')
          .get()
          .then((snap) =>
            snap.docs.map((doc) => {
              // F8: drop the internal ownerId from the admin listing — the
              // approvals UI doesn't use it, and it's an internal uid.
              const data = doc.data();
              delete data.ownerId;
              return { id: doc.id, entityType, ...data };
            })
          )
      )
    );

    const items = (snapshots.flat() as Array<Record<string, unknown>>).sort(
      (a, b) => {
        const aTime = (a.submittedAt as { _seconds?: number })?._seconds ?? 0;
        const bTime = (b.submittedAt as { _seconds?: number })?._seconds ?? 0;
        return bTime - aTime;
      }
    );

    res.json({ items });
  } catch (err) {
    console.error('[admin] GET /pending:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/admin/approve — approve a pending entity
router.post('/approve', async (req: Request, res: Response): Promise<void> => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { entityType, entityId, note } = parsed.data;
  const actorId = req.user!.uid;

  try {
    const ref = db().collection(entityType).doc(entityId);
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await ref.update({
      status: 'approved',
      approvedBy: actorId,
      approvedAt: FieldValue.serverTimestamp(),
      ...(note ? { approvalNote: note } : {}),
    });

    await writeAuditLog({
      actorId,
      action: 'approve',
      entityType,
      entityId,
      details: { note: note ?? null },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] POST /approve:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/admin/reject — reject a pending entity
router.post('/reject', async (req: Request, res: Response): Promise<void> => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { entityType, entityId, note } = parsed.data;
  const actorId = req.user!.uid;

  try {
    const ref = db().collection(entityType).doc(entityId);
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await ref.update({
      status: 'rejected',
      rejectedBy: actorId,
      rejectedAt: FieldValue.serverTimestamp(),
      ...(note ? { rejectionNote: note } : {}),
    });

    await writeAuditLog({
      actorId,
      action: 'reject',
      entityType,
      entityId,
      details: { note: note ?? null },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] POST /reject:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/admin/request-changes — request changes on a pending entity
router.post('/request-changes', async (req: Request, res: Response): Promise<void> => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { entityType, entityId, note } = parsed.data;
  const actorId = req.user!.uid;

  try {
    const ref = db().collection(entityType).doc(entityId);
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await ref.update({
      status: 'needs_changes',
      changesRequestedBy: actorId,
      changesRequestedAt: FieldValue.serverTimestamp(),
      ...(note ? { changesNote: note } : {}),
    });

    await writeAuditLog({
      actorId,
      action: 'request_changes',
      entityType,
      entityId,
      details: { note: note ?? null },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[admin] POST /request-changes:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
