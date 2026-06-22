/**
 * Attachment upload route (mounted under /api/uploads).
 *
 * Single endpoint: raw-body binary upload of a file to a request's Storage
 * folder (`requests/<requestId>/<filename>`). Owns the trust boundary for
 * attachment writes: Firebase Storage rules deliberately delegate write-auth
 * here. Hardening lives in this file: MIME allowlist, 10MB size cap, per-request
 * file quota, owner/handler/volunteer/admin ownership gate (#84/F1), filename
 * sanitization (#96), and short-lived signed URLs (F4).
 *
 * Key invariant: in the UC-01 beneficiary flow uploads happen at step 3, BEFORE
 * the request doc exists (created at the step-4 POST /api/requests). The client
 * generates the v4-UUID requestId and uses it as the path prefix; the per-file
 * `volunteerVisible` flag is stamped onto the STORAGE OBJECT metadata because
 * the Firestore `attachments` write throws NOT_FOUND pre-doc and is swallowed;
 * POST /api/requests later rebuilds `attachments` by listing these objects.
 */
import { randomUUID } from 'node:crypto';

import express, { Router, type Request, type Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';

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

// POST /requests/:requestId — upload one attachment (raw binary body, filename
// in ?filename, MIME from Content-Type). Validates: auth, v4-UUID id, ownership
// (if doc exists), MIME allowlist, size cap, per-request quota. On success saves
// to Storage, best-effort updates requests.attachments, and returns 201
// { path, downloadURL } (1h signed read URL).
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
  // UC-01 uploads happen in step 3 — BEFORE the request doc is created at the
  // step-4 submit. The client generates `requestId` (a v4 UUID) up front and
  // uses it as the storage path prefix, then POST /api/requests creates the doc
  // with that same id and beneficiaryId = the uploader. So a *missing* doc means
  // "a new request this authenticated user is assembling": allow it — the id is
  // an unguessable v4 UUID, so there is no existing request to inject into. Once
  // the doc EXISTS, enforce the same owner/handler/volunteer/admin gate as the
  // read side (F1) so nobody can inject attachments into someone else's request.
  const requestSnap = await db().collection('requests').doc(requestId).get();
  if (requestSnap.exists) {
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

  // Per-file volunteer visibility (req 21): admins uploading to an admin task
  // request can mark a file private (`?volunteerVisible=false`). Defaults to
  // true so beneficiary uploads keep their existing "assigned volunteer sees
  // it" behavior. The volunteer-facing projection honors this flag.
  const volunteerVisible = req.query.volunteerVisible !== 'false';

  try {
    await bucketFile.save(req.body, {
      resumable: false,
      metadata: {
        contentType,
        metadata: {
          uploadedBy: req.user.uid,
          requestId,
          uploadNonce: randomUUID(),
          // Stamp the volunteer-visibility flag onto the STORAGE OBJECT (not
          // just the Firestore array). UC-01 uploads happen in step 3, BEFORE
          // the request doc exists, so the Firestore `update()` below throws
          // NOT_FOUND and is swallowed — the only durable record of this flag
          // is here. POST /api/requests reconstructs requests.attachments by
          // listing these objects and reading this value back, so staff can
          // list/open beneficiary uploads after submit. (String because custom
          // object metadata values are always strings.)
          volunteerVisible: String(volunteerVisible),
        },
      },
    });

    // ── Persist attachment metadata (Note 1) ────────────────────────────
    // The Storage object is otherwise invisible: nothing records that this
    // file belongs to the request. Embed metadata on requests.attachments so
    // the admin/volunteer doc viewer can list + re-mint signed URLs by name.
    // arrayUnion keeps this idempotent if the same file is re-uploaded.
    //
    // NOTE: in the UC-01 beneficiary flow this `update()` runs BEFORE the
    // request doc exists (uploads are in step 3, the doc is created at the
    // step-4 submit), so it throws NOT_FOUND and is swallowed below. That is
    // expected — POST /api/requests then rebuilds `attachments` from the
    // Storage objects (using the volunteerVisible flag stamped above). This
    // write still matters for uploads to an ALREADY-EXISTING request (admin
    // task attachments, late beneficiary additions): it keeps the array fresh
    // without waiting for a re-list.
    try {
      await db().collection('requests').doc(requestId).update({
        attachments: FieldValue.arrayUnion({
          name: filename,
          path,
          type: contentType,
          size: req.body.length,
          uploadedBy: req.user.uid,
          volunteerVisible,
        }),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (metaErr) {
      // Non-fatal: the file is stored. Log the metadata failure but still
      // return success so the client doesn't re-upload. For pre-doc uploads
      // this NOT_FOUND is expected (see note above) — create() reconciles it.
      // eslint-disable-next-line no-console
      console.error('[uploads.request] attachment metadata write failed:', metaErr);
    }

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
