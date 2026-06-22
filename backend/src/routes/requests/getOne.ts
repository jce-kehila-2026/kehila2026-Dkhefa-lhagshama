/**
 * GET /api/requests/:id — defense-in-depth read of a single request, with a
 * role-scoped projection (F2).
 *
 * Mechanical extraction from the former single-file routes/requests.ts —
 * the handler logic is unchanged.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';

// ── GET /api/requests/:id ────────────────────────────────────────────────
// Defense-in-depth read of a single request. Rules already enforce, but we
// also check here so the API returns a clean 403/404 instead of leaking the
// Firestore error shape.
export async function getRequest(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const id = req.params.id;
  try {
    const snap = await db().collection('requests').doc(id).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const data = snap.data() as Record<string, unknown> & {
      beneficiaryId?: string;
      handler?: string | null;
      assignedVolunteerId?: string | null;
    };
    const isOwner             = data.beneficiaryId === req.user.uid;
    const isHandler           = data.handler === req.user.uid;
    const isAssignedVolunteer = data.assignedVolunteerId === req.user.uid;
    const isAdmin             = req.user.role === 'admin';
    if (!isOwner && !isHandler && !isAssignedVolunteer && !isAdmin) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // ── Role-scoped projection (F2) ────────────────────────────────────────
    // Firestore has no field-level projection, so strip sensitive fields here.
    // firestore.rules restricts the direct client read of this doc to
    // owner/admin (F2-B), so staff always arrive through this projected path.
    //   - national ID (idNumber/idNote): owner + admin only
    //   - internal staff notes:          staff (handler/volunteer) + admin only
    //   - staff-only arrays/handshakes:   admin + staff only, NEVER the owner
    const projected: Record<string, unknown> = { id: snap.id, ...data };
    if (!isAdmin) {
      if (isOwner) {
        // The owner sees their own request but none of the internal staff
        // working data: free-text staff notes, volunteer hand-off drop reports
        // (written "for staff eyes"), the claims roster (other volunteers'
        // identities + claim notes), and staff routing/identity fields. These
        // were spread in via `...data`, so strip them explicitly to keep them
        // off the beneficiary surface.
        delete projected.notes;
        delete projected.dropReports;
        delete projected.claims;
        delete projected.handler;
        delete projected.assignedVolunteerId;
        delete projected.assignedVolunteerName;
        delete projected.submittedBy;
        delete projected.submittedByRole;
        // The close-consent handshake (req 25) MUST stay visible to the owner:
        // the beneficiary drives the approve/decline of a volunteer-proposed
        // close from ChatWindowPage, which reads `closeRequest` off this very
        // endpoint. Don't strip it — but replace the full doc with a
        // beneficiary-safe subset so no future staff-only fields leak through
        // it. The kept fields are exactly what the UI needs (handshake state +
        // proposer attribution); `proposedBy` is always a chat participant the
        // beneficiary already sees, so it carries no new identity.
        const cr = projected.closeRequest as Record<string, unknown> | null | undefined;
        projected.closeRequest = cr
          ? {
              proposedBy: cr.proposedBy ?? null,
              proposedRole: cr.proposedRole ?? null,
              proposedAt: cr.proposedAt ?? null,
              volunteerApproved: cr.volunteerApproved === true,
              beneficiaryApproved: cr.beneficiaryApproved === true,
            }
          : null;
        // Internal referral routing fields (the admin's uid + internal answer
        // doc id) are not part of the owner's view — mirror the clean referral
        // projection used by GET /api/requests/mine (Note 6 below).
        const rf = projected.referral as Record<string, unknown> | null | undefined;
        if (rf) {
          projected.referral = {
            partnerName: rf.partnerName ?? '',
            phone: rf.phone ?? null,
            email: rf.email ?? null,
            website: rf.website ?? null,
            note: rf.note ?? '',
            referredAt:
              (rf.referredAt as { toDate?: () => Date } | undefined)?.toDate?.()?.toISOString?.() ??
              rf.referredAt ??
              null,
          };
        }
      } else {
        delete projected.idNumber;
        delete projected.idNote;
        // Task-aware attachment filter (review r6, finding 4): the staff branch
        // (assigned volunteer/handler) must see the SAME attachment set the
        // download endpoint will mint URLs for — otherwise it leaks the names +
        // Storage paths of staff-only files an admin withheld from volunteers.
        // On a `task` request, drop any attachment not flagged volunteerVisible,
        // mirroring volunteerApp.ts projectAttachments and the per-attachment
        // gate in GET /:id/attachments/:name. Non-task requests keep all.
        const atts = (data.attachments as Array<{ volunteerVisible?: boolean }> | undefined) ?? [];
        projected.attachments =
          data.requestType === 'task'
            ? atts.filter((a) => a?.volunteerVisible === true)
            : atts;
      }
    }
    res.json(projected);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
}
