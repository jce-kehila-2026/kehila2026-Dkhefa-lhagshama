/**
 * /api/ratings — Beneficiary rates their experience on a resolved request (#80).
 *
 * POST /api/ratings
 *   Authenticated. Only the request's beneficiary may rate, and only once the
 *   request is `closed` (Note 6 — `resolved` retired). A rating is stored in
 *   the `ratings` collection (one
 *   per request — the requestId is the doc id, so re-submitting overwrites the
 *   previous score). When the request has an assigned volunteer we maintain a
 *   running aggregate (count + sum + average) on `volunteers/{uid}`.
 *
 * GET /api/ratings/:requestId
 *   Authenticated. Returns the caller's own rating (admin may also read) so the
 *   UI can show an "already rated" state.
 *
 * All writes go through the Admin SDK (which bypasses Firestore rules). Clients
 * never write to `ratings` directly — rules `allow create, update: if false`.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { authenticate } from '@/middleware/auth';

const router = Router();

// ── Schema ──────────────────────────────────────────────────────────────────
const createRatingSchema = z.object({
  requestId: z.string().min(1).max(200),
  stars: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(''),
});

type CreateRatingInput = z.infer<typeof createRatingSchema>;

// ── POST /api/ratings ─────────────────────────────────────────────────────────
router.post('/', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const parsed = createRatingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const input: CreateRatingInput = parsed.data;
  const uid = req.user.uid;

  try {
    const requestRef = db().collection('requests').doc(input.requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      res.status(404).json({ error: 'request_not_found' });
      return;
    }

    const request = requestSnap.data() as {
      beneficiaryId?: string;
      status?: string;
      assignedVolunteerId?: string | null;
      handler?: string | null;
    };

    // Gate 1 — only the request's beneficiary may rate.
    if (request.beneficiaryId !== uid) {
      res.status(403).json({
        error: 'forbidden',
        detail: 'only the request beneficiary can rate this request',
      });
      return;
    }

    // Gate 2 — the request must be closed (Note 6: `resolved` is retired; the
    // rating prompt now keys off `closed`).
    if (request.status !== 'closed') {
      res.status(409).json({
        error: 'request_not_closed',
        detail: 'a request can only be rated once it is closed',
      });
      return;
    }

    const volunteerId = request.assignedVolunteerId ?? request.handler ?? null;
    const ratingRef = db().collection('ratings').doc(input.requestId);

    // Helper: recompute the {count, sum, average} aggregate from a snapshot by
    // applying signed deltas, flooring count at 0 so a decrement can't go
    // negative on legacy data.
    const applyAgg = (
      snap: FirebaseFirestore.DocumentSnapshot | null,
      dCount: number,
      dSum: number,
    ) => {
      const agg = snap?.exists
        ? (snap.data()?.ratingAggregate as { count?: number; sum?: number } | undefined)
        : undefined;
      const count = Math.max(0, (agg?.count ?? 0) + dCount);
      const sum = (agg?.sum ?? 0) + dSum;
      const average = count > 0 ? Number((sum / count).toFixed(2)) : 0;
      return { count, sum, average };
    };

    // Run the write + aggregate update in a transaction so concurrent
    // re-submissions can't corrupt the volunteer aggregate.
    await db().runTransaction(async (tx) => {
      // ── All reads first (Firestore requires reads before writes). ──
      const existingSnap = await tx.get(ratingRef);
      const existing = existingSnap.exists
        ? (existingSnap.data() as { stars?: number; volunteerId?: string | null })
        : null;
      const previousStars = existing?.stars ?? null;
      // ATTRIBUTION FIX (audit MODERATE #5): credit the volunteer the EXISTING
      // rating was attributed to (stored on the rating doc), not the live
      // assignee. A request can be reopened, reassigned to volunteer B, re-closed
      // and re-rated; the old code applied the delta to B's aggregate without
      // incrementing B's count and never decremented A's — permanently inflating
      // A and corrupting B's average. We now reconcile BOTH volunteers.
      const previousVolunteerId = existing?.volunteerId ?? null;
      const sameVolunteer = previousVolunteerId === volunteerId;

      const curVolRef = volunteerId ? db().collection('volunteers').doc(volunteerId) : null;
      const prevVolRef =
        previousVolunteerId && !sameVolunteer
          ? db().collection('volunteers').doc(previousVolunteerId)
          : null;
      const curVolSnap = curVolRef ? await tx.get(curVolRef) : null;
      const prevVolSnap = prevVolRef ? await tx.get(prevVolRef) : null;

      // ── Writes ──
      tx.set(ratingRef, {
        requestId: input.requestId,
        beneficiaryId: uid,
        volunteerId,
        stars: input.stars,
        comment: input.comment,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existingSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true });

      if (sameVolunteer) {
        // Same volunteer as before (or both null): apply the simple delta.
        if (curVolRef) {
          const [dCount, dSum] =
            previousStars === null
              ? [1, input.stars] // first rating for this request
              : [0, input.stars - previousStars]; // re-rate: replace contribution
          tx.set(
            curVolRef,
            { ratingAggregate: applyAgg(curVolSnap, dCount, dSum), updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
          );
        }
      } else {
        // The attributed volunteer changed since the last rating (or this is the
        // first rating). Remove the previous contribution from the OLD volunteer
        // and credit the NEW one as a fresh rating.
        if (prevVolRef && previousStars !== null) {
          tx.set(
            prevVolRef,
            { ratingAggregate: applyAgg(prevVolSnap, -1, -previousStars), updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
          );
        }
        if (curVolRef) {
          tx.set(
            curVolRef,
            { ratingAggregate: applyAgg(curVolSnap, 1, input.stars), updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
          );
        }
      }
    });

    // Timeline event — user-facing. Fire-and-forget.
    writeRequestEvent({
      requestId: input.requestId,
      type: 'rated',
      actorId: uid,
      visibility: 'all',
      details: { stars: input.stars },
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[ratings.create] event write failed:', err);
    });

    // Audit log — fire-and-forget.
    writeAuditLog({
      actorId: uid,
      action: 'rating.create',
      entityType: 'ratings',
      entityId: input.requestId,
      details: { stars: input.stars, volunteerId },
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[ratings.create] audit write failed:', err);
    });

    res.status(201).json({ requestId: input.requestId, stars: input.stars });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ratings.create] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// ── GET /api/ratings/:requestId ─────────────────────────────────────────────
// Returns the caller's own rating for a request (so the UI can show "already
// rated"). Only the beneficiary who owns the request may read it.
router.get('/:requestId', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  try {
    const snap = await db().collection('ratings').doc(req.params.requestId).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const data = snap.data() as { beneficiaryId?: string };
    if (data.beneficiaryId !== req.user.uid && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    res.json({ id: snap.id, ...data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[ratings.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
