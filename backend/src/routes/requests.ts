/**
 * /api/requests — UC-01 Submit Assistance Request.
 *
 * All writes go through the Admin SDK (which bypasses Firestore rules).
 * The client never writes to /requests directly — rules `allow create: if false`.
 *
 * Roles allowed to submit:
 *   - beneficiary: submitting for themselves
 *   - volunteer:   submitting on behalf of a beneficiary (UC-01 alt flow A2);
 *                  the volunteer's uid is recorded as the actor; `onBehalfOf`
 *                  holds the target beneficiary uid if known.
 *
 * Admin can read everything via UC-05; rules + GET /api/requests/:id enforce.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { isAllowedCategory } from '@/lib/categoriesCache';
import { writeRequestEvent } from '@/lib/requestEvents';
import { authenticate } from '@/middleware/auth';
import { canTransition, REQUEST_STATUSES, type RequestStatus } from '@/lib/requestTransitions';
import { mintSignedReadUrl, SIGNED_URL_TTL_MS } from '@/lib/signedUrl';
import { applyCloseConsent } from '@/lib/closeConsent';

const router = Router();

// ── Status lifecycle (Note 6) ───────────────────────────────────────────────
// The canonical status enum + transition map now live in
// `@/lib/requestTransitions`. Re-exported here for the many existing importers
// (adminRequests, adminStats) so nothing breaks while they migrate.
export { REQUEST_STATUSES };
export type { RequestStatus };

// ── Schema ────────────────────────────────────────────────────────────────
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createRequestSchema = z
  .object({
    // Client-generated UUID, used as both Firestore doc id and Storage path prefix.
    // Using `create()` server-side rejects duplicate ids loudly.
    requestId: z.string().regex(UUID_V4, 'requestId must be a v4 UUID'),

    // Personal info
    firstName: z.string().trim().min(1).max(80),
    lastName:  z.string().trim().min(1).max(80),

    // Identity (#66). idType drives whether an Israeli ID number is required.
    //   israeli_id → idNumber required
    //   passport / none → idNumber optional, idNote explains the situation
    idType:   z.enum(['israeli_id', 'passport', 'none']).default('israeli_id'),
    idNumber: z.string().trim().max(40).optional().default(''),
    idNote:   z.string().trim().max(400).optional().default(''),

    phone:     z.string().trim().min(1).max(40),
    email:     z.string().trim().email().max(120),
    city:      z.string().trim().min(1).max(80),
    age:       z.coerce.number().int().min(0).max(120),
    gender:    z.enum(['male', 'female', 'other', '']).default(''),

    // Request body. `category` is validated against the live admin-managed
    // taxonomy (Firestore `categories` collection) in the async superRefine
    // below — no more static enum. Fail-open if the taxonomy is unseeded
    // (see lib/categoriesCache).
    category:    z.string().trim().min(1).max(80),
    description: z.string().trim().min(10).max(4000),
    urgency:     z.enum(['low', 'medium', 'high']).default('low'),

    // Optional deadline (#68). ISO date or datetime string; validated parseable.
    deadline: z
      .string()
      .trim()
      .refine((s) => !Number.isNaN(Date.parse(s)), 'deadline must be a valid date')
      .optional(),

    // Consent — must be true. Aligns with wiki UC-01 step 4.
    consent: z.literal(true, {
      errorMap: () => ({ message: 'consent must be true' }),
    }),

    // Optional Storage paths under requests/{requestId}/...
    attachmentPaths: z.array(z.string().min(1)).max(20).optional().default([]),

    // Volunteer-on-behalf flag (UC-01 A2). Persisted only when the caller is a
    // volunteer; ignored for beneficiaries (see docRef.create below).
    onBehalf: z.boolean().optional().default(false),

    // Volunteer-on-behalf alt flow (UC-01 A2). Full UX deferred; schema scaffolded.
    onBehalfOf: z
      .object({
        uid: z.string().min(1).optional(),
      })
      .optional(),
  })
  .superRefine(async (data, ctx) => {
    // An Israeli ID number is mandatory only when idType is israeli_id (#66).
    if (data.idType === 'israeli_id' && data.idNumber.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['idNumber'],
        message: 'idNumber is required when idType is israeli_id',
      });
    }

    // Category must be an ACTIVE (non-archived) taxonomy id. Async because the
    // id set lives in Firestore (cached ~60s) — hence safeParseAsync below.
    if (!(await isAllowedCategory(data.category, 'active'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'unknown category',
      });
    }
  });

type CreateRequestInput = z.infer<typeof createRequestSchema>;

/** Thrown inside a transaction to bail out with a specific HTTP status. */
class TransitionError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'TransitionError';
  }
}

