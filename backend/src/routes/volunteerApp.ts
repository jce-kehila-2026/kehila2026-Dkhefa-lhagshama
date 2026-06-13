/**
 * Volunteer operational app (reqs 14–19).
 *
 * Endpoints for the volunteer's own dashboard, insights, the available-request
 * pool, claiming, self status, and editing/dropping assigned requests. All
 * gated to role `volunteer` (admin is a superset). PII projection and
 * assignee-only checks are enforced here (volunteers use this API, not the
 * client Firestore SDK).
 *
 * Mounted at /api/volunteer; the router-level guard below lets volunteers AND
 * admins through (admin is a superset). `uid = req.user.uid` throughout.
 *
 * Firestore access pattern: single-field `where` equality queries, then sort /
 * aggregate in memory so no composite index is ever required (matches the
 * convention in adminRequests / requests).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { isAllowedCategory } from '@/lib/categoriesCache';
import { writeRequestEvent } from '@/lib/requestEvents';
import { authenticate, requireAnyRole } from '@/middleware/auth';
import { sortByPriority, type SortableRequest } from '@/lib/requestSort';
import { applyCloseConsent } from '@/lib/closeConsent';
import { volunteerDisplayName } from '@/lib/displayName';
import { notifyBeneficiaryOfRequest } from '@/lib/notify';
import { removeVolunteerFromRequestChat } from '@/lib/chatOnAssign';

const router = Router();

router.use(authenticate, requireAnyRole('volunteer'));

// ── Shared helpers ──────────────────────────────────────────────────────────

/** Firestore Timestamp | ISO string | null → ISO string | null. */
function toIso(value: unknown): string | null {
  const ts = value as { toDate?: () => Date } | undefined;
  if (ts?.toDate) return ts.toDate().toISOString();
  if (typeof value === 'string') return value;
  return null;
}

interface AttachmentLike {
  name?: string;
  path?: string;
  volunteerVisible?: boolean;
  [k: string]: unknown;
}

/**
 * Attachment projection for volunteer-facing cards. Include an attachment when
 * the request is NOT a task, OR the attachment is explicitly volunteer-visible.
 */
function projectAttachments(data: Record<string, unknown>): AttachmentLike[] {
  const isTask = data.requestType === 'task';
  const attachments = (data.attachments as AttachmentLike[] | undefined) ?? [];
  if (!isTask) return attachments;
  return attachments.filter((att) => att?.volunteerVisible === true);
}

/** Card-safe shape for the assigned list (PII id fields hidden). */
function toAssignedCard(id: string, data: Record<string, unknown>) {
  return {
    id,
    title: (data.title as string | undefined) ?? null,
    category: data.category ?? null,
    description: data.description ?? null,
    status: data.status ?? null,
    urgency: data.urgency ?? null,
    deadline: (data.deadline as string | null | undefined) ?? null,
    createdAt: toIso(data.createdAt),
    attachments: projectAttachments(data),
    wasPreviouslyTaken: data.wasPreviouslyTaken === true,
  };
}

/** Card-safe shape for the pool (more aggressive PII hiding for privacy). */
function toPoolCard(id: string, data: Record<string, unknown>, uid: string) {
  const claims = (data.claims as Array<{ volunteerId?: string }> | undefined) ?? [];
  return {
    id,
    title: (data.title as string | undefined) ?? null,
    // Keep first name + city only; hide last name, phone, email, id fields.
    firstName: (data.firstName as string | undefined) ?? null,
    city: (data.city as string | undefined) ?? null,
    category: data.category ?? null,
    description: data.description ?? null,
    status: data.status ?? null,
    urgency: data.urgency ?? null,
    deadline: (data.deadline as string | null | undefined) ?? null,
    createdAt: toIso(data.createdAt),
    origin: (data.origin as string | undefined) ?? null,
    requestType: (data.requestType as string | undefined) ?? null,
    wasPreviouslyTaken: data.wasPreviouslyTaken === true,
    claimsCount: claims.length,
    claimedByMe: claims.some((c) => c?.volunteerId === uid),
    attachments: projectAttachments(data),
  };
}

/** Thrown inside a transaction to bail out with a specific HTTP status. */
class OpError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'OpError';
  }
}

