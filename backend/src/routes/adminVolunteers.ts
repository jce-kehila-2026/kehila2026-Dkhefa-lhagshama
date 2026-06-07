/**
 * /api/admin/volunteers — Admin-only volunteer management (#73).
 *
 * Endpoints:
 *   GET  /api/admin/volunteers             — list pending + active volunteers
 *   POST /api/admin/volunteers/:id/approve — approve a volunteer application
 *   POST /api/admin/volunteers/:id/reject  — reject a volunteer application
 *   POST /api/admin/volunteers/:uid/deactivate — deactivate an active volunteer
 *
 * On approve:
 *   1. Updates volunteerApplications/{id}.status = 'approved'
 *   2. Creates/updates volunteers/{uid} doc
 *   3. Sets custom claim: { role: 'volunteer' } via Firebase Auth Admin SDK
 *   4. Writes audit log
 *
 * Assumptions about volunteerApplications doc shape (Stream 3 defines this):
 *   {
 *     uid: string,           // applicant's Firebase uid
 *     status: 'pending' | 'approved' | 'rejected',
 *     fullName: string,
 *     email: string,
 *     profession?: string,
 *     languages?: string[],  // e.g. ['he', 'am', 'en']
 *     areas?: string[],      // volunteering area tags
 *     availability?: string, // e.g. '2-4h/week'
 *     submittedAt: Timestamp,
 *   }
 *   If a field is absent, code reads defensively and falls back to null.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db, auth as adminAuth } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';
import { writeAuditLog } from '@/lib/audit';

const router = Router();
router.use(authenticate, requireRole('admin'));

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
      return {
        id: d.id,
        uid: data.uid ?? d.id,
        fullName: data.fullName ?? null,
        email: data.email ?? null,
        profession: data.profession ?? null,
        languages: data.languages ?? [],
        areas: data.areas ?? [],
        availability: data.availability ?? null,
        status: data.status,
        submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });
    // Newest applications first (replaces Firestore orderBy).
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
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const appData = appSnap.data()!;
    // The uid may be stored as 'uid' or the doc id may BE the uid (Stream 3 decides).
    // We check both defensively.
    const volunteerUid: string = (appData.uid as string) ?? applicationId;

    // 1. Update application status
    await appRef.update({
      status: 'approved',
      approvedBy: actorId,
      approvedAt: FieldValue.serverTimestamp(),
      ...(note ? { approvalNote: note } : {}),
    });

    // 2. Create/update volunteers/{uid} doc
    await db()
      .collection('volunteers')
      .doc(volunteerUid)
      .set(
        {
          uid: volunteerUid,
          fullName: appData.fullName ?? null,
          email: appData.email ?? null,
          profession: appData.profession ?? null,
          languages: appData.languages ?? [],
          areas: appData.areas ?? [],
          availability: appData.availability ?? null,
          active: true,
          approvedBy: actorId,
          approvedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    // 3. Set custom claim: role = 'volunteer'
    await adminAuth().setCustomUserClaims(volunteerUid, { role: 'volunteer' });

    // 4. Audit log
    await writeAuditLog({
      actorId,
      action: 'volunteer.approve',
      entityType: 'volunteerApplications',
      entityId: applicationId,
      details: { volunteerUid, note: note ?? null },
    });

    res.json({ ok: true, volunteerUid });
  } catch (err) {
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
    if (!(await appRef.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await appRef.update({
      status: 'rejected',
      rejectedBy: actorId,
      rejectedAt: FieldValue.serverTimestamp(),
      ...(note ? { rejectionNote: note } : {}),
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
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
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
    if (!matched) {
      res.status(404).json({ error: 'no_pending_request_for_category' });
      return;
    }

    const update: Record<string, unknown> = {
      requestedCategories: updatedRequested,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (action === 'approve') {
      update.approvedCategories = FieldValue.arrayUnion(category);
    }
    await ref.set(update, { merge: true });

    await writeAuditLog({
      actorId: req.user!.uid,
      action: action === 'approve' ? 'volunteer.category_approve' : 'volunteer.category_reject',
      entityType: 'volunteers',
      entityId: uid,
      details: { category },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminVolunteers] POST /:uid/categories:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
