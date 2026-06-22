/**
 * GET /api/admin/requests — list + filter all requests (#75).
 *
 * Extracted verbatim from the original single-file router.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { REQUEST_STATUSES, type RequestStatus } from '@/routes/requests';
import { sortByPriority } from '@/lib/requestSort';
import { volunteerDisplayName } from '@/lib/displayName';
import { needsNameResolution } from '@/lib/assignedName';

// ── GET /api/admin/requests ───────────────────────────────────────────────
// Optional query params: status, category, urgency, volunteerId, sort
// ('newest' default | 'priority'), limit (default 50)
export async function listRequests(req: Request, res: Response): Promise<void> {
  try {
    const { status, category, urgency, archived, volunteerId, sort, limit: limitStr } =
      req.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(limitStr ?? '50', 10) || 50, 200);

    // Fetch the whole collection and filter + sort + limit IN MEMORY. This
    // deliberately avoids every composite index (status/category/urgency +
    // createdAt) so the admin list works on any environment without an index
    // deploy. The request volume for this NGO is small enough that this is fine.
    const archivedMode = archived ?? 'false';
    const wantStatus =
      status && REQUEST_STATUSES.includes(status as RequestStatus) ? status : undefined;

    const snap = await db().collection('requests').get();
    const docs = snap.docs.filter((d) => {
      const dd = d.data();
      if (wantStatus && dd.status !== wantStatus) return false;
      if (category && dd.category !== category) return false;
      if (urgency && dd.urgency !== urgency) return false;
      if (volunteerId && dd.assignedVolunteerId !== volunteerId) return false;
      if (archivedMode === 'all') return true;
      const isArchived = dd.archived === true;
      return archivedMode === 'true' ? isArchived : !isArchived;
    });

    // Priority sort keys read straight off the doc (urgency/deadline/taken) so
    // sorting stays synchronous even though row projection is now async (WS-5).
    const sortKey = (d: (typeof docs)[number]) => {
      const dd = d.data();
      return {
        urgency: dd.urgency ?? null,
        deadline: (dd.deadline as string | null | undefined) ?? null,
        wasPreviouslyTaken: dd.wasPreviouslyTaken === true,
      };
    };

    const toRow = async (d: (typeof docs)[number]) => {
      const data = d.data();
      // Name-vs-id fix (WS-5): never emit a raw uid in the assigned cell. When
      // the denormalized name is missing, empty, or equal to the uid (legacy
      // rows), resolve a human name live through the shared display-name chain.
      const assignedUid = (data.assignedVolunteerId as string | null | undefined) ?? null;
      const storedName = (data.assignedVolunteerName as string | null | undefined) ?? null;
      const resolvedAssignedName =
        assignedUid && needsNameResolution(storedName, assignedUid)
          ? await volunteerDisplayName(assignedUid)
          : storedName;
      // Compact close-handshake state (req 25) so the admin list can flag
      // pending consent-close proposals without a detail fetch.
      const cr = (data.closeRequest as Record<string, unknown> | null | undefined) ?? null;
      return {
        id: d.id,
        displayId:            data.displayId ?? null,
        beneficiaryId:        data.beneficiaryId,
        firstName:            data.firstName,
        lastName:             data.lastName,
        email:                data.email,
        phone:                data.phone,
        city:                 data.city,
        category:             data.category,
        urgency:              data.urgency,
        status:               data.status,
        archived:             data.archived === true,
        description:          data.description,
        assignedVolunteerId:  data.assignedVolunteerId ?? null,
        assignedVolunteerName: resolvedAssignedName ?? null,
        handler:              data.handler ?? null,
        deadline:             data.deadline ?? null,
        notes:                data.notes ?? '',
        referral:             data.referral ?? null,
        attachments:          data.attachments ?? [],
        closeRequest: cr
          ? {
              proposedRole:        cr.proposedRole ?? null,
              proposedAt:          cr.proposedAt ?? null,
              volunteerApproved:   cr.volunteerApproved === true,
              beneficiaryApproved: cr.beneficiaryApproved === true,
            }
          : null,
        // Pool / task / claim fields (reqs 20, 22) for list badges.
        title:                data.title ?? null,
        origin:              (data.origin as string | undefined) ?? 'beneficiary',
        requestType:         (data.requestType as string | undefined) ?? 'assistance',
        poolStatus:          (data.poolStatus as string | undefined) ?? 'none',
        hasClaims:            data.hasClaims === true,
        claimsCount:          Array.isArray(data.claims) ? data.claims.length : 0,
        wasPreviouslyTaken:   data.wasPreviouslyTaken === true,
        createdAt:            data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        updatedAt:            data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
        assignedAt:           data.assignedAt?.toDate?.()?.toISOString?.() ?? null,
      };
    };

    // sort=priority reuses the canonical urgency/deadline order (req 19);
    // the default stays createdAt descending ('newest'). toRow is async (it may
    // resolve a legacy assigned name live), so map then Promise.all.
    const ordered =
      sort === 'priority'
        ? sortByPriority(docs.map((d) => ({ ref: d, ...sortKey(d) }))).map((x) => x.ref)
        : [...docs].sort((a, b) => {
            const ta = a.data().createdAt?.toDate?.()?.getTime?.() ?? 0;
            const tb = b.data().createdAt?.toDate?.()?.getTime?.() ?? 0;
            return tb - ta; // newest first
          });
    const items = (await Promise.all(ordered.slice(0, limit).map(toRow)));

    res.json({ items });
  } catch (err) {
    console.error('[adminRequests] GET /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}
