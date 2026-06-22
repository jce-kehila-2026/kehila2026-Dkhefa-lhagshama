/**
 * Volunteer pool handlers: the open queue of unassigned requests volunteers can
 * browse and claim. Mounted under /api/volunteer by the volunteerApp router.
 *  - getPool          GET  /pool            list available requests as privacy-safe cards
 *  - claimPoolRequest POST /pool/:id/claim  volunteer self-registers interest in a request
 * Cards are built via toPoolCard (shared) so requester PII never leaks to the pool.
 * Claiming is transactional so concurrent volunteers can't double-claim the same request.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { sortByPriority, type SortableRequest } from '@/lib/requestSort';
import { volunteerDisplayName } from '@/lib/displayName';

import { toPoolCard, OpError } from './shared';

// ── GET /api/volunteer/pool ──────────────────────────────────────────────────
// All requests with poolStatus === 'available', priority-sorted + privacy-safe
// cards, plus a per-category breakdown. Response: { items, byCategory }.
export async function getPool(req: Request, res: Response): Promise<void> {
  const uid = req.user!.uid;
  try {
    const snap = await db()
      .collection('requests')
      .where('poolStatus', '==', 'available')
      .get();

    // keep the raw doc alongside the sort keys so we can rebuild cards in priority order.
    const sortable = snap.docs.map((d) => {
      const data = d.data();
      return {
        _doc: d,
        urgency: data.urgency as string | null | undefined,
        deadline: (data.deadline as string | null | undefined) ?? null,
        wasPreviouslyTaken: data.wasPreviouslyTaken === true,
      } satisfies SortableRequest & { _doc: typeof d };
    });

    const items = sortByPriority(sortable).map((s) => toPoolCard(s._doc.id, s._doc.data(), uid));

    // byCategory aggregation over the pool.
    const counts = new Map<string, number>();
    for (const item of items) {
      const cat = (item.category as string | null) ?? 'uncategorized';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    const byCategory = [...counts.entries()].map(([category, count]) => ({ category, count }));

    res.json({ items, byCategory });
  } catch (err) {
    console.error('[volunteer] GET /pool:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}

// ── POST /api/volunteer/pool/:id/claim ───────────────────────────────────────
// Body: { note? }. Adds the caller to the request's claims list.
const claimSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

// Returns 400 invalid_input / 404 not_found / 409 (not_available | already_claimed |
// concurrent_update) / 500, else { ok: true }.
export async function claimPoolRequest(req: Request, res: Response): Promise<void> {
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const requestId = req.params.id;
  const note = parsed.data.note ?? '';
  const ref = db().collection('requests').doc(requestId);

  const volunteerName = await volunteerDisplayName(uid, req.user!.email);

  try {
    // Read-check-write in a transaction so two volunteers can't race a claim.
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new OpError(404, 'not_found');
      }
      const data = snap.data() as {
        poolStatus?: string;
        claims?: Array<{ volunteerId?: string }>;
      };
      if (data.poolStatus !== 'available') {
        throw new OpError(409, 'not_available', { poolStatus: data.poolStatus ?? null });
      }
      const claims = data.claims ?? [];
      if (claims.some((c) => c?.volunteerId === uid)) {
        throw new OpError(409, 'already_claimed');
      }

      tx.update(ref, {
        claims: FieldValue.arrayUnion({
          volunteerId: uid,
          volunteerName,
          note,
          claimedAt: new Date().toISOString(),
        }),
        hasClaims: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof OpError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    // firestore ABORTED (gRPC code 10): transaction lost a retry race -> surface as 409.
    const code = (err as { code?: number }).code;
    if (code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    console.error('[volunteer] POST /pool/:id/claim:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  // Side effects after commit. Internal-only: this is volunteer-pool activity.
  try {
    await writeRequestEvent({
      requestId,
      type: 'note_added',
      actorId: uid,
      visibility: 'internal',
      details: { claim: true, volunteerName, note },
    });
    await writeAuditLog({
      actorId: uid,
      action: 'request.claim',
      entityType: 'requests',
      entityId: requestId,
      details: { note: note.length > 0 },
    });
  } catch (err) {
    console.error('[volunteer] POST /pool/:id/claim side-effects:', err);
  }

  res.json({ ok: true });
}
