/**
 * /api/chats — UC-04 Chat between beneficiary and assigned handler,
 * plus admin-created direct (staff/group) chats.
 *
 * All writes go through the Admin SDK (bypasses Firestore rules).
 * Clients read via onSnapshot with the rules in firestore.rules.
 *
 * Schema:
 *   chats/{chatId}     – participants[], requestId, kind, createdBy, title,
 *                        active, lastMessageAt
 *   messages/{msgId}   – chatId, senderId, content, timestamp, status
 *
 * Tolerant reads: chat docs created before the direct-chat feature carry no
 * kind/createdBy/title/active — readers treat them as kind 'request' and
 * active true.
 */
import { randomUUID } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { auth, db, storage } from '@/lib/firebaseAdmin';
import { resolveDisplayName } from '@/lib/displayName';
import { mintSignedReadUrl, SIGNED_URL_TTL_MS } from '@/lib/signedUrl';
import { notifyBeneficiaryOfRequest } from '@/lib/notify';
import { sanitizeFilename } from '@/lib/sanitizeFilename';
import { writeAuditLog } from '@/lib/audit';
import { authenticate, requireRole } from '@/middleware/auth';

const router = Router();

/** Tolerant chat-kind read: docs missing `kind` are request chats. */
export function chatKind(data: { kind?: unknown }): 'request' | 'direct' {
  return data.kind === 'direct' ? 'direct' : 'request';
}

/** Tolerant active read: docs missing `active` count as live. */
export function chatIsActive(data: { active?: unknown }): boolean {
  return data.active !== false;
}

/**
 * Post a system message into a chat, following the chat-on-assign convention:
 * senderId 'system', isSystem true, content prefixed '[SYSTEM] '. The content
 * carries a machine-readable marker (e.g. 'chat_paused') so the frontend can
 * render translated copy; `targetUid` optionally names the affected user.
 */
