/**
 * Chat attachment handlers for /api/chats.
 *   POST /api/chats/:id/attachments        — upload a file into a chat
 *   GET  /api/chats/:id/attachments/:name  — mint a signed read URL
 *
 * Participant-gated (same guard as POST /:id/messages). Mirrors uploads.ts
 * hardening: MIME allowlist (PDF/JPEG/PNG/DOCX) + 10 MB cap + sanitized
 * filename. Storage rules deny client reads, so the backend brokers access.
 */
import { randomUUID } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';

import { db, storage } from '@/lib/firebaseAdmin';
import { mintSignedReadUrl, SIGNED_URL_TTL_MS } from '@/lib/signedUrl';
import { sanitizeFilename } from '@/lib/sanitizeFilename';

import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES, chatIsActive } from './helpers';

// Upload a file into a chat. Raw bytes in, `?filename=` for the name. Stored to
// chats/{chatId}/{safeName} via the Admin SDK bucket, then a messages doc with
// an `attachment` payload is created so the chat UI renders it inline.
export async function uploadAttachment(req: Request, res: Response): Promise<void> {
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
}

// Mint a short-lived signed read URL for a chat attachment. Participant-gated
// with an admin read bypass (oversight).
export async function getAttachmentUrl(req: Request, res: Response): Promise<void> {
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
}
