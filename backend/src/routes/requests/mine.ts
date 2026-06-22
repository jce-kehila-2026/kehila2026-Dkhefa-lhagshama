/**
 * GET /api/requests/mine — the caller's own requests, newest first.
 *
 * Mechanical extraction from the former single-file routes/requests.ts —
 * the handler logic is unchanged.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';

// ── GET /api/requests/mine ───────────────────────────────────────────────
// Returns the caller's own requests, newest first. Capped at 50 for now;
// pagination can come later if we need it.
export async function listMine(req: Request, res: Response): Promise<void> {
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
      // Beneficiary-facing referral view (Note 8): partner name + contact
      // (phone/email/website, snapshotted at referral time) + note + when.
      const referral = data.referral
        ? {
            partnerName: data.referral.partnerName ?? '',
            phone: data.referral.phone ?? null,
            email: data.referral.email ?? null,
            website: data.referral.website ?? null,
            note: data.referral.note ?? '',
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
