/**
 * POST /api/requests/:id/close — beneficiary side of the mutual-consent close
 * handshake (req 25). Thin Express handler: it auth-gates, validates the action
 * (propose/approve/decline), delegates the actual state machine to
 * lib/closeConsent.applyCloseConsent, then records timeline/audit side-effects.
 *
 * The volunteer side and the shared close logic live elsewhere: the assigned
 * volunteer hits its own route, and both routes call the same applyCloseConsent.
 * Response shape: { ok, closed, closeRequest }.
 *
 * Mechanical extraction from the former single-file routes/requests.ts —
 * the handler logic is unchanged.
 */
import { type Request, type Response } from 'express';

import { writeAuditLog } from '@/lib/audit';
import { writeRequestEvent } from '@/lib/requestEvents';
import { applyCloseConsent } from '@/lib/closeConsent';

import { closeSchema, CLOSE_HTTP } from './schemas';

// ── POST /api/requests/:id/close ─────────────────────────────────────────
// Beneficiary side of the mutual-consent close handshake (req 25). The
// beneficiary may propose/approve/decline a close on their own request.
// applyCloseConsent re-checks ownership defensively. On both sides approving
// (result.closed) we record a status_changed event + audit log. We do NOT
// notify the beneficiary here — they initiated this action.
export async function closeRequest(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const parsed = closeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'validation', fieldErrors: parsed.error.flatten().fieldErrors });
    return;
  }

  const requestId = req.params.id;
  const actorId = req.user.uid;
  const { action } = parsed.data;

  let result;
  try {
    result = await applyCloseConsent(requestId, 'beneficiary', actorId, action);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[requests.close] failed:', err);
    res.status(500).json({ error: 'internal' });
    return;
  }

  if (result.status !== 'ok') {
    // map the consent state-machine status (not_found/forbidden/invalid_state)
    // to its HTTP code; unknown status falls back to 500.
    res.status(CLOSE_HTTP[result.status] ?? 500).json({ error: result.status });
    return;
  }

  // side-effects below are best-effort: the close/handshake write already
  // committed in applyCloseConsent, so a failure here is logged but not surfaced.
  if (result.closed) {
    try {
      await writeRequestEvent({
        requestId,
        type: 'status_changed',
        actorId,
        visibility: 'all',
        details: { to: 'closed', via: 'consent' },
      });
      await writeAuditLog({
        actorId,
        action: 'request.close',
        entityType: 'requests',
        entityId: requestId,
        details: { to: 'closed', via: 'consent', role: 'beneficiary' },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[requests.close] side-effects:', err);
    }
  } else if (result.action) {
    // Propose/decline leave a timeline trace too, so admins can see a pending
    // (or withdrawn) consent-close handshake before it resolves.
    try {
      await writeRequestEvent({
        requestId,
        type: 'close_consent',
        actorId,
        visibility: 'all',
        details: { action: result.action, role: 'beneficiary' },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[requests.close] consent-event side-effects:', err);
    }
  }

  res.json({ ok: true, closed: result.closed, closeRequest: result.closeRequest });
}
