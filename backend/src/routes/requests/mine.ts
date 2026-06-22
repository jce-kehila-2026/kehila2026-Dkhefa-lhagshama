/**
 * UC-01 "my requests" read endpoint: GET /api/requests/mine.
 *
 * Serves the beneficiary's own request list (the /my-requests page). Auth is
 * enforced upstream by the route middleware that sets req.user; this handler
 * scopes every query to req.user.uid so a caller can only ever see their own
 * rows. Each Firestore request doc is reshaped into a stable client DTO:
 * timestamps -> ISO strings, missing fields defaulted, and the admin-internal
 * referral object trimmed to the beneficiary-facing fields.
 *
 * Mechanical extraction from the former single-file routes/requests.ts; the
 * handler logic is unchanged.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';

// ── GET /api/requests/mine ───────────────────────────────────────────────
// Returns the caller's own requests, newest first. Response: { items: [...] }.
// Capped at 50 for now; pagination can come later if we need it. Requires the
// composite index (beneficiaryId == + createdAt desc).
export async function listMine(req: Request, res: Response): Promise<void> {
  // req.user is populated by the auth middleware; this 401 guards the case
  // where the route is mounted without it (defence in depth, not the norm).
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  try {
    const snap = await db()
      .collection('requests')
      .where('beneficiaryId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const items = snap.docs.map((d) => {
      const data = d.data();
      // Beneficiary-facing referral view: only the partner name + contact
      // (phone/email/website, snapshotted at referral time) + note + when.
      // Any admin-internal referral fields are intentionally dropped here.
      const referral = data.referral
        ? {
            partnerName: data.referral.partnerName ?? '',
            phone: data.referral.phone ?? null,
            email: data.referral.email ?? null,
            website: data.referral.website ?? null,
            note: data.referral.note ?? '',
            // tolerate either a Firestore Timestamp (toDate) or an already-
            // serialized string, falling back to null when absent.
            referredAt:
              data.referral.referredAt?.toDate?.()?.toISOString?.() ??
              data.referral.referredAt ??
              null,
          }
        : null;
      return {
        id: d.id,
        displayId:       data.displayId ?? null,
        category:        data.category,
        urgency:         data.urgency,
        status:          data.status,
        archived:        data.archived === true,
        description:     data.description,
        deadline:        data.deadline ?? null,
        attachmentPaths: data.attachmentPaths ?? [],
        referral,
        // Firestore timestamps -> ISO strings for the client
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    res.json({ items });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.mine] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
}
