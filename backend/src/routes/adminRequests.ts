/**
 * /api/admin/requests — Admin-only request management endpoints (#75).
 *
 * Endpoints:
 *   GET  /api/admin/requests         — list + filter all requests
 *   GET  /api/admin/requests/:id     — single request detail
 *   POST /api/admin/requests/task         — create a volunteer task request (req 20/21)
 *   POST /api/admin/requests/:id/assign   — assign a volunteer
 *   POST /api/admin/requests/:id/status   — change status
 *   POST /api/admin/requests/:id/note     — add internal note
 *
 * All writes: Admin SDK (bypasses Firestore rules).
 * Every mutating action emits a requestEvent + writeAuditLog.
 * The assign endpoint also triggers chat-on-assign (#71) via chats module.
 */
import { randomUUID } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';
import { writeAuditLog } from '@/lib/audit';
import { isAllowedCategory } from '@/lib/categoriesCache';
import { writeRequestEvent } from '@/lib/requestEvents';
import { notifyBeneficiaryOfRequest } from '@/lib/notify';
import { REQUEST_STATUSES, type RequestStatus } from '@/routes/requests';
import { canTransition, canArchive } from '@/lib/requestTransitions';
import { sortByPriority } from '@/lib/requestSort';
import { volunteerDisplayName } from '@/lib/displayName';
import { ensureChatForRequest } from '@/lib/chatOnAssign';

const router = Router();
router.use(authenticate, requireRole('admin'));

// ── Chat lifecycle consistency ─────────────────────────────────────────────
// `chats.active` must be false on ALL request end states (closed, rejected,
// referred), not just the mutual-consent close. Mirrors closeConsent.ts:
// best-effort update of every chat linked to the request, never fatal.
const CHAT_END_STATES = new Set<RequestStatus>(['closed', 'rejected', 'referred']);

async function setChatsActiveForRequest(requestId: string, active: boolean): Promise<void> {
  try {
    const chats = await db().collection('chats').where('requestId', '==', requestId).get();
    await Promise.all(
      chats.docs.map((c) =>
        c.ref.update({ active, updatedAt: FieldValue.serverTimestamp() }),
      ),
    );
  } catch {
    /* non-fatal: the request write committed; the chat flag is best-effort */
  }
}

