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
import { writeRequestEvent } from '@/lib/requestEvents';
import { authenticate } from '@/middleware/auth';

const router = Router();

// ── Status lifecycle (#64) ──────────────────────────────────────────────────
// Forward-only ordering is enforced by the admin endpoints (#92); this is the
// canonical set of states. Exported so admin/edge-case streams reuse it.
export const REQUEST_STATUSES = [
  'pending',
  'in_progress',
  'resolved',
  'rejected',
  'closed',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

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

    // Request body
    category:    z.enum(['education', 'employment', 'legal', 'social']),
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

    // Volunteer-on-behalf alt flow (UC-01 A2). Full UX deferred; schema scaffolded.
    onBehalfOf: z
      .object({
        uid: z.string().min(1).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    // An Israeli ID number is mandatory only when idType is israeli_id (#66).
    if (data.idType === 'israeli_id' && data.idNumber.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['idNumber'],
        message: 'idNumber is required when idType is israeli_id',
      });
    }
  });

type CreateRequestInput = z.infer<typeof createRequestSchema>;

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

  const parsed = createRequestSchema.safeParse(req.body);
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
      return {
        id: d.id,
        category:        data.category,
        urgency:         data.urgency,
        status:          data.status,
        description:     data.description,
        deadline:        data.deadline ?? null,
        attachmentPaths: data.attachmentPaths ?? [],
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

    const eventsSnap = await db()
      .collection('requestEvents')
      .where('requestId', '==', id)
      .orderBy('createdAt', 'asc')
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
    const data = snap.data() as { beneficiaryId?: string; handler?: string | null };
    const isOwner   = data.beneficiaryId === req.user.uid;
    const isHandler = data.handler === req.user.uid;
    const isAdmin   = req.user.role === 'admin';
    if (!isOwner && !isHandler && !isAdmin) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    res.json({ id: snap.id, ...data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
