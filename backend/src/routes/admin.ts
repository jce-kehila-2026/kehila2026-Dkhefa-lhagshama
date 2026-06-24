/**
 * Admin approval-queue routes (UC-05). Mounted at /api/admin; every route is
 * gated by authenticate + requireRole('admin'). Governs the moderation
 * lifecycle of submitted businesses + answers (ngo/partner orgs): list pending,
 * then approve / reject / request-changes. Each mutation stamps the actor +
 * server timestamp on the doc and appends an immutable audit-log entry. Status
 * is the single source of truth: pending -> approved | rejected | needs_changes.
 */
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

// GET /api/admin/pending — fan-out a status=='pending' query across every
// approvable collection, normalize each doc, and return { items } newest-first.
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
              // Convert Firestore Timestamps to ISO strings so `createdAt`
              // (and `updatedAt`) match the contract every other answers/
              // businesses/requests list endpoint emits — otherwise this
              // payload carries `{_seconds,_nanoseconds}` objects, and any
              // consumer doing `new Date(item.createdAt)` gets Invalid Date.
              return {
                id: doc.id,
                entityType,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
              };
            })
          )
      )
    );

    // Newest-first by `createdAt` — the field both pending collections
    // (businesses, answers) actually write at creation (serverTimestamp). The
    // previous key `submittedAt` was never written, so every item scored 0 and
    // the queue fell back to Firestore's arbitrary insertion order. createdAt is
    // now an ISO string (converted in the mapper above), so sort lexically — ISO
    // 8601 strings sort chronologically — with null/missing values sinking last.
    const items = (snapshots.flat() as Array<Record<string, unknown>>).sort(
      (a, b) => {
        const aTime = typeof a.createdAt === 'string' ? a.createdAt : '';
        const bTime = typeof b.createdAt === 'string' ? b.createdAt : '';
        return bTime.localeCompare(aTime);
      }
    );

    res.json({ items });
  } catch (err) {
    console.error('[admin] GET /pending:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Statuses from which a moderation decision is still allowed. Re-deciding an
// already approved/rejected entity is blocked (409 already_decided) — flipping a
// finished decision is a deliberate "reopen", not a queue action. A missing
// status is treated as decidable (legacy docs created before the status field).
const DECIDABLE_STATUSES = new Set<string | undefined>(['pending', 'needs_changes', undefined]);

// Local error so the transaction body can bail out with a specific HTTP status.
class ModerationError extends Error {
  constructor(public readonly httpStatus: number, public readonly code: string) {
    super(code);
    this.name = 'ModerationError';
  }
}

/**
 * Shared transactional moderation applier for approve / reject / request-changes
 * (DRY: the three handlers were near-identical — audit code-quality).
 *
 * RACE FIX (audit): the originals did a plain existence `.get()` then an
 * unconditional `.update()`, so two admins acting on the SAME pending entity
 * could BOTH succeed (last-write-wins) AND both append a contradictory audit
 * log. Here the read-check-write runs in a transaction with a "still decidable"
 * precondition, so only the first decision commits; a stale second decision
 * gets 409 already_decided (or 409 concurrent_update if it lost the race).
 */
async function applyDecision(opts: {
  entityType: (typeof ENTITY_TYPES)[number];
  entityId: string;
  actorId: string;
  status: string;
  stamp: Record<string, unknown>;
  auditAction: string;
  note?: string;
}): Promise<void> {
  const ref = db().collection(opts.entityType).doc(opts.entityId);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ModerationError(404, 'not_found');
    const current = snap.data()!.status as string | undefined;
    if (!DECIDABLE_STATUSES.has(current)) throw new ModerationError(409, 'already_decided');
    tx.update(ref, { status: opts.status, ...opts.stamp });
  });
  // Audit only after the decision committed (so a refused/aborted decision never
  // leaves an orphan log).
  await writeAuditLog({
    actorId: opts.actorId,
    action: opts.auditAction,
    entityType: opts.entityType,
    entityId: opts.entityId,
    details: { note: opts.note ?? null },
  });
}

// Shared error→HTTP translation for the decision routes.
function respondDecisionError(res: Response, err: unknown, ctx: string): void {
  if (err instanceof ModerationError) {
    res.status(err.httpStatus).json({ error: err.code });
    return;
  }
  // gRPC ABORTED (code 10): the txn lost a race after retries.
  if ((err as { code?: number }).code === 10) {
    res.status(409).json({ error: 'concurrent_update' });
    return;
  }
  console.error(`${ctx}:`, err);
  res.status(500).json({ error: 'internal_error' });
}

// POST /api/admin/approve — body { entityType, entityId, note? } (actionSchema).
// 400 invalid_input / 404 not_found / 409 already_decided|concurrent_update,
// else sets status='approved' + approver stamps, audit-logs, returns { ok: true }.
router.post('/approve', async (req: Request, res: Response): Promise<void> => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { entityType, entityId, note } = parsed.data;
  const actorId = req.user!.uid;
  try {
    await applyDecision({
      entityType, entityId, actorId, note,
      status: 'approved',
      stamp: { approvedBy: actorId, approvedAt: FieldValue.serverTimestamp(), ...(note ? { approvalNote: note } : {}) },
      auditAction: 'approve',
    });
    res.json({ ok: true });
  } catch (err) {
    respondDecisionError(res, err, '[admin] POST /approve');
  }
});

// POST /api/admin/reject — same contract as /approve; sets status='rejected'.
router.post('/reject', async (req: Request, res: Response): Promise<void> => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { entityType, entityId, note } = parsed.data;
  const actorId = req.user!.uid;
  try {
    await applyDecision({
      entityType, entityId, actorId, note,
      status: 'rejected',
      stamp: { rejectedBy: actorId, rejectedAt: FieldValue.serverTimestamp(), ...(note ? { rejectionNote: note } : {}) },
      auditAction: 'reject',
    });
    res.json({ ok: true });
  } catch (err) {
    respondDecisionError(res, err, '[admin] POST /reject');
  }
});

// POST /api/admin/request-changes — same contract; sets status='needs_changes'.
router.post('/request-changes', async (req: Request, res: Response): Promise<void> => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { entityType, entityId, note } = parsed.data;
  const actorId = req.user!.uid;
  try {
    await applyDecision({
      entityType, entityId, actorId, note,
      status: 'needs_changes',
      stamp: { changesRequestedBy: actorId, changesRequestedAt: FieldValue.serverTimestamp(), ...(note ? { changesNote: note } : {}) },
      auditAction: 'request_changes',
    });
    res.json({ ok: true });
  } catch (err) {
    respondDecisionError(res, err, '[admin] POST /request-changes');
  }
});

export default router;