export async function postSystemMessage(
  chatId: string,
  marker: string,
  targetUid?: string,
): Promise<void> {
  // Denormalize the affected user's name at write time so the note stays
  // readable after the user leaves the participants list (e2e round 2,
  // defect D3: "X was removed" showed a uid fragment once X was gone).
  const targetName = targetUid ? await resolveDisplayName(targetUid) : null;
  const msgRef = db().collection('messages').doc();
  await msgRef.set({
    chatId,
    senderId: 'system',
    content: `[SYSTEM] ${marker}`,
    ...(targetUid ? { targetUid } : {}),
    ...(targetName ? { targetName } : {}),
    timestamp: FieldValue.serverTimestamp(),
    status: 'sent',
    isSystem: true,
  });
  await db().collection('chats').doc(chatId).update({
    lastMessageAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Best-effort existence check for a batch of uids: Firebase Auth first
 * (batched getUsers), then the `users` collection for any leftovers. Returns
 * the uids that could not be confirmed. If BOTH lookups fail outright
 * (infra error), returns [] — verification is best-effort and must not block.
 */
async function findUnknownUids(uids: string[]): Promise<string[]> {
  if (uids.length === 0) return [];
  const missing = new Set(uids);
  let anyLookupWorked = false;

  try {
    const result = await auth().getUsers(uids.map((uid) => ({ uid })));
    for (const u of result.users) missing.delete(u.uid);
    anyLookupWorked = true;
  } catch {
    /* fall through to the users collection */
  }

  if (missing.size > 0) {
    try {
      const refs = [...missing].map((uid) => db().collection('users').doc(uid));
      const snaps = await db().getAll(...refs);
      for (const s of snaps) if (s.exists) missing.delete(s.id);
      anyLookupWorked = true;
    } catch {
      /* best-effort */
    }
  }

  return anyLookupWorked ? [...missing] : [];
}

// ── Chat attachment hardening — mirrors uploads.ts (#84) ───────────────────
/** Allowed MIME types for chat attachments (PDF / JPEG / PNG / DOCX). */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

/** Maximum individual file size: 10 MB. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Throttle window for the volunteer-reply notification (req 27). */
const REPLY_NOTIFY_THROTTLE_MS = 15 * 60 * 1000;

// ── POST /api/chats ───────────────────────────────────────────────────────
// Open (or retrieve) a chat for a given requestId.
// Auto-creates the chat document if one doesn't exist yet.
// Only the request's beneficiaryId or handler (assignedTo) may open a chat.
router.post('/', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const parsed = z.object({
    requestId: z.string().min(1),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { requestId } = parsed.data;

  const requestSnap = await db().collection('requests').doc(requestId).get();
  if (!requestSnap.exists) {
    res.status(404).json({ error: 'request_not_found' });
    return;
  }

  const requestData = requestSnap.data() as {
    beneficiaryId: string;
    handler?: string | null;
    assignedVolunteerId?: string | null;
  };

  const uid = req.user.uid;
  const isParticipant =
    uid === requestData.beneficiaryId ||
    uid === requestData.handler ||
    uid === requestData.assignedVolunteerId;

  if (!isParticipant && req.user.role !== 'admin') {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  // Check if a chat for this requestId already exists.
  const existing = await db()
    .collection('chats')
    .where('requestId', '==', requestId)
    .limit(1)
    .get();

  if (!existing.empty) {
    res.status(200).json({ chatId: existing.docs[0].id });
    return;
  }

  // Build participants list: beneficiary + handler + assigned volunteer (if set).
  // F7: previously omitted assignedVolunteerId, which under-granted an assigned
  // volunteer access to the chat they're meant to take part in.
  const participants = [requestData.beneficiaryId];
  if (requestData.handler) participants.push(requestData.handler);
  if (
    requestData.assignedVolunteerId &&
    requestData.assignedVolunteerId !== requestData.handler
  ) {
    participants.push(requestData.assignedVolunteerId);
  }

  const chatRef = db().collection('chats').doc();
  await chatRef.set({
    requestId,
    participants,
    kind: 'request',
    createdBy: uid,
    title: null,
    active: true,
    lastMessageAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  res.status(201).json({ chatId: chatRef.id });
});

// ── POST /api/chats/direct ────────────────────────────────────────────────
// Admin-only: create a direct (staff/group) chat that is NOT bound to a
// request. The creator is always included in participants; every other uid
// must exist in Firebase Auth or the users collection (best-effort check).
const directSchema = z.object({
  participantUids: z.array(z.string().trim().min(1).max(128)).min(1).max(20),
  title: z.string().trim().min(1).max(120).optional(),
});

router.post('/direct', authenticate, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = directSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const actor = req.user!.uid;
  // Dedupe and make sure the creator participates in their own chat.
  const participants = [...new Set([actor, ...parsed.data.participantUids])];
  if (participants.length > 20) {
    res.status(400).json({ error: 'validation', detail: 'max 20 participants' });
    return;
  }

  try {
    const unknown = await findUnknownUids(participants.filter((uid) => uid !== actor));
    if (unknown.length > 0) {
      res.status(400).json({ error: 'unknown_participants', uids: unknown });
      return;
    }

    const chatRef = db().collection('chats').doc();
    await chatRef.set({
      requestId: null,
      participants,
      kind: 'direct',
      createdBy: actor,
      title: parsed.data.title ?? null,
      active: true,
      lastMessageAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    await postSystemMessage(chatRef.id, 'chat_created');

    await writeAuditLog({
      actorId: actor,
      action: 'chat.direct_create',
      entityType: 'chats',
      entityId: chatRef.id,
      details: { participants, title: parsed.data.title ?? null },
    });

    res.status(201).json({
      id: chatRef.id,
      kind: 'direct',
      title: parsed.data.title ?? null,
      participants,
      active: true,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chats.direct] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// ── Participant management ────────────────────────────────────────────────
// POST   /api/chats/:id/participants        { uid }  — add a participant
// DELETE /api/chats/:id/participants/:uid             — remove a participant
//
// Guard: actor is admin OR (direct chat && actor is its creator). On request
// chats the linked request's beneficiary and current assigned volunteer are
// protected from removal (409). Add of an existing participant (and remove of
// a non-participant) is a no-op 200. The membership write runs in a
// transaction together with the guard reads.

interface ParticipantTxOutcome {
  code: 200 | 403 | 404 | 409;
  error?: string;
  changed?: boolean;
}

/** Shared transaction body for add/remove. */
async function mutateParticipants(
  chatId: string,
  targetUid: string,
  actor: { uid: string; isAdmin: boolean },
  op: 'add' | 'remove',
): Promise<ParticipantTxOutcome> {
  const chatRef = db().collection('chats').doc(chatId);

  return db().runTransaction<ParticipantTxOutcome>(async (tx) => {
    const snap = await tx.get(chatRef);
    if (!snap.exists) return { code: 404, error: 'chat_not_found' };

    const chat = snap.data() as {
      kind?: unknown;
      createdBy?: unknown;
      requestId?: string | null;
      participants?: string[];
    };
    const kind = chatKind(chat);

    const isCreator = kind === 'direct' && chat.createdBy === actor.uid;
    if (!actor.isAdmin && !isCreator) {
      return { code: 403, error: 'forbidden' };
    }

    if (op === 'remove' && kind === 'request' && chat.requestId) {
      // Protect the request's core pair: beneficiary + current volunteer.
      const reqSnap = await tx.get(db().collection('requests').doc(chat.requestId));
      if (reqSnap.exists) {
        const rd = reqSnap.data() as {
          beneficiaryId?: string | null;
          assignedVolunteerId?: string | null;
        };
        if (targetUid === rd.beneficiaryId || targetUid === rd.assignedVolunteerId) {
          return { code: 409, error: 'protected_participant' };
        }
      }
    }

    const participants = Array.isArray(chat.participants) ? chat.participants : [];
    const isMember = participants.includes(targetUid);
    if (op === 'add' ? isMember : !isMember) {
      return { code: 200, changed: false };
    }

    tx.update(chatRef, {
      participants:
        op === 'add' ? FieldValue.arrayUnion(targetUid) : FieldValue.arrayRemove(targetUid),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { code: 200, changed: true };
  });
}

/** Shared post-transaction bookkeeping: system message + admin audit log. */
async function participantSideEffects(
  chatId: string,
  targetUid: string,
  actor: { uid: string; isAdmin: boolean },
  op: 'add' | 'remove',
): Promise<void> {
  try {
    await postSystemMessage(
      chatId,
      op === 'add' ? 'participant_added' : 'participant_removed',
      targetUid,
    );
    if (actor.isAdmin) {
      await writeAuditLog({
        actorId: actor.uid,
        action: op === 'add' ? 'chat.participant_add' : 'chat.participant_remove',
        entityType: 'chats',
        entityId: chatId,
        details: { uid: targetUid },
      });
    }
  } catch (err) {
    // The membership write committed; bookkeeping is best-effort.
    // eslint-disable-next-line no-console
    console.warn('[chats.participants] side effects failed:', err);
  }
}

router.post('/:id/participants', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const parsed = z.object({ uid: z.string().trim().min(1).max(128) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const chatId = req.params.id;
  const targetUid = parsed.data.uid;
  const actor = { uid: req.user.uid, isAdmin: req.user.role === 'admin' };

  try {
    // Don't grow participants with uids that don't exist anywhere.
    const unknown = await findUnknownUids([targetUid]);
    if (unknown.length > 0) {
      res.status(400).json({ error: 'unknown_participants', uids: unknown });
      return;
    }

    const outcome = await mutateParticipants(chatId, targetUid, actor, 'add');
    if (outcome.code !== 200) {
      res.status(outcome.code).json({ error: outcome.error });
      return;
    }
    if (outcome.changed) {
      await participantSideEffects(chatId, targetUid, actor, 'add');
    }
    res.status(200).json({ ok: true, added: outcome.changed === true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chats.participants.add] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

router.delete('/:id/participants/:uid', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const chatId = req.params.id;
  const targetUid = req.params.uid;
  const actor = { uid: req.user.uid, isAdmin: req.user.role === 'admin' };

  try {
    const outcome = await mutateParticipants(chatId, targetUid, actor, 'remove');
    if (outcome.code !== 200) {
      res.status(outcome.code).json({ error: outcome.error });
      return;
    }
    if (outcome.changed) {
      await participantSideEffects(chatId, targetUid, actor, 'remove');
    }
    res.status(200).json({ ok: true, removed: outcome.changed === true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chats.participants.remove] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// ── POST /api/chats/:id/messages ─────────────────────────────────────────
// Send a message. The caller must be a participant in the chat.
router.post('/:id/messages', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const chatId = req.params.id;

  const parsed = z.object({
    content: z.string().trim().min(1).max(4000),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const chatSnap = await db().collection('chats').doc(chatId).get();
  if (!chatSnap.exists) {
    res.status(404).json({ error: 'chat_not_found' });
    return;
  }

  const chatData = chatSnap.data() as {
    participants: string[];
    requestId?: string | null;
    lastReplyNotifyAt?: string | null;
    active?: unknown;
  };
  if (!chatData.participants.includes(req.user.uid)) {
    res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
    return;
  }

  // Inactive chat = read-only composer; the server enforces it too.
  if (!chatIsActive(chatData)) {
    res.status(409).json({ error: 'chat_inactive' });
    return;
  }

  const msgRef = db().collection('messages').doc();
  const now = FieldValue.serverTimestamp();

  await msgRef.set({
    chatId,
    senderId: req.user.uid,
    content: parsed.data.content,
    timestamp: now,
    status: 'sent',
  });

  // Update lastMessageAt on the chat document.
  await db().collection('chats').doc(chatId).update({ lastMessageAt: now });

  // ── Volunteer-reply notification (req 27) — fire-and-forget ──────────────
  // When a volunteer/admin replies in a chat linked to a request, email the
  // beneficiary. Throttled on chats/{id}.lastReplyNotifyAt (≤1 per 15 min) so a
  // burst of messages doesn't spam them. Notify failures never break the send.
  void (async () => {
    try {
      const isHandlerRole = req.user?.role === 'volunteer' || req.user?.role === 'admin';
      if (!isHandlerRole || !chatData.requestId) return;

      const last = chatData.lastReplyNotifyAt
        ? Date.parse(chatData.lastReplyNotifyAt)
        : NaN;
      const nowMs = Date.now();
      if (!Number.isNaN(last) && nowMs - last < REPLY_NOTIFY_THROTTLE_MS) return;

      await db()
        .collection('chats')
        .doc(chatId)
        .update({ lastReplyNotifyAt: new Date(nowMs).toISOString() });

      await notifyBeneficiaryOfRequest(chatData.requestId, 'reply');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[chats.messages] reply notify failed:', err);
    }
  })();

  res.status(201).json({ messageId: msgRef.id });
});

// ── GET /api/chats/:id/participants ──────────────────────────────────────────
// Participant identity for the chat UI (Note 11): photo + name for each
// participant, so the volunteer's face is visible to the beneficiary (trust).
// Participant-only, with an admin read bypass (oversight — admins may LOOK at
// any chat but must join as a participant before posting).
// `avatarUrl` is a short-lived signed URL minted from users/{uid}.photoURL,
// or null when the user has no photo.
router.get('/:id/participants', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const chatId = req.params.id;

  const chatSnap = await db().collection('chats').doc(chatId).get();
  if (!chatSnap.exists) {
    res.status(404).json({ error: 'chat_not_found' });
    return;
  }

  const chatData = chatSnap.data() as { participants: string[] };
  // Participant guard with read-only admin bypass.
  if (!chatData.participants.includes(req.user.uid) && req.user.role !== 'admin') {
    res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
    return;
  }

  try {
    const participants = await Promise.all(
      (chatData.participants ?? []).map(async (uid) => {
        // Name falls through users → volunteers → Auth (e2e round 2, defect
        // D3: users mirror docs are mostly missing/empty, so rail + bubbles
        // degraded to uid fragments).
        const displayName = await resolveDisplayName(uid);
        const userSnap = await db().collection('users').doc(uid).get();
        const data = userSnap.exists ? userSnap.data() : undefined;
        const avatarUrl = await mintSignedReadUrl(
          typeof data?.photoURL === 'string' ? data.photoURL : null,
        );
        return { uid, displayName, avatarUrl };
      }),
    );
    res.status(200).json(participants);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[chats.participants] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// ── POST /api/chats/:id/attachments ──────────────────────────────────────────
// Upload a file into a chat. Participant-gated (same guard as POST /:id/messages).
// Raw bytes in, `?filename=` for the name. Mirrors uploads.ts hardening: MIME
// allowlist (PDF/JPEG/PNG/DOCX) + 10 MB cap + sanitized filename. Stored to
// chats/{chatId}/{safeName} via the Admin SDK bucket, then a messages doc with an
// `attachment` payload is created so the chat UI renders it inline.
router.post(
  '/:id/attachments',
  authenticate,
  express.raw({ type: '*/*', limit: '12mb' }),
  async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'not_authenticated' });
      return;
    }

    const chatId = req.params.id;

    const chatSnap = await db().collection('chats').doc(chatId).get();
    if (!chatSnap.exists) {
      res.status(404).json({ error: 'chat_not_found' });
      return;
    }

    const chatData = chatSnap.data() as { participants: string[]; active?: unknown };
    if (!chatData.participants.includes(req.user.uid)) {
      res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
      return;
    }

    // Inactive chat = read-only composer; uploads count as composing.
    if (!chatIsActive(chatData)) {
      res.status(409).json({ error: 'chat_inactive' });
      return;
    }

    const filenameParam =
      typeof req.query.filename === 'string' ? req.query.filename : 'upload.bin';
    const filename = sanitizeFilename(filenameParam);

    // Strip the base MIME type (ignore params like "; boundary=...").
    const rawContentType =
      typeof req.headers['content-type'] === 'string'
        ? req.headers['content-type']
        : 'application/octet-stream';
    const contentType = rawContentType.split(';')[0].trim().toLowerCase();

    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      res.status(415).json({
        error: 'unsupported_media_type',
        detail: `Allowed types: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      });
      return;
    }

    if (!Buffer.isBuffer(req.body)) {
      res.status(400).json({ error: 'validation', detail: 'expected binary request body' });
      return;
    }

    if (req.body.length > MAX_FILE_BYTES) {
      res.status(413).json({ error: 'file_too_large', detail: `Max ${MAX_FILE_BYTES / 1024 / 1024} MB` });
      return;
    }

    const path = `chats/${chatId}/${filename}`;
    const bucketFile = storage().file(path);

    try {
      await bucketFile.save(req.body, {
        resumable: false,
        metadata: {
          contentType,
          metadata: {
            uploadedBy: req.user.uid,
            chatId,
            uploadNonce: randomUUID(),
          },
        },
      });

      const attachment = {
        name: filename,
        path,
        type: contentType,
        size: req.body.length,
      };

      const msgRef = db().collection('messages').doc();
      const now = FieldValue.serverTimestamp();
      await msgRef.set({
        chatId,
        senderId: req.user.uid,
        content: '',
        attachment,
        timestamp: now,
        status: 'sent',
      });

      await db().collection('chats').doc(chatId).update({ lastMessageAt: now });

      res.status(201).json({ ok: true, attachment });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[chats.attachments] failed:', {
        message: err instanceof Error ? err.message : String(err),
        chatId,
        path,
        bodySize: req.body.length,
      });
      res.status(500).json({ error: 'internal' });
    }
  },
);

// ── GET /api/chats/:id/attachments/:name ─────────────────────────────────────
// Mint a short-lived signed read URL for a chat attachment. Participant-gated
// with an admin read bypass (oversight) — Storage rules deny client reads, so
// the backend brokers access.
router.get(
  '/:id/attachments/:name',
  authenticate,
  async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'not_authenticated' });
      return;
    }

    const chatId = req.params.id;

    const chatSnap = await db().collection('chats').doc(chatId).get();
    if (!chatSnap.exists) {
      res.status(404).json({ error: 'chat_not_found' });
      return;
    }

    const chatData = chatSnap.data() as { participants: string[] };
    if (!chatData.participants.includes(req.user.uid) && req.user.role !== 'admin') {
      res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
      return;
    }

    // The :name segment is the ALREADY-stored object name (recorded on the
    // message at upload time, after sanitizeFilename). Do NOT re-sanitize — that
    // would prepend a second random prefix and point at a non-existent object.
    // Just defend against path traversal: reject slashes / "..".
    const rawName = req.params.name;
    if (!rawName || rawName.includes('/') || rawName.includes('..') || rawName.includes('\\')) {
      res.status(400).json({ error: 'bad_name' });
      return;
    }
    const path = `chats/${chatId}/${rawName}`;

    try {
      const url = await mintSignedReadUrl(path);
      if (!url) {
        res.status(404).json({ error: 'not_found' });
        return;
      }
      res.status(200).json({ url, expiresAt: Date.now() + SIGNED_URL_TTL_MS });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[chats.attachments.get] failed:', err);
      res.status(500).json({ error: 'internal' });
    }
  },
);

export default router;
