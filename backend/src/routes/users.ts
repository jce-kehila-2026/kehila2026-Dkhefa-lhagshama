/**
 * /api/users — user profile collection (#63).
 *
 * `users/{uid}` stores editable profile fields used to auto-fill the request
 * form (#67) and to drive admin user management (#76). It is distinct from the
 * Firebase Auth record: `email` and `role` live on the Auth user / custom
 * claims and are NEVER mutated here — PATCH rejects them with 400 so a
 * beneficiary cannot self-escalate to admin.
 *
 * All writes go through the Admin SDK; Firestore rules make `users/{uid}`
 * client-read-only (owner + admin read, no client write).
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { authenticate } from '@/middleware/auth';

const router = Router();

// Fields a user may edit on their own profile. `email` and `role` are
// intentionally absent — see file header.
const profileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    firstName:   z.string().trim().max(80).optional(),
    lastName:    z.string().trim().max(80).optional(),
    phone:       z.string().trim().max(40).optional(),
    city:        z.string().trim().max(80).optional(),
    age:         z.coerce.number().int().min(0).max(120).optional(),
    gender:      z.enum(['male', 'female', 'other', '']).optional(),
    preferredLang: z.enum(['he', 'en']).optional(),
  })
  .strict(); // reject unknown keys (including email/role) loudly

/** Build a fresh profile doc from the authenticated token. */
function defaultProfile(user: NonNullable<Request['user']>) {
  return {
    email: user.email ?? '',
    role: user.role ?? 'beneficiary',
    displayName: '',
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    age: null as number | null,
    gender: '' as 'male' | 'female' | 'other' | '',
    preferredLang: 'he' as 'he' | 'en',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
}

// Shape a stored profile for the wire: expose the doc id as `uid` and convert
// Firestore Timestamps to ISO strings (null when unset).
function serialize(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    uid: id,
    ...data,
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? null,
  };
}

// ── GET /api/users/me ──────────────────────────────────────────────────────
// Returns the caller's profile, lazily creating it if missing so the client
// always gets a 200 with a usable shape.
router.get('/me', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const ref = db().collection('users').doc(req.user.uid);
  try {
    const snap = await ref.get();
    if (!snap.exists) {
      const profile = defaultProfile(req.user);
      await ref.set(profile);
      const created = await ref.get();
      res.json({ profile: serialize(ref.id, created.data() ?? profile) });
      return;
    }
    res.json({ profile: serialize(snap.id, snap.data() ?? {}) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[users.me.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// ── PATCH /api/users/me ──────────────────────────────────────────────────────
// Updates editable profile fields. Mutating email or role is rejected with 400.
router.patch('/me', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  // Reject privileged-field mutation explicitly with a clear message before
  // the generic strict-schema rejection, so the client gets actionable detail.
  const body = (req.body ?? {}) as Record<string, unknown>;
  if ('email' in body || 'role' in body) {
    res.status(400).json({
      error: 'forbidden_field',
      detail: 'email and role cannot be changed via this endpoint',
    });
    return;
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const ref = db().collection('users').doc(req.user.uid);
  try {
    // Ensure the doc exists so a PATCH-before-GET still works.
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set(defaultProfile(req.user));
    }
    await ref.set(
      { ...parsed.data, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    const updated = await ref.get();
    res.json({ profile: serialize(ref.id, updated.data() ?? {}) });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[users.me.patch] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
