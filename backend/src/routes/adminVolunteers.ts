/**
 * /api/admin/volunteers — Admin-only volunteer management (#73).
 *
 * Endpoints:
 *   GET  /api/admin/volunteers             — list pending + active volunteers
 *   POST /api/admin/volunteers/:id/approve — approve a volunteer application
 *   POST /api/admin/volunteers/:id/reject  — reject a volunteer application
 *   POST /api/admin/volunteers/:uid/deactivate — deactivate an active volunteer
 *   POST /api/admin/volunteers/:uid/categories — approve/reject a category request (req 15)
 *
 * Every route is admin-gated by the router-level authenticate + requireRole('admin').
 *
 * On approve:
 *   1. Updates volunteerApplications/{id}.status = 'approved'
 *   2. Creates/updates volunteers/{uid} doc
 *   3. Sets custom claim: { role: 'volunteer' } via Firebase Auth Admin SDK
 *   4. Writes audit log
 *
 * volunteerApplications doc shape — TWO shapes coexist and both are tolerated:
 *   Legacy/admin shape:          Apply-endpoint shape (volunteers.ts):
 *   {                            {
 *     uid: string,                 uid: string,
 *     status: 'pending' | ...,     status: 'pending' | ...,
 *     fullName: string,            firstName: string, lastName: string,
 *     email: string,               email: string,
 *     profession?: string,         profession?: string,
 *     languages?: string[],        languages?: string[],
 *     areas?: string[],            areasOfHelp?: string[],
 *     availability?: string,       availability?: string,
 *     submittedAt: Timestamp,      createdAt: Timestamp,
 *   }                            }
 *   Readers resolve fullName ?? firstName+lastName, areas ?? areasOfHelp, and
 *   submittedAt ?? createdAt (Timestamp or ISO string). Absent fields fall
 *   back to null.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db, auth as adminAuth } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { removeVolunteerFromRequestChat } from '@/lib/chatOnAssign';

const router = Router();
router.use(authenticate, requireRole('admin'));

// Thrown inside a transaction to bail out with a specific HTTP status (mirrors
// the TransitionError pattern used by the adminRequests handlers).
class VolDecisionError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'VolDecisionError';
  }
}

// ── GET /api/admin/volunteers ─────────────────────────────────────────────
// Returns pending applications + active volunteers list.
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const [pendingSnap, activeSnap] = await Promise.all([
      db()
        // Sorted client-side by submittedAt below so this equality query needs
        // no composite index (pending applications are few).
        .collection('volunteerApplications')
        .where('status', '==', 'pending')
        .limit(100)
        .get(),
      db()
        .collection('volunteers')
        .where('active', '==', true)
        .limit(100)
        .get(),
    ]);

    const pending = pendingSnap.docs.map((d) => {
      const data = d.data();
      // Apply (volunteers.ts) writes firstName/lastName/areasOfHelp/createdAt;
      // older docs may carry fullName/areas/submittedAt. Tolerate both shapes.
      const composedName = [data.firstName, data.lastName].filter(Boolean).join(' ');
      const submittedAtRaw = data.submittedAt ?? data.createdAt;
      return {
        id: d.id,
        uid: data.uid ?? d.id,
        fullName: data.fullName ?? (composedName || null),
        email: data.email ?? null,
        profession: data.profession ?? null,
        languages: data.languages ?? [],
        areas: data.areas ?? data.areasOfHelp ?? [],
        availability: data.availability ?? null,
        status: data.status,
        submittedAt:
          submittedAtRaw?.toDate?.()?.toISOString?.() ??
          (typeof submittedAtRaw === 'string' ? submittedAtRaw : null),
      };
    });
    // Newest applications first (replaces Firestore orderBy); sorts on the
    // resolved submittedAt (submittedAt ?? createdAt) mapped above.
    pending.sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

    const active = activeSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        uid: d.id,
        fullName: data.fullName ?? null,
        email: data.email ?? null,
        profession: data.profession ?? null,
        languages: data.languages ?? [],
        areas: data.areas ?? [],
        availability: data.availability ?? null,
        active: data.active,
        approvedAt: data.approvedAt?.toDate?.()?.toISOString?.() ?? null,
        // Volunteer ops fields (req 14e / 15).
        workStatus: (data.workStatus as string | undefined) ?? 'free',
        approvedCategories: (data.approvedCategories as string[] | undefined) ?? [],
        requestedCategories:
          (data.requestedCategories as Array<Record<string, unknown>> | undefined) ?? [],
        // Availability (WS-7): recurring weekly windows + optional return date.
        availabilityWindows:
          (data.availabilityWindows as Array<{ day: number; start: string; end: string }> | undefined) ?? [],
        availableAgainOn: (data.availableAgainOn as string | null | undefined) ?? null,
      };
    });

    // Flatten all PENDING category-permission requests across volunteers (req 15)
    // so the admin can approve/reject them from one list.
    const categoryRequests = active.flatMap((v) =>
      (v.requestedCategories as Array<{ category?: string; note?: string; requestedAt?: string; status?: string }>)
        .filter((c) => (c.status ?? 'pending') === 'pending')
        .map((c) => ({
          uid: v.uid,
          fullName: v.fullName,
          category: c.category ?? '',
          note: c.note ?? '',
          requestedAt: c.requestedAt ?? null,
        })),
    );

    res.json({ pending, active, categoryRequests });
  } catch (err) {
    console.error('[adminVolunteers] GET /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

const noteSchema = z.object({ note: z.string().max(500).optional() });

// ── POST /api/admin/volunteers/:id/approve ────────────────────────────────
router.post('/:id/approve', async (req: Request, res: Response): Promise<void> => {
  const parsed = noteSchema.safeParse(req.body);
  const note = parsed.success ? (parsed.data.note ?? null) : null;
  const applicationId = req.params.id;
  const actorId = req.user!.uid;

  try {
    const appRef = db().collection('volunteerApplications').doc(applicationId);

    // Captured inside the transaction, consumed by the post-commit writes.
    let volunteerUid = applicationId;
    let rosterDoc: Record<string, unknown> = {};

    // RACE FIX (audit L10): the pending-guard previously ran on a plain .get()
    // snapshot, so two concurrent approves could BOTH pass it (and re-grant the
    // claim / re-activate the volunteer twice). Re-assert "still pending" INSIDE
    // the transaction so only the first approve commits; a stale second one gets
    // 409 already_decided (or concurrent_update if it loses the race).
    await db().runTransaction(async (tx) => {
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) throw new VolDecisionError(404, 'not_found');
      const appData = appSnap.data()!;
      if (appData.status !== 'pending') {
        throw new VolDecisionError(409, 'already_decided', { status: appData.status });
      }
      // uid may be stored as 'uid' or the doc id may BE the uid — check both.
      volunteerUid = (appData.uid as string) ?? applicationId;
      // Resolve dual application shapes (see doc-shape comment at top) so the
      // roster gets a real name instead of a null fullName falling back to uid.
      const composedName = [appData.firstName, appData.lastName].filter(Boolean).join(' ');
      rosterDoc = {
        uid: volunteerUid,
        fullName: appData.fullName ?? (composedName || null),
        email: appData.email ?? null,
        profession: appData.profession ?? null,
        languages: appData.languages ?? [],
        areas: appData.areas ?? appData.areasOfHelp ?? [],
        availability: appData.availability ?? null,
        active: true,
        approvedBy: actorId,
        approvedAt: FieldValue.serverTimestamp(),
      };
      tx.update(appRef, {
        status: 'approved',
        approvedBy: actorId,
        approvedAt: FieldValue.serverTimestamp(),
        ...(note ? { approvalNote: note } : {}),
      });
    });

    // Post-commit side effects. The roster doc (a different collection) and the
    // Auth custom claim are not part of the application-status transaction, so
    // they run only after it committed — ordering: roster, then role claim, then
    // audit. A second concurrent approve never reaches here (it 409'd above).
    await db().collection('volunteers').doc(volunteerUid).set(rosterDoc, { merge: true });
    await adminAuth().setCustomUserClaims(volunteerUid, { role: 'volunteer' });
    await writeAuditLog({
      actorId,
      action: 'volunteer.approve',
      entityType: 'volunteerApplications',
      entityId: applicationId,
      details: { volunteerUid, note: note ?? null },
    });

    res.json({ ok: true, volunteerUid });
  } catch (err) {
    if (err instanceof VolDecisionError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    if ((err as { code?: number }).code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    console.error('[adminVolunteers] POST /:id/approve:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/volunteers/:id/reject ─────────────────────────────────
router.post('/:id/reject', async (req: Request, res: Response): Promise<void> => {
  const parsed = noteSchema.safeParse(req.body);
  const note = parsed.success ? (parsed.data.note ?? null) : null;
  const applicationId = req.params.id;
  const actorId = req.user!.uid;

  try {
    const appRef = db().collection('volunteerApplications').doc(applicationId);

    // RACE FIX (audit L10): re-assert "still pending" inside the transaction
    // (mirrors approve) so a reject can't flip an already-approved volunteer and
    // concurrent decisions can't both commit.
    await db().runTransaction(async (tx) => {
      const appSnap = await tx.get(appRef);
      if (!appSnap.exists) throw new VolDecisionError(404, 'not_found');
      if (appSnap.data()!.status !== 'pending') {
        throw new VolDecisionError(409, 'already_decided', { status: appSnap.data()!.status });
      }
      tx.update(appRef, {
        status: 'rejected',
        rejectedBy: actorId,
        rejectedAt: FieldValue.serverTimestamp(),
        ...(note ? { rejectionNote: note } : {}),
      });
    });

    await writeAuditLog({
      actorId,
      action: 'volunteer.reject',
      entityType: 'volunteerApplications',
      entityId: applicationId,
      details: { note: note ?? null },
    });

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof VolDecisionError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    if ((err as { code?: number }).code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    console.error('[adminVolunteers] POST /:id/reject:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/volunteers/:uid/deactivate ────────────────────────────
// Deactivates a volunteer: sets volunteers/{uid}.active = false,
// reverts custom claim back to no role (null claim).
router.post('/:uid/deactivate', async (req: Request, res: Response): Promise<void> => {
  const volunteerUid = req.params.uid;
  const actorId = req.user!.uid;

  try {
    const volRef = db().collection('volunteers').doc(volunteerUid);
    if (!(await volRef.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await volRef.update({
      active: false,
      deactivatedBy: actorId,
      deactivatedAt: FieldValue.serverTimestamp(),
    });

    // Revert role claim to null (remove the volunteer role)
    await adminAuth().setCustomUserClaims(volunteerUid, { role: null });

    await writeAuditLog({
      actorId,
      action: 'volunteer.deactivate',
      entityType: 'volunteers',
      entityId: volunteerUid,
      details: {},
    });

    // RECONCILE IN-FLIGHT CASES (audit MODERATE): deactivating a volunteer used
    // to touch only the volunteers doc + the role claim, STRANDING every request
    // still assigned to them — the case stayed in_progress with a handler who can
    // no longer act (their role claim is gone, so requireAnyRole('volunteer')
    // now blocks them from even dropping it), they kept chat/PII access via the
    // participants array, and nothing surfaced the problem. We return each
    // non-terminal assigned request to the pool, strip the volunteer from its
    // chat, and emit a visible timeline event so the hand-off is transparent.
    // Best-effort: this runs after the deactivate already committed, so a failure
    // here is logged but never fails the response.
    try {
      const assigned = await db()
        .collection('requests')
        .where('assignedVolunteerId', '==', volunteerUid)
        .get();
      const NON_TERMINAL = new Set(['pending', 'in_progress', 'awaiting_review']);
      const toPool = assigned.docs.filter((d) => NON_TERMINAL.has((d.data().status as string) ?? ''));
      if (toPool.length) {
        // One batched write returns them all to the pool atomically.
        const batch = db().batch();
        for (const d of toPool) {
          batch.update(d.ref, {
            assignedVolunteerId: null,
            handler: null,
            assignedVolunteerName: null,
            assignedAt: null,
            status: 'pending',
            poolStatus: 'available',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        await batch.commit();
        // Per-request follow-ups: revoke chat access + record the event.
        await Promise.all(
          toPool.map(async (d) => {
            await removeVolunteerFromRequestChat(d.id, volunteerUid).catch(() => {});
            await writeRequestEvent({
              requestId: d.id,
              type: 'status_changed',
              actorId,
              visibility: 'all',
              details: { kind: 'volunteer_deactivated', to: 'pending', poolStatus: 'available' },
            }).catch(() => {});
          }),
        );
      }
    } catch (err) {
      console.error('[adminVolunteers] deactivate reconcile failed:', err);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminVolunteers] POST /:uid/deactivate:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/volunteers/:uid/categories ────────────────────────────
// Approve or reject a volunteer's category-permission request (req 15).
// Category permissions are INFORMATIONAL (they don't gate the pool) — approving
// records the category on the volunteer's profile and resolves the pending entry.
// Deliberately NO taxonomy validation here: the handler below only acts on a
// category that matches a PENDING requestedCategories entry on the volunteer
// doc (404 otherwise), and that entry is the provenance check. Volunteers used
// to request categories as free text, so legacy entries (e.g. a Hebrew name
// that predates the taxonomy) must stay approvable AND rejectable — a taxonomy
// check would 400 both actions and strand the entry in the pending list.
const categoryDecisionSchema = z.object({
  category: z.string().trim().min(1).max(80),
  action: z.enum(['approve', 'reject']),
});

router.post('/:uid/categories', async (req: Request, res: Response): Promise<void> => {
  const parsed = categoryDecisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { category, action } = parsed.data;
  const { uid } = req.params;
  const ref = db().collection('volunteers').doc(uid);

  try {
    // RACE FIX (audit MODERATE #3): this whole-array read-map-write used to run
    // outside a transaction, so a volunteer concurrently appending a new request
    // via FieldValue.arrayUnion (volunteerApp/me.ts) could be silently clobbered
    // (admin reads [A], volunteer commits [A,B], admin overwrites with [A]). Two
    // admins deciding different entries also lost one. Running the read-map-write
    // in a transaction makes Firestore re-read on conflict, so the rewrite always
    // includes the latest entries. approvedCategories stays an atomic arrayUnion.
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new VolDecisionError(404, 'not_found');
      const data = snap.data() ?? {};
      const requested = (data.requestedCategories as Array<Record<string, unknown>> | undefined) ?? [];
      const nextStatus = action === 'approve' ? 'approved' : 'rejected';
      let matched = false;
      const updatedRequested = requested.map((c) => {
        if (c.category === category && (c.status ?? 'pending') === 'pending') {
          matched = true;
          return { ...c, status: nextStatus, decidedAt: new Date().toISOString() };
        }
        return c;
      });
      if (!matched) throw new VolDecisionError(404, 'no_pending_request_for_category');

      const update: Record<string, unknown> = {
        requestedCategories: updatedRequested,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (action === 'approve') {
        update.approvedCategories = FieldValue.arrayUnion(category);
      }
      tx.set(ref, update, { merge: true });
    });

    // Audit only after the decision committed.
    await writeAuditLog({
      actorId: req.user!.uid,
      action: action === 'approve' ? 'volunteer.category_approve' : 'volunteer.category_reject',
      entityType: 'volunteers',
      entityId: uid,
      details: { category },
    });

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof VolDecisionError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    if ((err as { code?: number }).code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    console.error('[adminVolunteers] POST /:uid/categories:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