// ── POST /api/requests ────────────────────────────────────────────────────
router.post('/', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  // Role gate. Beneficiary submits for self; volunteer can submit on behalf.
  // We don't `requireRole('beneficiary')` because that would block volunteers.
  const role = req.user.role;
  if (role !== 'beneficiary' && role !== 'volunteer') {
    res.status(403).json({
      error: 'forbidden',
      detail: 'submitting requests requires the beneficiary or volunteer role',
    });
    return;
  }

  // safeParseAsync: the schema's superRefine awaits the category taxonomy.
  const parsed = await createRequestSchema.safeParseAsync(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const input: CreateRequestInput = parsed.data;

  // The beneficiaryId is the target user. For a volunteer submitting on behalf
  // with a known uid, use that; otherwise the beneficiary is the caller (the
  // common case — UC-01 main flow).
  const beneficiaryId =
    role === 'volunteer' && input.onBehalfOf?.uid ? input.onBehalfOf.uid : req.user.uid;

  const docRef = db().collection('requests').doc(input.requestId);

  try {
    await docRef.create({
      beneficiaryId,
      submittedBy: req.user.uid,             // who actually pressed submit
      submittedByRole: role,                 // 'beneficiary' or 'volunteer'
      onBehalf: role === 'volunteer' ? input.onBehalf === true : false,

      // Personal info snapshot at submit time
      firstName: input.firstName,
      lastName:  input.lastName,
      idType:    input.idType,
      idNumber:  input.idNumber,
      idNote:    input.idNote,
      phone:     input.phone,
      email:     input.email,
      city:      input.city,
      age:       input.age,
      gender:    input.gender,

      // Body
      category:    input.category,
      description: input.description,
      urgency:     input.urgency,
      deadline:    input.deadline ?? null,

      // Lifecycle
      status:              'pending',
      handler:             null,
      assignedVolunteerId: null,
      assignedAt:          null,
      notes:               '',

      // Attachments
      attachmentPaths: input.attachmentPaths ?? [],

      // Timestamps
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // `create()` throws ALREADY_EXISTS (gRPC code 6) if the doc already exists.
    const code = (err as { code?: number }).code;
    if (code === 6) {
      res.status(409).json({ error: 'duplicate_request_id' });
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[requests.create] failed:', err);
    res.status(500).json({ error: 'internal' });
    return;
  }

  // Audit log — fire-and-forget. Don't block the response on it; surface in
  // server logs if it fails.
  writeAuditLog({
    actorId: req.user.uid,
    action: 'request.create',
    entityType: 'requests',
    entityId: input.requestId,
    details: {
      beneficiaryId,
      category: input.category,
      urgency:  input.urgency,
      hasAttachments: (input.attachmentPaths?.length ?? 0) > 0,
    },
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[requests.create] audit write failed:', err);
  });

  // Timeline event — user-facing history (#65). Fire-and-forget like the audit
  // log. visibility 'all' so the beneficiary sees their request was received.
  writeRequestEvent({
    requestId: input.requestId,
    type: 'created',
    actorId: req.user.uid,
    visibility: 'all',
    details: { category: input.category, urgency: input.urgency },
  }).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[requests.create] event write failed:', err);
  });

  res.status(201).json({ requestId: input.requestId });
});

// ── GET /api/requests/mine ───────────────────────────────────────────────
// Returns the caller's own requests, newest first. Capped at 50 for now;
// pagination can come later if we need it.
router.get('/mine', authenticate, async (req: Request, res: Response) => {
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
});

// ── POST /api/requests/:id/done ──────────────────────────────────────────
// Volunteer-scoped "mark as done" (Note 6). ASSIGNED-HANDLER ONLY: the caller
// must be the request's assignedVolunteerId or handler (admins also allowed).
// Valid only for the transition in_progress → awaiting_review. Writes a
// timestamped requestEvent and returns the updated request.
router.post('/:id/done', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const requestId = req.params.id;
  const actorId = req.user.uid;
  const ref = db().collection('requests').doc(requestId);

  let prevStatus: string | null = null;

  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new TransitionError(404, 'not_found');
      }
      const data = snap.data() as {
        status?: string;
        handler?: string | null;
        assignedVolunteerId?: string | null;
      };

      const isAdmin = req.user!.role === 'admin';
      const isAssigned =
        data.assignedVolunteerId === actorId || data.handler === actorId;

      // Assigned-handler gate: non-admin callers must own the request.
      if (!isAdmin && !isAssigned) {
        throw new TransitionError(403, 'forbidden');
      }

      prevStatus = data.status ?? null;

      // The volunteer's only legal move is in_progress → awaiting_review.
      const allowed = canTransition(prevStatus, 'awaiting_review', {
        role: isAdmin ? 'admin' : 'volunteer',
        isAssigned,
      });
      if (!allowed) {
        throw new TransitionError(409, 'invalid_transition', {
          from: prevStatus,
          to: 'awaiting_review',
        });
      }

      tx.update(ref, {
        status: 'awaiting_review',
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
    // eslint-disable-next-line no-console
    console.error('[requests.done] failed:', err);
    res.status(500).json({ error: 'internal' });
    return;
  }

  // Side effects after the commit. Bookkeeping failures don't fail the response.
  try {
    await writeRequestEvent({
      requestId,
      type: 'status_changed',
      actorId,
      visibility: 'all',
      details: { from: prevStatus, to: 'awaiting_review', kind: 'done' },
    });
    await writeAuditLog({
      actorId,
      action: 'request.done',
      entityType: 'requests',
      entityId: requestId,
      details: { from: prevStatus, to: 'awaiting_review' },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.done] side-effects:', err);
  }

  // Return the updated request.
  try {
    const updated = await ref.get();
    const data = updated.data() ?? {};
    res.json({
      id: updated.id,
      ...data,
      createdAt: (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? null,
      updatedAt: (data.updatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ?? null,
    });
  } catch {
    res.json({ id: requestId, status: 'awaiting_review' });
  }
});

// ── POST /api/requests/:id/close ─────────────────────────────────────────
// Beneficiary side of the mutual-consent close handshake (req 25). The
// beneficiary may propose/approve/decline a close on their own request.
// applyCloseConsent re-checks ownership defensively. On both sides approving
// (result.closed) we record a status_changed event + audit log. We do NOT
// notify the beneficiary here — they initiated this action.
const closeSchema = z.object({
  action: z.enum(['propose', 'approve', 'decline']),
});

const CLOSE_HTTP: Record<string, number> = {
  ok: 200,
  not_found: 404,
  forbidden: 403,
  invalid_state: 409,
};

router.post('/:id/close', authenticate, async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const parsed = closeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const requestId = req.params.id;
  const actorId = req.user.uid;
  const { action } = parsed.data;

  let result;
  try {
    result = await applyCloseConsent(requestId, 'beneficiary', actorId, action);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.close] failed:', err);
    res.status(500).json({ error: 'internal' });
    return;
  }

  if (result.status !== 'ok') {
    res.status(CLOSE_HTTP[result.status] ?? 500).json({ error: result.status });
    return;
  }

  if (result.closed) {
    try {
      await writeRequestEvent({
        requestId,
        type: 'status_changed',
        actorId,
        visibility: 'all',
        details: { to: 'closed', via: 'consent' },
      });
      await writeAuditLog({
        actorId,
        action: 'request.close',
        entityType: 'requests',
        entityId: requestId,
        details: { to: 'closed', via: 'consent', role: 'beneficiary' },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[requests.close] side-effects:', err);
    }
  } else if (result.action) {
    // Propose/decline leave a timeline trace too, so admins can see a pending
    // (or withdrawn) consent-close handshake before it resolves.
    try {
      await writeRequestEvent({
        requestId,
        type: 'close_consent',
        actorId,
        visibility: 'all',
        details: { action: result.action, role: 'beneficiary' },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[requests.close] consent-event side-effects:', err);
    }
  }

  res.json({ ok: true, closed: result.closed, closeRequest: result.closeRequest });
});

// ── GET /api/requests/:id/attachments/:name ──────────────────────────────
// Re-mint a short-lived signed read URL for a single attachment (Note 1).
// Authorization: admin OR the assigned volunteer/handler of the request (403
// otherwise). The owning beneficiary is intentionally NOT granted here — doc
// viewing is for staff reviewing the case. 404 if `name` isn't an attachment
// of this request. Storage stays client-read denied; only this endpoint hands
// out (short-lived) links.
router.get(
  '/:id/attachments/:name',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'not_authenticated' });
      return;
    }

    const requestId = req.params.id;
    const name = req.params.name;

    try {
      const snap = await db().collection('requests').doc(requestId).get();
      if (!snap.exists) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      const data = snap.data() as {
        handler?: string | null;
        assignedVolunteerId?: string | null;
        attachments?: Array<{ name?: string; path?: string }>;
      };

      const isAdmin = req.user.role === 'admin';
      const isAssigned =
        data.assignedVolunteerId === req.user.uid || data.handler === req.user.uid;
      if (!isAdmin && !isAssigned) {
        res.status(403).json({ error: 'forbidden' });
        return;
      }

      const match = (data.attachments ?? []).find((a) => a?.name === name);
      if (!match?.path) {
        res.status(404).json({ error: 'attachment_not_found' });
        return;
      }

      const url = await mintSignedReadUrl(match.path);
      if (!url) {
        res.status(404).json({ error: 'attachment_not_found' });
        return;
      }

      const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString();
      res.json({ url, expiresAt });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[requests.attachments.view] failed:', err);
      res.status(500).json({ error: 'internal' });
    }
  },
);

// ── GET /api/requests/:id/events ────────────────────────────────────────
// Returns the timeline events for a single request (#68).
// Visibility gate: the beneficiary (owner) sees all events with visibility
// 'all'; volunteers and admins see all. Events are ordered oldest-first so
// the client can render them top-to-bottom as a timeline.
//
// Mounted BEFORE /:id so Express matches the literal segment "events" first.
router.get('/:id/events', authenticate, async (req: Request, res: Response) => {
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
    const data = snap.data() as { beneficiaryId?: string; handler?: string | null };
    const isOwner   = data.beneficiaryId === req.user.uid;
    const isHandler = data.handler       === req.user.uid;
    const isAdmin   = req.user.role      === 'admin';

    if (!isOwner && !isHandler && !isAdmin) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    // Determine which visibility levels this caller may see.
    const canSeeInternal = isAdmin || isHandler;

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
});

// ── GET /api/requests/:id ────────────────────────────────────────────────
// Defense-in-depth read of a single request. Rules already enforce, but we
// also check here so the API returns a clean 403/404 instead of leaking the
// Firestore error shape.
router.get('/:id', authenticate, async (req: Request, res: Response) => {
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
      }
    }
    res.json(projected);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
