/**
 * requireNotDisabled — server-side enforcement of the soft-disable flag.
 *
 * POST /api/admin/users/:uid/disable only sets users/{uid}.disabled = true; it
 * does NOT lock the Firebase Auth user, so a disabled account keeps a valid,
 * unexpired ID token. Without this middleware the disable action is purely
 * cosmetic — the client-side redirect to /account-disabled (AuthContext) can be
 * bypassed by calling the API directly. This guard reads the flag on every
 * authenticated mutation and returns 403 account_disabled when it is set.
 *
 * Compose it AFTER `authenticate` (it relies on req.user.uid). Admins are
 * exempt: an admin can never be disabled (see adminUsers disable guard), so the
 * extra read is skipped for them. Reads fail open on a transient Firestore
 * error so a DB hiccup does not lock out the whole API; the flag is a soft,
 * defense-in-depth control, not the only access gate.
 */
import type { NextFunction, Request, Response } from 'express';

import { db } from '@/lib/firebaseAdmin';

export async function requireNotDisabled(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }
  // Admins cannot be disabled — skip the read on the hot admin path.
  if (req.user.role === 'admin') {
    next();
    return;
  }
  try {
    const snap = await db().collection('users').doc(req.user.uid).get();
    if (snap.exists && snap.data()?.disabled === true) {
      res.status(403).json({ error: 'account_disabled' });
      return;
    }
  } catch (err) {
    // Fail open on a transient read error: the soft flag is defense-in-depth,
    // not the primary auth gate, and we must not lock everyone out on a hiccup.
    // eslint-disable-next-line no-console
    console.warn('[requireNotDisabled] disabled-flag read failed:', err);
  }
  next();
}
