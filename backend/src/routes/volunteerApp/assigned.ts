/**
 * Volunteer Hub: the "assigned to me" tab of the volunteer dashboard.
 *
 * Single Express handler backing GET /api/volunteer/assigned. Returns every
 * request currently assigned to the authenticated volunteer, ordered by the
 * shared priority rule (urgency/deadline/previously-taken) and projected to a
 * PII-stripped card via toAssignedCard. Collaborates with requestSort (ranking)
 * and ./shared (card shape, kept consistent with the pool/claimed tabs).
 * Invariant: caller identity comes from req.user (auth middleware), never the
 * body, so a volunteer only ever sees their own assignments.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { sortByPriority, type SortableRequest } from '@/lib/requestSort';

import { toAssignedCard } from './shared';

// GET /api/volunteer/assigned -> { items: AssignedCard[] }
// requires auth; filters requests by assignedVolunteerId == caller uid.
export async function getAssigned(req: Request, res: Response): Promise<void> {
  const uid = req.user!.uid;
  try {
    const snap = await db()
      .collection('requests')
      .where('assignedVolunteerId', '==', uid)
      .get();

    // project to the minimal shape sortByPriority needs (raw doc kept on _doc
    // so we can rank first, then build the full card only for the sorted order).
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
