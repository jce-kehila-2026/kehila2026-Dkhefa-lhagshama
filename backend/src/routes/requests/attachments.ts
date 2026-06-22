/**
 * Attachment download brokering for a single request.
 *
 * Firebase Storage stays client-read denied; this is the ONLY path that hands
 * out (short-lived) read links to request attachments, so every download is
 * gated through the server's auth + visibility checks here. Used by staff
 * (admin / assigned volunteer) reviewing a case; the owning beneficiary is not
 * served here. Responds { url, expiresAt }.
 *
 * Mechanical extraction from the former single-file routes/requests.ts; the
 * handler logic is unchanged.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { mintSignedReadUrl, SIGNED_URL_TTL_MS } from '@/lib/signedUrl';

// ── GET /api/requests/:id/attachments/:name ──────────────────────────────
// Re-mint a short-lived signed read URL for a single attachment (Note 1).
// Authorization: admin OR the assigned volunteer/handler of the request (403
// otherwise). The owning beneficiary is intentionally NOT granted here — doc
// viewing is for staff reviewing the case. 404 if `name` isn't an attachment
// of this request. Storage stays client-read denied; only this endpoint hands
// out (short-lived) links.
export async function viewAttachment(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const requestId = req.params.id;
  const name = req.params.name;

  try {
    const snap = await db().collection('requests').doc(requestId).get();
    if (!snap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const data = snap.data() as {
      handler?: string | null;
      assignedVolunteerId?: string | null;
      requestType?: string;
      attachments?: Array<{ name?: string; path?: string; volunteerVisible?: boolean }>;
    };

    const isAdmin = req.user.role === 'admin';
    const isAssigned =
      data.assignedVolunteerId === req.user.uid || data.handler === req.user.uid;
    if (!isAdmin && !isAssigned) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const match = (data.attachments ?? []).find((a) => a?.name === name);
    if (!match?.path) {
      res.status(404).json({ error: 'attachment_not_found' });
      return;
    }
    // Storage-isolation guard (defense-in-depth): only ever broker a signed
    // URL for an object under THIS request's own prefix. A mis-stored path
    // (e.g. pointing at another request's PII or an avatars/<uid>/ object)
    // must never resolve to a download for this request's volunteer/handler.
    if (!match.path.startsWith(`requests/${requestId}/`)) {
      res.status(404).json({ error: 'attachment_not_found' });
      return;
    }
    // Mirror the volunteer-card projection (volunteerApp.ts projectAttachments):
    // on task requests, an attachment not flagged volunteerVisible is staff-only.
    // A non-admin caller (the assigned volunteer) must not mint a URL for it, so
    // the download gate and the list gate can never diverge.
    if (!isAdmin && data.requestType === 'task' && match.volunteerVisible !== true) {
      res.status(404).json({ error: 'attachment_not_found' });
      return;
    }

    const url = await mintSignedReadUrl(match.path);
    if (!url) {
      res.status(404).json({ error: 'attachment_not_found' });
      return;
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS).toISOString();
    res.json({ url, expiresAt });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.attachments.view] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
}
