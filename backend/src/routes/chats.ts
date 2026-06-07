/**
 * /api/chats — UC-04 Chat between beneficiary and assigned handler.
 *
 * All writes go through the Admin SDK (bypasses Firestore rules).
 * Clients read via onSnapshot with the rules in firestore.rules.
 *
 * Schema:
 *   chats/{chatId}     – participants[], requestId, lastMessageAt
 *   messages/{msgId}   – chatId, senderId, content, timestamp, status
 */
import { randomUUID } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import express, { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db, storage } from '@/lib/firebaseAdmin';
import { mintSignedReadUrl, SIGNED_URL_TTL_MS } from '@/lib/signedUrl';
import { notifyBeneficiaryOfRequest } from '@/lib/notify';
import { sanitizeFilename } from '@/lib/sanitizeFilename';
import { authenticate } from '@/middleware/auth';

const router = Router();

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
    lastMessageAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  });

  res.status(201).json({ chatId: chatRef.id });
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
  };
  if (!chatData.participants.includes(req.user.uid)) {
    res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
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
// Participant-only — same guard as POST /:id/messages (403 otherwise).
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
  // Same participant guard as the messages route.
  if (!chatData.participants.includes(req.user.uid)) {
    res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
    return;
  }

  try {
    const participants = await Promise.all(
      (chatData.participants ?? []).map(async (uid) => {
        const userSnap = await db().collection('users').doc(uid).get();
        const data = userSnap.exists ? userSnap.data() : undefined;
        const displayName =
          (typeof data?.displayName === 'string' && data.displayName.trim()) ||
          [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim() ||
          null;
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

    const chatData = chatSnap.data() as { participants: string[] };
    if (!chatData.participants.includes(req.user.uid)) {
      res.status(403).json({ error: 'forbidden', detail: 'not a participant' });
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
// Mint a short-lived signed read URL for a chat attachment. Participant-gated —
// same guard as the message routes (Storage rules deny client reads, so the
// backend brokers access).
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
    if (!chatData.participants.includes(req.user.uid)) {
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