// ── GET /api/admin/requests ───────────────────────────────────────────────
// Optional query params: status, category, urgency, volunteerId, sort
// ('newest' default | 'priority'), limit (default 50)
router.get('/', async (req: Request, res: Response): Promise<void> => {
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

    const toRow = (d: (typeof docs)[number]) => {
      const data = d.data();
      // Compact close-handshake state (req 25) so the admin list can flag
      // pending consent-close proposals without a detail fetch.
      const cr = (data.closeRequest as Record<string, unknown> | null | undefined) ?? null;
      return {
        id: d.id,
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
        assignedVolunteerName: data.assignedVolunteerName ?? null,
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
    // the default stays createdAt descending ('newest').
    const items =
      sort === 'priority'
        ? sortByPriority(docs.map(toRow)).slice(0, limit)
        : docs
            .sort((a, b) => {
              const ta = a.data().createdAt?.toDate?.()?.getTime?.() ?? 0;
              const tb = b.data().createdAt?.toDate?.()?.getTime?.() ?? 0;
              return tb - ta; // newest first
            })
            .slice(0, limit)
            .map(toRow);

    res.json({ items });
  } catch (err) {
    console.error('[adminRequests] GET /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── GET /api/admin/requests/:id ───────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db().collection('requests').doc(req.params.id).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const data = snap.data()!;

    // Also fetch request events for the timeline. We sort client-side by
    // createdAt (ascending) instead of Firestore's orderBy so this equality
    // query needs no composite index — the per-request event set is small.
    const eventsSnap = await db()
      .collection('requestEvents')
      .where('requestId', '==', req.params.id)
      .get();

    const events = eventsSnap.docs
      .map((e) => {
        const ev = e.data();
        return {
          id: e.id,
          type: ev.type,
          actorId: ev.actorId,
          visibility: ev.visibility,
          details: ev.details ?? {},
          createdAt: ev.createdAt?.toDate?.()?.toISOString?.() ?? null,
        };
      })
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

    // Serialize the referral's server timestamp to ISO if present (Note 8).
    const referral = data.referral
      ? {
          ...data.referral,
          referredAt:
            data.referral.referredAt?.toDate?.()?.toISOString?.() ??
            data.referral.referredAt ??
            null,
        }
      : null;

    res.json({
      id: snap.id,
      ...data,
      archived: data.archived === true,
      // Volunteer-on-behalf provenance (UC-01 A2) for the admin UI badge.
      onBehalf: data.onBehalf === true,
      submittedBy: data.submittedBy ?? null,
      submittedByRole: data.submittedByRole ?? null,
      attachments: data.attachments ?? [],
      referral,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
      assignedAt: data.assignedAt?.toDate?.()?.toISOString?.() ?? null,
      events,
    });
  } catch (err) {
    console.error('[adminRequests] GET /:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/requests/:id/assign ──────────────────────────────────
// Body: { volunteerId: string }
// Sets assignedVolunteerId + assignedAt, fires 'assigned' event.
// Also calls ensureChatForRequest to create/guarantee a chat (#71).
const assignSchema = z.object({
  volunteerId: z.string().min(1),
});

router.post('/:id/assign', async (req: Request, res: Response): Promise<void> => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const { volunteerId } = parsed.data;
  const requestId = req.params.id;
  const actorId = req.user!.uid;

  try {
    const ref = db().collection('requests').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const data = snap.data()!;

    // Reject assignment on a terminal request (closed/referred/rejected):
    // assigning would create an active chat on a dead request and fire a
    // misleading "assigned" notification. The admin UI also disables the
    // control for these states; this 409 is the hard server-side guard.
    const TERMINAL_STATUSES = new Set(['closed', 'referred', 'rejected']);
    if (TERMINAL_STATUSES.has(data.status as string)) {
      res.status(409).json({ error: 'request_terminal' });
      return;
    }

    // Verify the target is a real, active volunteer before granting it
    // handler-level access. Downstream authorization keys off
    // handler/assignedVolunteerId (the staff projection serves internal notes +
    // national ID, and the chat participant guard lets that uid read/post the
    // beneficiary's chat), so a fat-fingered or pasted-wrong uid (a
    // beneficiary's, or a deactivated volunteer's) would otherwise silently
    // expose one request's PII. Mirror the terminal-status guard's 409 shape.
    const volSnap = await db().collection('volunteers').doc(volunteerId).get();
    if (!volSnap.exists || volSnap.data()?.active !== true) {
      res.status(409).json({ error: 'volunteer_inactive' });
      return;
    }

    const prevVolunteerId = data.assignedVolunteerId ?? null;

    // Denormalize the display name so list views never need an N+1 lookup
    // (and former volunteers keep a readable name after deactivation).
    const assignedVolunteerName = await volunteerDisplayName(volunteerId);

    await ref.update({
      assignedVolunteerId: volunteerId,
      assignedVolunteerName,
      assignedAt: FieldValue.serverTimestamp(),
      handler: volunteerId,
      // Claim flow (req 22): the chosen volunteer wins the pool; any other
      // pending claims are dropped and the request leaves the available pool.
      poolStatus: 'none',
      hasClaims: false,
      claims: [],
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeRequestEvent({
      requestId,
      type: 'assigned',
      actorId,
      visibility: 'all',
      details: { volunteerId, prevVolunteerId },
    });

    await writeAuditLog({
      actorId,
      action: 'request.assign',
      entityType: 'requests',
      entityId: requestId,
      details: { volunteerId, prevVolunteerId },
    });

    // Create chat between beneficiary and volunteer (#71). Admin task requests
    // (req 20) have no beneficiary, so there is no one to open a chat with —
    // skip chat creation for them (otherwise participants would contain
    // `undefined` and the write fails).
    const beneficiaryId = data.beneficiaryId as string | undefined;
    if (beneficiaryId) {
      await ensureChatForRequest({
        requestId,
        beneficiaryId,
        volunteerId,
        // Re-assign: drop the former volunteer from the chat so they lose
        // read/write/attachment access to a case they no longer serve (req 13).
        prevVolunteerId,
      });
    }

    // Notify the beneficiary that a volunteer was put on their request (req 27).
    // Fire-and-forget: never let a notification failure break the response.
    void notifyBeneficiaryOfRequest(requestId, 'accepted').catch((err) => {
      console.error('[adminRequests] notify accepted failed:', err);
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminRequests] POST /:id/assign:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/requests/:id/status ──────────────────────────────────
// Body: { to: RequestStatus }
// Fires 'status_changed' event (visibility 'all').
//
// Note 6 — transition-map-validated, race-safe status change. The lifecycle is
// an explicit transition map (lib/requestTransitions), not forward-only:
// admins may close (in_progress→closed or awaiting_review→closed), send back
// (awaiting_review→in_progress), reopen (closed→in_progress), reject, or start
// (pending→in_progress). Illegal moves return 409. The read-check-write runs in
// a Firestore transaction so concurrent admin edits can't clobber each other.
//
// `to` is the contract field; `status` is accepted as a legacy alias.
const statusSchema = z
  .object({
    to: z.enum(REQUEST_STATUSES).optional(),
    status: z.enum(REQUEST_STATUSES).optional(),
  })
  .refine((d) => Boolean(d.to ?? d.status), {
    message: 'to is required',
    path: ['to'],
  });

/** Thrown inside the transaction to bail out with a specific HTTP status. */
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

router.post('/:id/status', async (req: Request, res: Response): Promise<void> => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const to = (parsed.data.to ?? parsed.data.status) as RequestStatus;
  const requestId = req.params.id;
  const actorId = req.user!.uid;
  const ref = db().collection('requests').doc(requestId);

  let prevStatus: string | null = null;

  try {
    // Read-check-write in a single transaction so concurrent admins can't race
    // past each other. Firestore retries the callback on contention; if it can't
    // commit (another writer won), runTransaction throws and we return 409.
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new TransitionError(404, 'not_found');
      }

      prevStatus = (snap.data()!.status as string) ?? null;

      // Admin transitions are validated against the canonical map. Admins are
      // exempt from the assignment requirement (isAssigned: true).
      if (!canTransition(prevStatus, to, { role: 'admin', isAssigned: true })) {
        throw new TransitionError(409, 'invalid_transition', {
          from: prevStatus,
          to,
        });
      }

      tx.update(ref, {
        status: to,
        // Every end state resolves any pending consent-close handshake
        // (req 25) so no stale, unresolvable proposal lingers on a request
        // the admin already closed, rejected or referred.
        ...(to === 'closed' || to === 'rejected' || to === 'referred'
          ? { closeRequest: null }
          : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof TransitionError) {
      res.status(err.httpStatus).json({ error: err.code, ...err.extra });
      return;
    }
    // A Firestore ABORTED error (gRPC code 10) means the transaction lost a race
    // after exhausting retries — a genuine concurrent/stale write. Surface 409.
    const code = (err as { code?: number }).code;
    if (code === 10) {
      res.status(409).json({ error: 'concurrent_update' });
      return;
    }
    console.error('[adminRequests] POST /:id/status:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  // Side effects run only after the status write committed successfully.
  try {
    await writeRequestEvent({
      requestId,
      type: 'status_changed',
      actorId,
      visibility: 'all',
      details: { from: prevStatus, to },
    });

    await writeAuditLog({
      actorId,
      action: 'request.status_change',
      entityType: 'requests',
      entityId: requestId,
      details: { from: prevStatus, to },
    });
  } catch (err) {
    // The status change itself succeeded; log the bookkeeping failure but still
    // report success so the admin UI reflects the committed state.
    console.error('[adminRequests] POST /:id/status side-effects:', err);
  }

  // Keep chats.active in sync with the request lifecycle: every end state
  // pauses the chat; an admin reopen (closed → in_progress) resumes it.
  if (CHAT_END_STATES.has(to)) {
    await setChatsActiveForRequest(requestId, false);
  } else if (to === 'in_progress' && prevStatus === 'closed') {
    await setChatsActiveForRequest(requestId, true);
  }

  // Notify the beneficiary when their request is closed (req 27).
  // Fire-and-forget: never let a notification failure break the response.
  if (to === 'closed') {
    void notifyBeneficiaryOfRequest(requestId, 'closed').catch((err) => {
      console.error('[adminRequests] notify closed failed:', err);
    });
  }

  res.json({ ok: true, status: to });
});

// ── POST /api/admin/requests/:id/refer ────────────────────────────────────
// Body: { answerId: string, note?: string }
// Refers the request to a partner from the live `answers` catalog (Note 8).
// Resolves partnerName from the answer, sets the `referral` field, moves the
// status to `referred` (terminal, counts as helped), and sets archived=true.
// Validated against the transition map (in_progress → referred, admin).
const referSchema = z.object({
  answerId: z.string().trim().min(1).max(200),
  note: z.string().trim().max(2000).optional(),
});

router.post('/:id/refer', async (req: Request, res: Response): Promise<void> => {
  const parsed = referSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const { answerId, note } = parsed.data;
  const requestId = req.params.id;
  const actorId = req.user!.uid;
  const ref = db().collection('requests').doc(requestId);

  let prevStatus: string | null = null;
  let partnerName = '';

  try {
    // Resolve the partner from the answers catalog up front (outside the txn).
    const answerSnap = await db().collection('answers').doc(answerId).get();
    if (!answerSnap.exists) {
      res.status(404).json({ error: 'partner_not_found' });
      return;
    }
    const answer = answerSnap.data() as {
      title?: { he?: string; en?: string } | string;
      sourceName?: string;
      status?: string;
      phone?: string;
      email?: string;
      sourceUrl?: string;
    };
    // Only approved partners may be snapshotted onto a referral — mirrors the
    // public directory's approved-only contract. Guards against referring a
    // beneficiary to a pending/rejected/archived org via the raw answerId.
    if (answer.status !== 'approved') {
      res.status(409).json({ error: 'partner_not_approved' });
      return;
    }
    // `title` is bilingual { he, en } on answers; fall back across shapes.
    if (typeof answer.title === 'string') {
      partnerName = answer.title;
    } else {
      partnerName = answer.title?.he ?? answer.title?.en ?? answer.sourceName ?? '';
    }
    // Snapshot the partner's contact details onto the referral so the
    // beneficiary's referral panel can actually show how to reach them. Stored
    // at referral time (not looked up live) so it survives later edits to the
    // answer doc. `website` maps from the answer's `sourceUrl` field.
    const partnerPhone   = answer.phone ?? null;
    const partnerEmail   = answer.email ?? null;
    const partnerWebsite = answer.sourceUrl ?? null;

    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new TransitionError(404, 'not_found');
      }
      prevStatus = (snap.data()!.status as string) ?? null;

      if (!canTransition(prevStatus, 'referred', { role: 'admin', isAssigned: true })) {
        throw new TransitionError(409, 'invalid_transition', {
          from: prevStatus,
          to: 'referred',
        });
      }

      tx.update(ref, {
        status: 'referred',
        archived: true,
        // Referral is terminal — clear any pending consent-close handshake.
        closeRequest: null,
        referral: {
          answerId,
          partnerName,
          phone: partnerPhone,
          email: partnerEmail,
          website: partnerWebsite,
          note: note ?? '',
          referredAt: FieldValue.serverTimestamp(),
          referredBy: actorId,
        },
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
    console.error('[adminRequests] POST /:id/refer:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  try {
    await writeRequestEvent({
      requestId,
      type: 'status_changed',
      actorId,
      visibility: 'all',
      details: { from: prevStatus, to: 'referred', kind: 'referred', answerId, partnerName, note: note ?? '' },
    });
    await writeAuditLog({
      actorId,
      action: 'request.refer',
      entityType: 'requests',
      entityId: requestId,
      details: { answerId, partnerName },
    });
  } catch (err) {
    console.error('[adminRequests] POST /:id/refer side-effects:', err);
  }

  // `referred` is a request end state — pause the linked chat(s).
  await setChatsActiveForRequest(requestId, false);

  res.json({ ok: true, status: 'referred', referral: { answerId, partnerName, note: note ?? '' } });
});

// ── POST /api/admin/requests/:id/archive ──────────────────────────────────
// Sets archived=true. Only allowed when the request is `closed` or `referred`
// (Note 6). Archived requests stay queryable for stats but drop out of the
// default active list.
router.post('/:id/archive', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.params.id;
  const actorId = req.user!.uid;
  const ref = db().collection('requests').doc(requestId);

  try {
    await db().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new TransitionError(404, 'not_found');
      }
      const status = (snap.data()!.status as string) ?? null;
      if (!canArchive(status)) {
        throw new TransitionError(409, 'invalid_archive', { status });
      }
      tx.update(ref, {
        archived: true,
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
    console.error('[adminRequests] POST /:id/archive:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  try {
    await writeRequestEvent({
      requestId,
      type: 'status_changed',
      actorId,
      visibility: 'internal',
      details: { kind: 'archived', archived: true },
    });
    await writeAuditLog({
      actorId,
      action: 'request.archive',
      entityType: 'requests',
      entityId: requestId,
      details: { archived: true },
    });
  } catch (err) {
    console.error('[adminRequests] POST /:id/archive side-effects:', err);
  }

  res.json({ ok: true, archived: true });
});

// ── POST /api/admin/requests/:id/note ────────────────────────────────────
// Body: { note: string }
// Fires 'note_added' event with visibility 'internal'.
const noteSchema = z.object({
  note: z.string().trim().min(1).max(2000),
});

router.post('/:id/note', async (req: Request, res: Response): Promise<void> => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const { note } = parsed.data;
  const requestId = req.params.id;
  const actorId = req.user!.uid;

  try {
    const ref = db().collection('requests').doc(requestId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Append to the notes field (pipe-delimited, timestamped)
    const prevNotes = (snap.data()!.notes as string) ?? '';
    const timestamp = new Date().toISOString();
    const updatedNotes = prevNotes
      ? `${prevNotes}\n[${timestamp}] ${actorId}: ${note}`
      : `[${timestamp}] ${actorId}: ${note}`;

    await ref.update({
      notes: updatedNotes,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeRequestEvent({
      requestId,
      type: 'note_added',
      actorId,
      visibility: 'internal',
      details: { note },
    });

    await writeAuditLog({
      actorId,
      action: 'request.note_added',
      entityType: 'requests',
      entityId: requestId,
      details: { noteLength: note.length },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminRequests] POST /:id/note:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/requests/task ─────────────────────────────────────────
// Admin creates a "task request" surfaced to volunteers (req 20 + 21). Unlike
// a beneficiary request (UC-01), a task originates from the admin and starts in
// the available volunteer pool so volunteers can claim it (req 22).
//
// Body:
//   { title, description, category, urgency?, deadline?, attachments? }
//   - title:       required, 1-200 chars
//   - description: required, 1-4000 chars
//   - category:    required, an ACTIVE category id from the admin-managed taxonomy
//   - urgency:     'low' | 'medium' | 'high' (default 'medium')
//   - deadline:    ISO date/datetime string, or null (default null)
//   - attachments: optional array of { name, path, type, size, volunteerVisible? }
//                  volunteerVisible defaults to false when omitted.
// The doc id is generated server-side (crypto.randomUUID); we `create()` so a
// (vanishingly unlikely) id collision fails loudly rather than overwriting.
const taskAttachmentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  path: z.string().trim().min(1).max(1024),
  type: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative(),
  volunteerVisible: z.boolean().optional().default(false),
});

const taskSchema = z
  .object({
    title:       z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(4000),
    category:    z.string().trim().min(1).max(80),
    urgency:     z.enum(['low', 'medium', 'high']).default('medium'),
    deadline: z
      .string()
      .trim()
      .refine((s) => !Number.isNaN(Date.parse(s)), 'deadline must be a valid date')
      .nullable()
      .optional(),
    attachments: z.array(taskAttachmentSchema).max(20).optional().default([]),
  })
  .superRefine(async (data, ctx) => {
    // No more free-text task categories: must be an ACTIVE id from the
    // admin-managed taxonomy (Firestore `categories`, cached ~60s). Fail-open
    // if the taxonomy is unseeded — see lib/categoriesCache.
    if (!(await isAllowedCategory(data.category, 'active'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'unknown category',
      });
    }
  });

router.post('/task', async (req: Request, res: Response): Promise<void> => {
  // safeParseAsync: the schema's superRefine awaits the category taxonomy.
  const parsed = await taskSchema.safeParseAsync(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const input = parsed.data;
  const actorId = req.user!.uid;
  const requestId = randomUUID();

  // Normalize attachments so every entry carries an explicit volunteerVisible
  // flag (default false) — never leave it undefined in Firestore.
  const attachments = input.attachments.map((a) => ({
    name: a.name,
    path: a.path,
    type: a.type,
    size: a.size,
    volunteerVisible: a.volunteerVisible === true,
  }));

  try {
    await db().collection('requests').doc(requestId).create({
      // Task provenance
      origin:      'admin',
      requestType: 'task',
      createdBy:   actorId,

      // Body
      title:       input.title,
      description: input.description,
      category:    input.category,
      urgency:     input.urgency,
      deadline:    input.deadline ?? null,

      // Lifecycle — starts pending and available in the volunteer pool (req 22)
      status:              'pending',
      poolStatus:          'available',
      assignedVolunteerId: null,
      handler:             null,
      hasClaims:           false,
      claims:              [],
      wasPreviouslyTaken:  false,

      // Attachments (each carries its own volunteerVisible flag)
      attachments,

      // Timestamps
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // `create()` throws ALREADY_EXISTS (gRPC code 6) on an id collision.
    const code = (err as { code?: number }).code;
    if (code === 6) {
      res.status(409).json({ error: 'duplicate_request_id' });
      return;
    }
    console.error('[adminRequests] POST /task:', err);
    res.status(500).json({ error: 'internal_error' });
    return;
  }

  // Timeline event (internal — staff/volunteer facing) + audit trail.
  try {
    await writeRequestEvent({
      requestId,
      type: 'created',
      actorId,
      visibility: 'internal',
      details: { kind: 'task', category: input.category, urgency: input.urgency },
    });
    await writeAuditLog({
      actorId,
      action: 'request.task_create',
      entityType: 'requests',
      entityId: requestId,
      details: {
        category: input.category,
        urgency: input.urgency,
        hasAttachments: attachments.length > 0,
      },
    });
  } catch (err) {
    // The task was created; bookkeeping failure shouldn't fail the response.
    console.error('[adminRequests] POST /task side-effects:', err);
  }

  res.status(201).json({ id: requestId });
});

export default router;
