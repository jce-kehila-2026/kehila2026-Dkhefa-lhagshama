/**
 * POST /api/admin/requests/:id/refer — refer the request to a partner (#75).
 *
 * Extracted verbatim from the original single-file router.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { canTransition } from '@/lib/requestTransitions';
import { setChatsActiveForRequest, TransitionError } from './shared';

// ── POST /api/admin/requests/:id/refer ────────────────────────────────────
// Body: { answerId: string, note?: string }
// Refers the request to a partner from the live `answers` catalog (Note 8).
// Resolves partnerName from the answer, sets the `referral` field, moves the
// status to `referred` (terminal, counts as helped), and sets archived=true.
// Validated against the transition map (in_progress → referred, admin).
const referSchema = z.object({
  answerId: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional(),
});

export async function referRequest(req: Request, res: Response): Promise<void> {
  const parsed = referSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const { answerId, note } = parsed.data;
  const requestId = req.params.id;
  const actorId = req.user!.uid;
  const ref = db().collection('requests').doc(requestId);

  let prevStatus: string | null = null;
  let partnerName = '';

  try {
    // Resolve the partner from the answers catalog up front (outside the txn).
    const answerSnap = await db().collection('answers').doc(answerId).get();
    if (!answerSnap.exists) {
      res.status(404).json({ error: 'partner_not_found' });
      return;
    }
    const answer = answerSnap.data() as {
      title?: { he?: string; en?: string } | string;
      sourceName?: string;
      status?: string;
      phone?: string;
      email?: string;
      sourceUrl?: string;
    };
    // Only approved partners may be snapshotted onto a referral — mirrors the
    // public directory's approved-only contract. Guards against referring a
    // beneficiary to a pending/rejected/archived org via the raw answerId.
    if (answer.status !== 'approved') {
      res.status(409).json({ error: 'partner_not_approved' });
      return;
    }
    // `title` is bilingual { he, en } on answers; fall back across shapes.
    if (typeof answer.title === 'string') {
      partnerName = answer.title;
    } else {
      partnerName = answer.title?.he ?? answer.title?.en ?? answer.sourceName ?? '';
    }
    // Snapshot the partner's contact details onto the referral so the
    // beneficiary's referral panel can actually show how to reach them. Stored
    // at referral time (not looked up live) so it survives later edits to the
    // answer doc. `website` maps from the answer's `sourceUrl` field.
    const partnerPhone   = answer.phone ?? null;
    const partnerEmail   = answer.email ?? null;
    const partnerWebsite = answer.sourceUrl ?? null;

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new TransitionError(404, 'not_found');
      }
      prevStatus = (snap.data()!.status as string) ?? null;

      if (!canTransition(prevStatus, 'referred', { role: 'admin', isAssigned: true })) {
        throw new TransitionError(409, 'invalid_transition', {
          from: prevStatus,
          to: 'referred',
        });
      }

      tx.update(ref, {
        status: 'referred',
        archived: true,
        // Referral is terminal — clear any pending consent-close handshake.
        closeRequest: null,
        referral: {
          answerId,
          partnerName,
          phone: partnerPhone,
          email: partnerEmail,
          website: partnerWebsite,
          note: note ?? '',
          referredAt: FieldValue.serverTimestamp(),
          referredBy: actorId,
        },
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
    console.error('[adminRequests] POST /:id/refer:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  try {
    await writeRequestEvent({
      requestId,
      type: 'status_changed',
      actorId,
      visibility: 'all',
      details: { from: prevStatus, to: 'referred', kind: 'referred', answerId, partnerName, note: note ?? '' },
    });
    await writeAuditLog({
      actorId,
      action: 'request.refer',
      entityType: 'requests',
      entityId: requestId,
      details: { answerId, partnerName },
    });
  } catch (err) {
    console.error('[adminRequests] POST /:id/refer side-effects:', err);
  }

  // `referred` is a request end state — pause the linked chat(s).
  await setChatsActiveForRequest(requestId, false);

  res.json({ ok: true, status: 'referred', referral: { answerId, partnerName, note: note ?? '' } });
}
