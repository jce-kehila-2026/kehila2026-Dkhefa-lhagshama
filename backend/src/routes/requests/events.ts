/**
 * Request timeline events (#68): the read side of the per-request audit trail.
 *
 * Exposes one handler, listEvents, mounted by the requests router as
 * GET /api/requests/:id/events. It reads the requestEvents collection (written
 * elsewhere when a request is created/claimed/assigned/closed/etc.) and returns
 * an ordered timeline for the requester's "my requests" detail view and the
 * admin/volunteer request rail.
 *
 * Key invariant: a caller only sees events whose visibility they're allowed to
 * see. Owners (beneficiaries) get public events; handlers and admins also get
 * 'internal' ones. Access to events first requires access to the parent request.
 *
 * Extracted as-is from the former single-file routes/requests.ts; handler logic
 * is unchanged.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';

// ── GET /api/requests/:id/events ────────────────────────────────────────
// Returns the timeline events for a single request (#68).
// Visibility gate: the beneficiary (owner) sees all events with visibility
// 'all'; volunteers and admins see all. Events are ordered oldest-first so
// the client can render them top-to-bottom as a timeline.
//
// Mounted BEFORE /:id so Express matches the literal segment "events" first.
export async function listEvents(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const id = req.params.id;

  // First verify the caller may read the parent request.
  try {
    const snap = await db().collection('requests').doc(id).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const data = snap.data() as {
      beneficiaryId?: string;
      handler?: string | null;
      assignedVolunteerId?: string | null;
    };
    const isOwner   = data.beneficiaryId === req.user.uid;
    const isHandler = data.handler       === req.user.uid;
    // Audit M-2: the assigned volunteer is staff too. The canonical staff check
    // elsewhere (getOne.ts/attachments.ts/done.ts) keys off assignedVolunteerId,
    // not just handler; mirror it here so a volunteer assigned via
    // assignedVolunteerId (should the two fields ever diverge) isn't 403'd off
    // their own case timeline, and is consistently treated as internal-visible.
    const isAssignedVolunteer = data.assignedVolunteerId === req.user.uid;
    const isAdmin   = req.user.role      === 'admin';

    if (!isOwner && !isHandler && !isAssignedVolunteer && !isAdmin) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Determine which visibility levels this caller may see.
    const canSeeInternal = isAdmin || isHandler || isAssignedVolunteer;

    // Sort client-side by createdAt (ascending) instead of Firestore orderBy
    // so this equality query needs no composite index — the set is small.
    const eventsSnap = await db()
      .collection('requestEvents')
      .where('requestId', '==', id)
      .get();

    const events = eventsSnap.docs
      .map((d) => {
        const ev = d.data();
        return {
          id:         d.id,
          type:       ev.type,
          visibility: ev.visibility,
          actorId:    ev.actorId,
          details:    ev.details ?? {},
          createdAt:  ev.createdAt?.toDate?.()?.toISOString?.() ?? null,
        };
      })
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
      // Filter internal events unless the caller may see them.
      .filter((ev) => canSeeInternal || ev.visibility !== 'internal');

    res.json({ events });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.events] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
}
