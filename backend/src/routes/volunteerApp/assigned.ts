/**
 * GET /api/volunteer/assigned — all requests assigned to the caller,
 * priority-sorted, PII-stripped cards.
 *
 * Extracted verbatim from the original single-file router.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { sortByPriority, type SortableRequest } from '@/lib/requestSort';

import { toAssignedCard } from './shared';

// ── GET /api/volunteer/assigned ──────────────────────────────────────────────
// All requests assigned to the caller, priority-sorted, PII-stripped cards.
export async function getAssigned(req: Request, res: Response): Promise<void> {
  const uid = req.user!.uid;
  try {
    const snap = await db()
      .collection('requests')
      .where('assignedVolunteerId', '==', uid)
      .get();

    // Sort raw docs by priority first, then project to card shape.
    const sortable = snap.docs.map((d) => {
      const data = d.data();
      return {
        _doc: d,
        urgency: data.urgency as string | null | undefined,
        deadline: (data.deadline as string | null | undefined) ?? null,
        wasPreviouslyTaken: data.wasPreviouslyTaken === true,
      } satisfies SortableRequest & { _doc: typeof d };
    });

    const items = sortByPriority(sortable).map((s) => toAssignedCard(s._doc.id, s._doc.data()));
    res.json({ items });
  } catch (err) {
    console.error('[volunteer] GET /assigned:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}
