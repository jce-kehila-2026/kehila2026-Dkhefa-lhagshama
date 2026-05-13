import { randomUUID } from 'node:crypto';

import express, { Router, type Request, type Response } from 'express';

import { auth as firebaseAuth, storage } from '@/lib/firebaseAdmin';
import { authenticate } from '@/middleware/auth';

const router = Router();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

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

  const filenameParam = typeof req.query.filename === 'string' ? req.query.filename : 'upload.bin';
  const filename = safeName(filenameParam);
  const contentType = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : 'application/octet-stream';

  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({ error: 'validation', detail: 'expected binary request body' });
    return;
  }

  if (req.body.length > 10 * 1024 * 1024) {
    res.status(413).json({ error: 'file_too_large' });
    return;
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

    const [downloadURL] = await bucketFile.getSignedUrl({
      action: 'read',
      expires: '2500-01-01T00:00:00.000Z',
    });

    res.status(201).json({ path, downloadURL });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[uploads.request] failed:', {
      message: err instanceof Error ? err.message : String(err),
      code: err instanceof Error && 'code' in err ? (err as any).code : undefined,
      requestId,
      path,
      bodySize: req.body.length,
    });
    res.status(500).json({ error: 'internal' });
  }
});

export default router;