// ── GET /api/volunteer/me ────────────────────────────────────────────────────
// The caller's volunteer profile bits. Returns defaults if no volunteers doc.
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const uid = req.user!.uid;
  try {
    const snap = await db().collection('volunteers').doc(uid).get();
    const data = (snap.data() as Record<string, unknown> | undefined) ?? {};
    res.json({
      workStatus: (data.workStatus as string | undefined) ?? 'free',
      approvedCategories: (data.approvedCategories as string[] | undefined) ?? [],
      requestedCategories: (data.requestedCategories as unknown[] | undefined) ?? [],
    });
  } catch (err) {
    console.error('[volunteer] GET /me:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── PATCH /api/volunteer/me ──────────────────────────────────────────────────
// Body: { workStatus?, requestCategory?: { category, note? } }. At least one.
const patchMeSchema = z
  .object({
    workStatus: z.enum(['free', 'working', 'unavailable']).optional(),
    requestCategory: z
      .object({
        category: z.string().trim().min(1).max(80),
        note: z.string().trim().max(2000).optional(),
      })
      .optional(),
  })
  .refine((d) => d.workStatus !== undefined || d.requestCategory !== undefined, {
    message: 'workStatus or requestCategory is required',
  })
  .superRefine(async (d, ctx) => {
    // A volunteer may only request permission for an ACTIVE id from the
    // admin-managed taxonomy (no more free text). Fail-open if the taxonomy
    // is unseeded — see lib/categoriesCache.
    if (d.requestCategory && !(await isAllowedCategory(d.requestCategory.category, 'active'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestCategory', 'category'],
        message: 'unknown category',
      });
    }
  });

router.patch('/me', async (req: Request, res: Response): Promise<void> => {
  // safeParseAsync: the schema's superRefine awaits the category taxonomy.
  const parsed = await patchMeSchema.safeParseAsync(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const { workStatus, requestCategory } = parsed.data;
  const ref = db().collection('volunteers').doc(uid);

  try {
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (workStatus) update.workStatus = workStatus;
    if (requestCategory) {
      // arrayUnion appends without clobbering, and merge:true handles a thin doc.
      update.requestedCategories = FieldValue.arrayUnion({
        category: requestCategory.category,
        note: requestCategory.note ?? '',
        requestedAt: new Date().toISOString(),
        status: 'pending',
      });
    }
    await ref.set(update, { merge: true });

    await writeAuditLog({
      actorId: uid,
      action: 'volunteer.update_me',
      entityType: 'volunteers',
      entityId: uid,
      details: {
        workStatus: workStatus ?? null,
        requestedCategory: requestCategory?.category ?? null,
      },
    });

    // Read back the freshest bits so the client reflects committed state.
    const snap = await ref.get();
    const data = (snap.data() as Record<string, unknown> | undefined) ?? {};
    res.json({
      workStatus: (data.workStatus as string | undefined) ?? 'free',
      approvedCategories: (data.approvedCategories as string[] | undefined) ?? [],
      requestedCategories: (data.requestedCategories as unknown[] | undefined) ?? [],
    });
  } catch (err) {
    console.error('[volunteer] PATCH /me:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/volunteer/assigned ──────────────────────────────────────────────
// All requests assigned to the caller, priority-sorted, PII-stripped cards.
router.get('/assigned', async (req: Request, res: Response): Promise<void> => {
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
});

// ── GET /api/volunteer/pool ──────────────────────────────────────────────────
// All requests with poolStatus === 'available', priority-sorted + privacy-safe
// cards, plus a per-category breakdown.
router.get('/pool', async (req: Request, res: Response): Promise<void> => {
  const uid = req.user!.uid;
  try {
    const snap = await db()
      .collection('requests')
      .where('poolStatus', '==', 'available')
      .get();

    const sortable = snap.docs.map((d) => {
      const data = d.data();
      return {
        _doc: d,
        urgency: data.urgency as string | null | undefined,
        deadline: (data.deadline as string | null | undefined) ?? null,
        wasPreviouslyTaken: data.wasPreviouslyTaken === true,
      } satisfies SortableRequest & { _doc: typeof d };
    });

    const items = sortByPriority(sortable).map((s) => toPoolCard(s._doc.id, s._doc.data(), uid));

    // byCategory aggregation over the pool.
    const counts = new Map<string, number>();
    for (const item of items) {
      const cat = (item.category as string | null) ?? 'uncategorized';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    const byCategory = [...counts.entries()].map(([category, count]) => ({ category, count }));

    res.json({ items, byCategory });
  } catch (err) {
    console.error('[volunteer] GET /pool:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/volunteer/pool/:id/claim ───────────────────────────────────────
// Body: { note? }. Adds the caller to the request's claims list.
const claimSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

router.post('/pool/:id/claim', async (req: Request, res: Response): Promise<void> => {
  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const requestId = req.params.id;
  const note = parsed.data.note ?? '';
  const ref = db().collection('requests').doc(requestId);

  const volunteerName = await volunteerDisplayName(uid, req.user!.email);

  try {
    // Read-check-write in a transaction so two volunteers can't race a claim.
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new OpError(404, 'not_found');
      }
      const data = snap.data() as {
        poolStatus?: string;
        claims?: Array<{ volunteerId?: string }>;
      };
      if (data.poolStatus !== 'available') {
        throw new OpError(409, 'not_available', { poolStatus: data.poolStatus ?? null });
      }
      const claims = data.claims ?? [];
      if (claims.some((c) => c?.volunteerId === uid)) {
        throw new OpError(409, 'already_claimed');
      }

      tx.update(ref, {
        claims: FieldValue.arrayUnion({
          volunteerId: uid,
          volunteerName,
          note,
          claimedAt: new Date().toISOString(),
        }),
        hasClaims: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof OpError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    const code = (err as { code?: number }).code;
    if (code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    console.error('[volunteer] POST /pool/:id/claim:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  // Side effects after commit. Internal-only: this is volunteer-pool activity.
  try {
    await writeRequestEvent({
      requestId,
      type: 'note_added',
      actorId: uid,
      visibility: 'internal',
      details: { claim: true, volunteerName, note },
    });
    await writeAuditLog({
      actorId: uid,
      action: 'request.claim',
      entityType: 'requests',
      entityId: requestId,
      details: { note: note.length > 0 },
    });
  } catch (err) {
    console.error('[volunteer] POST /pool/:id/claim side-effects:', err);
  }

  res.json({ ok: true });
});

// ── PATCH /api/volunteer/requests/:id (req 17) ───────────────────────────────
// Body: { urgency?, deadline? (ISO|null) }. Assignee-only (admin allowed).
const editRequestSchema = z
  .object({
    urgency: z.enum(['low', 'medium', 'high']).optional(),
    deadline: z
      .union([
        z
          .string()
          .trim()
          .refine((s) => !Number.isNaN(Date.parse(s)), 'deadline must be a valid date'),
        z.null(),
      ])
      .optional(),
  })
  .refine((d) => d.urgency !== undefined || d.deadline !== undefined, {
    message: 'urgency or deadline is required',
  });

router.patch('/requests/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = editRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const isAdmin = req.user!.role === 'admin';
  const requestId = req.params.id;
  const { urgency, deadline } = parsed.data;
  const ref = db().collection('requests').doc(requestId);

  try {
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const data = snap.data() as { assignedVolunteerId?: string | null };
    if (!isAdmin && data.assignedVolunteerId !== uid) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    const changed: Record<string, unknown> = {};
    if (urgency !== undefined) {
      update.urgency = urgency;
      changed.urgency = urgency;
    }
    if (deadline !== undefined) {
      update.deadline = deadline; // string or null
      changed.deadline = deadline;
    }

    await ref.update(update);

    // visibility 'all' so the beneficiary sees the urgency/deadline change.
    await writeRequestEvent({
      requestId,
      type: 'note_added',
      actorId: uid,
      visibility: 'all',
      details: { kind: 'request_edited', ...changed },
    });
    await writeAuditLog({
      actorId: uid,
      action: 'request.edit',
      entityType: 'requests',
      entityId: requestId,
      details: changed,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[volunteer] PATCH /requests/:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/volunteer/requests/:id/drop (req 18) ───────────────────────────
// Body: { done?, reached?, stuck? }. Assignee-only (admin allowed). Returns the
// request to the pool and records a drop report.
const dropSchema = z.object({
  done: z.string().trim().max(4000).optional(),
  reached: z.string().trim().max(4000).optional(),
  stuck: z.string().trim().max(4000).optional(),
});

router.post('/requests/:id/drop', async (req: Request, res: Response): Promise<void> => {
  const parsed = dropSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const isAdmin = req.user!.role === 'admin';
  const requestId = req.params.id;
  const { done = '', reached = '', stuck = '' } = parsed.data;
  const ref = db().collection('requests').doc(requestId);

  const volunteerName = await volunteerDisplayName(uid, req.user!.email);

  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new OpError(404, 'not_found');
      }
      const data = snap.data() as { assignedVolunteerId?: string | null };
      if (!isAdmin && data.assignedVolunteerId !== uid) {
        throw new OpError(403, 'forbidden');
      }

      tx.update(ref, {
        assignedVolunteerId: null,
        handler: null,
        status: 'pending',
        poolStatus: 'available',
        wasPreviouslyTaken: true,
        // Back to the pool resets any pending consent-close handshake — the
        // proposing volunteer is gone, so nobody could resolve it (req 25).
        closeRequest: null,
        dropReports: FieldValue.arrayUnion({
          volunteerId: uid,
          volunteerName,
          done,
          reached,
          stuck,
          droppedAt: new Date().toISOString(),
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof OpError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    const code = (err as { code?: number }).code;
    if (code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    console.error('[volunteer] POST /requests/:id/drop:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  // Drop the volunteer from the request chat so they lose read/write/attachment
  // access to the beneficiary's conversation once they leave the case (req 13).
  // Best-effort: never let a chat-cleanup failure fail the drop response.
  try {
    await removeVolunteerFromRequestChat(requestId, uid);
  } catch (err) {
    console.error('[volunteer] POST /requests/:id/drop chat cleanup:', err);
  }

  // visibility 'all' so the beneficiary sees their request returned to the queue.
  try {
    await writeRequestEvent({
      requestId,
      type: 'status_changed',
      actorId: uid,
      visibility: 'all',
      details: { kind: 'dropped', to: 'pending', poolStatus: 'available' },
    });
    await writeAuditLog({
      actorId: uid,
      action: 'request.drop',
      entityType: 'requests',
      entityId: requestId,
      details: { done: done.length > 0, reached: reached.length > 0, stuck: stuck.length > 0 },
    });
  } catch (err) {
    console.error('[volunteer] POST /requests/:id/drop side-effects:', err);
  }

  res.json({ ok: true });
});

// ── POST /api/volunteer/requests/:id/close (req 25 + 27) ─────────────────────
// Volunteer side of the mutual-consent close handshake. The router is already
// gated to volunteer/admin; applyCloseConsent re-checks assignment defensively.
// On both sides approving (result.closed) we record a status_changed event +
// audit log AND notify the beneficiary that their request was closed (req 27),
// since the volunteer completed the close.
const closeSchema = z.object({
  action: z.enum(['propose', 'approve', 'decline']),
});

const CLOSE_HTTP: Record<string, number> = {
  ok: 200,
  not_found: 404,
  forbidden: 403,
  invalid_state: 409,
};

router.post('/requests/:id/close', async (req: Request, res: Response): Promise<void> => {
  const parsed = closeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const requestId = req.params.id;
  const { action } = parsed.data;

  let result;
  try {
    result = await applyCloseConsent(requestId, 'volunteer', uid, action);
  } catch (err) {
    console.error('[volunteer] POST /requests/:id/close:', err);
    res.status(500).json({ error: 'internal_error' });
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
        actorId: uid,
        visibility: 'all',
        details: { to: 'closed', via: 'consent' },
      });
      await writeAuditLog({
        actorId: uid,
        action: 'request.close',
        entityType: 'requests',
        entityId: requestId,
        details: { to: 'closed', via: 'consent', role: 'volunteer' },
      });
      // req 27: volunteer completed the close → notify the beneficiary.
      await notifyBeneficiaryOfRequest(requestId, 'closed');
    } catch (err) {
      console.error('[volunteer] POST /requests/:id/close side-effects:', err);
    }
  } else if (result.action) {
    // Propose/decline leave a timeline trace too, so admins can see a pending
    // (or withdrawn) consent-close handshake before it resolves.
    try {
      await writeRequestEvent({
        requestId,
        type: 'close_consent',
        actorId: uid,
        visibility: 'all',
        details: { action: result.action, role: 'volunteer' },
      });
    } catch (err) {
      console.error('[volunteer] POST /requests/:id/close consent-event side-effects:', err);
    }
  }

  res.json({ ok: true, closed: result.closed, closeRequest: result.closeRequest });
});

// ── GET /api/volunteer/insights (req 14b) ────────────────────────────────────
// Aggregates over the caller's assigned requests (archived included). Robust to
// missing fields: everything defaults sensibly.
router.get('/insights', async (req: Request, res: Response): Promise<void> => {
  const uid = req.user!.uid;
  try {
    const snap = await db()
      .collection('requests')
      .where('assignedVolunteerId', '==', uid)
      .get();

    const overTimeMap = new Map<string, number>();
    const byCategoryMap = new Map<string, number>();
    const byStatusMap = new Map<string, number>();
    let currentLoad = 0;

    // For avg resolution we collect created→closed spans. We prefer the closing
    // event's timestamp (status_changed → closed) but fall back to updatedAt.
    const closedSpansDays: number[] = [];
    const closedRequestIds: Array<{ id: string; createdAtMs: number | null; updatedAtMs: number | null }> = [];

    for (const d of snap.docs) {
      const data = d.data();

      // overTime by createdAt day (YYYY-MM-DD)
      const createdIso = toIso(data.createdAt);
      if (createdIso) {
        const day = createdIso.slice(0, 10);
        overTimeMap.set(day, (overTimeMap.get(day) ?? 0) + 1);
      }

      // byCategory
      const cat = (data.category as string | undefined) ?? 'uncategorized';
      byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + 1);

      // byStatus
      const status = (data.status as string | undefined) ?? 'unknown';
      byStatusMap.set(status, (byStatusMap.get(status) ?? 0) + 1);

      // currentLoad — in_progress assigned to me
      if (status === 'in_progress') currentLoad += 1;

      // candidate for avg resolution if it's closed
      if (status === 'closed') {
        const createdAtMs = createdIso ? Date.parse(createdIso) : null;
        const updatedIso = toIso(data.updatedAt);
        const updatedAtMs = updatedIso ? Date.parse(updatedIso) : null;
        closedRequestIds.push({ id: d.id, createdAtMs, updatedAtMs });
      }
    }

    // Try to refine close timestamps from requestEvents (status_changed→closed).
    // Single-field equality query per request keeps us index-free; the closed
    // set is small. Failures degrade gracefully to updatedAt.
    for (const c of closedRequestIds) {
      let closedAtMs: number | null = null;
      try {
        const evSnap = await db()
          .collection('requestEvents')
          .where('requestId', '==', c.id)
          .get();
        for (const e of evSnap.docs) {
          const ev = e.data();
          if (ev.type === 'status_changed' && ev.details?.to === 'closed') {
            const evIso = toIso(ev.createdAt);
            const evMs = evIso ? Date.parse(evIso) : null;
            if (evMs !== null) closedAtMs = closedAtMs === null ? evMs : Math.max(closedAtMs, evMs);
          }
        }
      } catch {
        // ignore — fall back to updatedAt below
      }
      const endMs = closedAtMs ?? c.updatedAtMs;
      if (c.createdAtMs !== null && endMs !== null && endMs >= c.createdAtMs) {
        closedSpansDays.push((endMs - c.createdAtMs) / (1000 * 60 * 60 * 24));
      }
    }

    const avgResolutionDays =
      closedSpansDays.length > 0
        ? closedSpansDays.reduce((a, b) => a + b, 0) / closedSpansDays.length
        : null;

    const overTime = [...overTimeMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const byCategory = [...byCategoryMap.entries()].map(([category, count]) => ({ category, count }));
    const byStatus = [...byStatusMap.entries()].map(([status, count]) => ({ status, count }));

    res.json({ overTime, byCategory, byStatus, avgResolutionDays, currentLoad });
  } catch (err) {
    console.error('[volunteer] GET /insights:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
