/**
 * /api/profile — self-service profile assets (Note 11).
 *
 * POST /api/profile/avatar — authenticated; multipart/raw image upload.
 *   Stores the image at `avatars/{uid}/avatar.<ext>` via the Admin SDK and
 *   records the Storage PATH (not a public URL) on `users/{uid}.photoURL`.
 *   Returns a short-lived signed read URL so the client can preview it.
 *
 * Following the existing uploads.ts pattern, the image bytes are sent as the
 * raw request body (express.raw) with the image MIME in the Content-Type
 * header — no multer dependency needed. Storage rules deny client reads of
 * avatars/**; the backend mints signed URLs.
 */
import express, { Router, type Request, type Response } from 'express';

import { db, storage } from '@/lib/firebaseAdmin';
import { mintSignedReadUrl } from '@/lib/signedUrl';
import { authenticate } from '@/middleware/auth';

const router = Router();

/** Allowed avatar MIME types → file extension. */
const AVATAR_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Maximum avatar size: 5 MB. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// ── POST /api/profile/avatar ────────────────────────────────────────────────
router.post(
  '/avatar',
  authenticate,
  express.raw({ type: '*/*', limit: '6mb' }),
  async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: 'not_authenticated' });
      return;
    }

    // Strip the base MIME type (ignore any params like "; charset=...").
    const rawContentType =
      typeof req.headers['content-type'] === 'string'
        ? req.headers['content-type']
        : '';
    const contentType = rawContentType.split(';')[0].trim().toLowerCase();

    const ext = AVATAR_MIME_EXT[contentType];
    if (!ext) {
      res.status(415).json({
        error: 'unsupported_media_type',
        detail: `Allowed types: ${Object.keys(AVATAR_MIME_EXT).join(', ')}`,
      });
      return;
    }

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: 'validation', detail: 'expected image body' });
      return;
    }

    if (req.body.length > MAX_AVATAR_BYTES) {
      res.status(413).json({
        error: 'file_too_large',
        detail: `Max ${MAX_AVATAR_BYTES / 1024 / 1024} MB`,
      });
      return;
    }

    const uid = req.user.uid;
    const path = `avatars/${uid}/avatar.${ext}`;
    const bucketFile = storage().file(path);

    try {
      await bucketFile.save(req.body, {
        resumable: false,
        metadata: {
          contentType,
          metadata: { uploadedBy: uid },
        },
      });

      // Record the Storage PATH (not a public URL) on the user profile, so the
      // chat-participants endpoint can mint a fresh signed URL on demand.
      await db()
        .collection('users')
        .doc(uid)
        .set({ photoURL: path }, { merge: true });

      const avatarUrl = await mintSignedReadUrl(path);
      res.status(200).json({ ok: true, avatarUrl });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[profile.avatar] failed:', {
        message: err instanceof Error ? err.message : String(err),
        uid,
        path,
        bodySize: Buffer.isBuffer(req.body) ? req.body.length : 0,
      });
      res.status(500).json({ error: 'internal' });
    }
  },
);

export default router;
