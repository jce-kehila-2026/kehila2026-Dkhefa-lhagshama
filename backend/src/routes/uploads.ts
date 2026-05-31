import { randomUUID } from 'node:crypto';

import express, { Router, type Request, type Response } from 'express';

import { db, storage } from '@/lib/firebaseAdmin';
import { writeRequestEvent } from '@/lib/requestEvents';
import { authenticate } from '@/middleware/auth';
import { sanitizeFilename } from '@/lib/sanitizeFilename'; // #96 — replaces inline safeName

const router = Router();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Upload hardening (#84) ─────────────────────────────────────────────────
/** Allowed MIME types for attachments. */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

/** Maximum individual file size: 10 MB. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Maximum number of files per request (counted via Storage list). */
const MAX_FILES_PER_REQUEST = 5;
// ───────────────────────────────────────────────────────────────────────────

router.post('/requests/:requestId', authenticate, express.raw({ type: '*/*', limit: '12mb' }), async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const requestId = req.params.requestId;
  if (!UUID_V4.test(requestId)) {
    res.status(400).json({ error: 'validation', detail: 'requestId must be a v4 UUID' });
    return;
  }

  // ── Ownership check (F1) ────────────────────────────────────────────────
  // Without this, any verified user who knows another beneficiary's requestId
  // could inject attachments into the victim's request and burn their quota.
  // Mirror the read-side gate in requests.ts: owner, assigned handler/volunteer,
  // or admin only. Storage rules deliberately delegate write-auth to Express.
  const requestSnap = await db().collection('requests').doc(requestId).get();
  if (!requestSnap.exists) {
    res.status(404).json({ error: 'request_not_found' });
    return;
  }
  const reqData = requestSnap.data() as {
    beneficiaryId?: string;
    handler?: string | null;
    assignedVolunteerId?: string | null;
  };
  const isOwner             = reqData.beneficiaryId === req.user.uid;
  const isHandler           = reqData.handler === req.user.uid;
  const isAssignedVolunteer = reqData.assignedVolunteerId === req.user.uid;
  const isAdmin             = req.user.role === 'admin';
  if (!isOwner && !isHandler && !isAssignedVolunteer && !isAdmin) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  const filenameParam = typeof req.query.filename === 'string' ? req.query.filename : 'upload.bin';
  const filename = sanitizeFilename(filenameParam); // #96 — path-traversal-safe filename

  // Strip the base MIME type (ignore params like "; boundary=...")
  const rawContentType = typeof req.headers['content-type'] === 'string'
    ? req.headers['content-type']
    : 'application/octet-stream';
  const contentType = rawContentType.split(';')[0].trim().toLowerCase();

  // ── MIME allowlist (#84) ──────────────────────────────────────────────────
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

  // ── Size guard (#84) ──────────────────────────────────────────────────────
  if (req.body.length > MAX_FILE_BYTES) {
    res.status(413).json({ error: 'file_too_large', detail: `Max ${MAX_FILE_BYTES / 1024 / 1024} MB` });
    return;
  }

  // ── Per-request quota (#84) — count existing files in this requestId ──────
  try {
    const prefix = `requests/${requestId}/`;
    const [existingFiles] = await storage().getFiles({ prefix, maxResults: MAX_FILES_PER_REQUEST + 1 });
    if (existingFiles.length >= MAX_FILES_PER_REQUEST) {
      res.status(429).json({
        error: 'quota_exceeded',
        detail: `Maximum ${MAX_FILES_PER_REQUEST} files per request`,
      });
      return;
    }
  } catch (quotaCheckErr) {
    // Non-fatal: log but proceed. Storage list errors should not block uploads.
    // eslint-disable-next-line no-console
    console.warn('[uploads] quota check failed (proceeding):', quotaCheckErr);
  }

  const path = `requests/${requestId}/${filename}`;
  const bucketFile = storage().file(path);

  try {
    // eslint-disable-next-line no-console
    console.log(`[uploads] saving file: path=${path}, size=${req.body.length}, contentType=${contentType}`);

    await bucketFile.save(req.body, {
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          uploadedBy: req.user.uid,
          requestId,
          uploadNonce: randomUUID(),
        },
      },
    });

    // eslint-disable-next-line no-console
    console.log(`[uploads] file saved successfully: ${path}`);

    // ── Signed-URL expiry (F4) ──────────────────────────────────────────
    // Previously expired in the year 2500 — an effectively permanent,
    // unauthenticated bearer link to a PII-bearing upload. Scope it to a
    // short window; the URL is consumed right after upload and nothing in the
    // frontend re-uses a stored URL long-term.
    const SIGNED_URL_TTL_MS = 60 * 60 * 1000; // 1 hour
    const [downloadURL] = await bucketFile.getSignedUrl({
      action: 'read',
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });

    // Timeline event (#65) — fire-and-forget; don't fail the upload on it.
    writeRequestEvent({
      requestId,
      type: 'attachment_added',
      actorId: req.user.uid,
      visibility: 'all',
      details: { filename, path },
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[uploads.request] event write failed:', err);
    });

    res.status(201).json({ path, downloadURL });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[uploads.request] failed:', {
      message: err instanceof Error ? err.message : String(err),
      code: err instanceof Error && 'code' in err ? (err as { code?: unknown }).code : undefined,
      requestId,
      path,
      bodySize: req.body.length,
    });
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
