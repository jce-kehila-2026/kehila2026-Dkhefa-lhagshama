/**
 * /api/ratings — Beneficiary rates their experience on a resolved request (#80).
 *
 * POST /api/ratings
 *   Authenticated. Only the request's beneficiary may rate, and only once the
 *   request is `resolved`. A rating is stored in the `ratings` collection (one
 *   per request — the requestId is the doc id, so re-submitting overwrites the
 *   previous score). When the request has an assigned volunteer we maintain a
 *   running aggregate (count + sum + average) on `volunteers/{uid}`.
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

    // Gate 2 — the request must be resolved.
    if (request.status !== 'resolved') {
      res.status(409).json({
        error: 'request_not_resolved',
        detail: 'a request can only be rated once it is resolved',
      });
      return;
    }

    const volunteerId = request.assignedVolunteerId ?? request.handler ?? null;
    const ratingRef = db().collection('ratings').doc(input.requestId);

    // Run the write + aggregate update in a transaction so concurrent
    // re-submissions can't corrupt the volunteer aggregate.
    await db().runTransaction(async (tx) => {
      const existingSnap = await tx.get(ratingRef);
      const existing = existingSnap.exists
        ? (existingSnap.data() as { stars?: number })
        : null;
      const previousStars = existing?.stars ?? null;

      tx.set(ratingRef, {
        requestId: input.requestId,
        beneficiaryId: uid,
        volunteerId,
        stars: input.stars,
        comment: input.comment,
        updatedAt: FieldValue.serverTimestamp(),
        ...(existingSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true });

      // Maintain the volunteer aggregate when a volunteer is attached.
      if (volunteerId) {
        const volunteerRef = db().collection('volunteers').doc(volunteerId);
        const volunteerSnap = await tx.get(volunteerRef);
        const agg = volunteerSnap.exists
          ? (volunteerSnap.data()?.ratingAggregate as
              | { count?: number; sum?: number }
              | undefined)
          : undefined;

        let count = agg?.count ?? 0;
        let sum = agg?.sum ?? 0;

        if (previousStars === null) {
          // First rating for this request.
          count += 1;
          sum += input.stars;
        } else {
          // Re-rating: replace the previous contribution.
          sum += input.stars - previousStars;
        }

        const average = count > 0 ? Number((sum / count).toFixed(2)) : 0;

        tx.set(
          volunteerRef,
          {
            ratingAggregate: { count, sum, average },
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
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
