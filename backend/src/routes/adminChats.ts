/**
 * /api/admin/chats — Admin chat oversight (customer feedback round 2).
 *
 * Endpoints:
 *   GET   /api/admin/chats      — list ALL chats (request-bound + direct)
 *   PATCH /api/admin/chats/:id  — toggle a chat's `active` flag
 *
 * Admins can SEE every chat (paired with the isAdmin() read carve-out in
 * firestore.rules) but may POST only after joining as a participant via
 * POST /api/chats/:id/participants. The list does a full-collection get with
 * in-memory sort/limit — deliberately no composite index (NGO-scale volume),
 * matching the adminRequests list strategy.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { resolveDisplayName } from '@/lib/displayName';
import { writeAuditLog } from '@/lib/audit';
import { authenticate, requireRole } from '@/middleware/auth';
import { chatIsActive, chatKind, postSystemMessage } from '@/routes/chats';
import { type RequestStatus } from '@/routes/requests';

const router = Router();
router.use(authenticate, requireRole('admin'));

// Request end states: a chat bound to a request in one of these cannot be
// resumed (re-activated) by an admin — that would re-open the composer on a
// dead request. Mirrors adminRequests.CHAT_END_STATES / closeConsent.
const REQUEST_TERMINAL_STATES = new Set<RequestStatus>(['closed', 'rejected', 'referred']);

// ── GET /api/admin/chats ──────────────────────────────────────────────────
// Query params: limit (default 100, cap 300).
// Returns every chat, newest activity first, with display names resolved in
// one batched pass over the unique participant uids via the shared
// lib/displayName chain (users → volunteers → Auth displayName → Auth email
// local part) — the same resolution the chat participants rail uses, so the
// oversight table and an open chat never disagree on a name.
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const limitStr = typeof req.query.limit === 'string' ? req.query.limit : undefined;
    const limit = Math.min(parseInt(limitStr ?? '100', 10) || 100, 300);

    const snap = await db().collection('chats').get();

    const rows = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        kind: chatKind(data),
        title: typeof data.title === 'string' && data.title.trim() ? data.title : null,
        requestId: typeof data.requestId === 'string' ? data.requestId : null,
        active: chatIsActive(data),
        lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString?.() ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        participantUids: Array.isArray(data.participants)
          ? data.participants.filter((p: unknown): p is string => typeof p === 'string')
          : [],
        sortMs: data.lastMessageAt?.toDate?.()?.getTime?.() ?? 0,
      };
    });

    rows.sort((a, b) => b.sortMs - a.sortMs);
    const page = rows.slice(0, limit);

    // WS-3 — resolve each linked request's friendly reference (displayId) so the
    // oversight table shows REQ-#### instead of a 36-char UUID. Batched getAll
    // over the unique requestIds on this page; missing/legacy docs fall back to
    // null and the frontend renders the UUID-derived short fallback.
    const uniqueRequestIds = [
      ...new Set(
        page
          .map((r) => r.requestId)
          .filter((rid): rid is string => typeof rid === 'string' && rid.length > 0),
      ),
    ];
    const displayIdByRequestId = new Map<string, string | null>();
    if (uniqueRequestIds.length > 0) {
      const refs = uniqueRequestIds.map((rid) => db().collection('requests').doc(rid));
      const snaps = await db().getAll(...refs);
      for (const s of snaps) {
        if (s.exists) {
          const did = (s.data() as { displayId?: unknown }).displayId;
          displayIdByRequestId.set(s.id, typeof did === 'string' ? did : null);
        }
      }
    }

    // Resolve display names once per unique uid (best-effort; falls back to uid).
    const uniqueUids = [...new Set(page.flatMap((r) => r.participantUids))];
    const nameByUid = new Map<string, string>();
    await Promise.all(
      uniqueUids.map(async (uid) => {
        nameByUid.set(uid, (await resolveDisplayName(uid)) ?? uid);
      }),
    );

    const items = page.map(({ sortMs: _sortMs, participantUids, ...rest }) => ({
      ...rest,
      requestDisplayId:
        rest.requestId != null ? (displayIdByRequestId.get(rest.requestId) ?? null) : null,
      participants: participantUids.map((uid) => ({
        uid,
        displayName: nameByUid.get(uid) ?? uid,
      })),
    }));

    res.json({ items });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[adminChats] GET /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── PATCH /api/admin/chats/:id ────────────────────────────────────────────
// Body: { active: boolean }. Toggles the chat's active flag (inactive chat =
// read-only composer). Posts a '[SYSTEM] chat_paused'/'chat_resumed' marker
// message (chat-on-assign convention; the frontend renders translated copy)
// and writes an audit log. Toggling to the current state is a no-op 200.
const toggleSchema = z.object({ active: z.boolean() });

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = toggleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const chatId = req.params.id;
  const { active } = parsed.data;
  const actorId = req.user!.uid;

  try {
    const ref = db().collection('chats').doc(chatId);
    const snap = await ref.get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    if (chatIsActive(snap.data()!) === active) {
      // Already in the requested state — don't spam system messages.
      res.json({ ok: true, active });
      return;
    }

    // Resume guard: never re-activate a chat whose linked request is in a
    // terminal state (closed/rejected/referred) — that would re-open the
    // composer on a dead request. Pausing (active=false) is always allowed;
    // direct/staff chats (no requestId) are unaffected.
    if (active) {
      const requestId = snap.data()!.requestId;
      if (typeof requestId === 'string' && requestId) {
        const reqSnap = await db().collection('requests').doc(requestId).get();
        const status = reqSnap.exists ? (reqSnap.data()?.status as RequestStatus | undefined) : undefined;
        if (status !== undefined && REQUEST_TERMINAL_STATES.has(status)) {
          res.status(409).json({ error: 'request_terminal' });
          return;
        }
      }
    }

    await ref.update({ active, updatedAt: FieldValue.serverTimestamp() });

    await postSystemMessage(chatId, active ? 'chat_resumed' : 'chat_paused');

    await writeAuditLog({
      actorId,
      action: 'chat.active_toggle',
      entityType: 'chats',
      entityId: chatId,
      details: { active },
    });

    res.json({ ok: true, active });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[adminChats] PATCH /:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
