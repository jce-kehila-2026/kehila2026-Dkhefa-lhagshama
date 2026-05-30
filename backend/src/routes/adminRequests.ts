/**
 * /api/admin/requests — Admin-only request management endpoints (#75).
 *
 * Endpoints:
 *   GET  /api/admin/requests         — list + filter all requests
 *   GET  /api/admin/requests/:id     — single request detail
 *   POST /api/admin/requests/:id/assign   — assign a volunteer
 *   POST /api/admin/requests/:id/status   — change status
 *   POST /api/admin/requests/:id/note     — add internal note
 *
 * All writes: Admin SDK (bypasses Firestore rules).
 * Every mutating action emits a requestEvent + writeAuditLog.
 * The assign endpoint also triggers chat-on-assign (#71) via chats module.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';
import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { REQUEST_STATUSES, type RequestStatus } from '@/routes/requests';
import { ensureChatForRequest } from '@/lib/chatOnAssign';

const router = Router();
router.use(authenticate, requireRole('admin'));

// ── GET /api/admin/requests ───────────────────────────────────────────────
// Optional query params: status, category, urgency, limit (default 50)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, category, urgency, limit: limitStr } = req.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(limitStr ?? '50', 10) || 50, 200);

    let query = db().collection('requests').orderBy('createdAt', 'desc').limit(limit) as
      FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

    if (status && REQUEST_STATUSES.includes(status as RequestStatus)) {
      query = query.where('status', '==', status);
    }
    if (category) {
      query = query.where('category', '==', category);
    }
    if (urgency) {
      query = query.where('urgency', '==', urgency);
    }

    const snap = await query.get();
    const items = snap.docs.map((d) => {
      const data = d.data();
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
        description:          data.description,
        assignedVolunteerId:  data.assignedVolunteerId ?? null,
        handler:              data.handler ?? null,
        deadline:             data.deadline ?? null,
        notes:                data.notes ?? '',
        createdAt:            data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        updatedAt:            data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
        assignedAt:           data.assignedAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

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

    // Also fetch request events for the timeline
    const eventsSnap = await db()
      .collection('requestEvents')
      .where('requestId', '==', req.params.id)
      .orderBy('createdAt', 'asc')
      .get();

    const events = eventsSnap.docs.map((e) => {
      const ev = e.data();
      return {
        id: e.id,
        type: ev.type,
        actorId: ev.actorId,
        visibility: ev.visibility,
        details: ev.details ?? {},
        createdAt: ev.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    res.json({
      id: snap.id,
      ...data,
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
    const prevVolunteerId = data.assignedVolunteerId ?? null;

    await ref.update({
      assignedVolunteerId: volunteerId,
      assignedAt: FieldValue.serverTimestamp(),
      handler: volunteerId,
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

    // Create chat between beneficiary and volunteer (#71)
    await ensureChatForRequest({
      requestId,
      beneficiaryId: data.beneficiaryId as string,
      volunteerId,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminRequests] POST /:id/assign:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/requests/:id/status ──────────────────────────────────
// Body: { status: RequestStatus }
// Fires 'status_changed' event (visibility 'all').
//
// #92 — Forward-only, race-safe status transition.
// The status lifecycle is forward-only: a request may only move to a status
// later in (or equal to) REQUEST_STATUSES, never backwards. To stay safe under
// concurrent admin edits, the read-check-write is wrapped in a Firestore
// transaction: if another admin changed the status between our read and write,
// the transaction's optimistic concurrency makes the commit fail and we surface
// a 409 instead of silently clobbering their change.
const statusSchema = z.object({
  status: z.enum(REQUEST_STATUSES),
});

/** Index of a status in the canonical forward-only lifecycle. -1 if unknown. */
function statusRank(status: string | null | undefined): number {
  if (!status) return -1;
  return REQUEST_STATUSES.indexOf(status as RequestStatus);
}

/**
 * A move is allowed only if the target sits at the same position or later in
 * the forward-only lifecycle. Equal is allowed (idempotent no-op re-save);
 * anything earlier is a backward transition and rejected.
 */
function isForwardTransition(from: string | null | undefined, to: RequestStatus): boolean {
  const fromRank = statusRank(from);
  const toRank = statusRank(to);
  if (toRank === -1) return false;
  // Unknown/missing current status: allow setting any valid status.
  if (fromRank === -1) return true;
  return toRank >= fromRank;
}

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

  const { status } = parsed.data;
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

      if (!isForwardTransition(prevStatus, status)) {
        throw new TransitionError(409, 'invalid_transition', {
          from: prevStatus,
          to: status,
        });
      }

      tx.update(ref, {
        status,
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
      details: { from: prevStatus, to: status },
    });

    await writeAuditLog({
      actorId,
      action: 'request.status_change',
      entityType: 'requests',
      entityId: requestId,
      details: { from: prevStatus, to: status },
    });
  } catch (err) {
    // The status change itself succeeded; log the bookkeeping failure but still
    // report success so the admin UI reflects the committed state.
    console.error('[adminRequests] POST /:id/status side-effects:', err);
  }

  res.json({ ok: true });
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

export default router;
