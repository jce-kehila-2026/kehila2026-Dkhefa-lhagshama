/**
 * /api/admin/users — Admin-only user management (#76).
 *
 * Endpoints:
 *   GET  /api/admin/users              — list users from users/{uid} collection
 *   POST /api/admin/users/:uid/promote — promote user to a given role (sets custom claim + users/{uid}.role)
 *   POST /api/admin/users/:uid/demote  — demote back to 'beneficiary' (default role)
 *   POST /api/admin/users/:uid/disable — set users/{uid}.disabled = true (soft deactivation)
 *   POST /api/admin/users/:uid/enable  — re-enable a disabled user
 *
 * Role management goes through Firebase Auth custom claims (Admin SDK) +
 * mirrors the role into users/{uid}.role for quick Firestore queries.
 * Disabling a user sets `disabled: true` on the users/{uid} doc; it does NOT
 * call Firebase Auth disableUser (that would block sign-in entirely).
 * If hard lock-out is needed, call Firebase Auth directly from the admin UI.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db, auth as adminAuth } from '@/lib/firebaseAdmin';
import { authenticate, requireRole, type Role } from '@/middleware/auth';
import { writeAuditLog } from '@/lib/audit';

const router = Router();
router.use(authenticate, requireRole('admin'));

const ROLES: Role[] = ['beneficiary', 'businessOwner', 'volunteer', 'admin'];

/**
 * Returns true if the target user is an admin (req 23 — admin accounts are
 * protected). Checks BOTH the Firebase Auth custom claim (source of truth)
 * and the users/{uid}.role mirror; either being 'admin' counts as admin.
 */
async function isTargetAdmin(uid: string): Promise<boolean> {
  let claimRole: string | null = null;
  try {
    const userRecord = await adminAuth().getUser(uid);
    claimRole = (userRecord.customClaims?.role as string | undefined) ?? null;
  } catch {
    // No Auth record (or lookup failed) — fall back to the Firestore mirror.
  }

  let mirrorRole: string | null = null;
  try {
    const snap = await db().collection('users').doc(uid).get();
    mirrorRole = snap.exists ? ((snap.data()!.role as string | undefined) ?? null) : null;
  } catch {
    // ignore — treat as no mirror role.
  }

  return claimRole === 'admin' || mirrorRole === 'admin';
}

// ── GET /api/admin/users ──────────────────────────────────────────────────
// Firebase Auth is the source of truth for WHO exists — the users/{uid}
// Firestore mirror is lazily created and misses most accounts (e2e round 2,
// defect D2: the chat user picker could not find the volunteer because their
// mirror doc was never written). Auth's listUsers is merged with the mirror
// (disabled flag, profile names) and the volunteers roster (fullName), so
// every real account shows up with the best display name we have.
// Query params: role, limit (default 50, max 200)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, limit: limitStr } = req.query as Record<string, string | undefined>;
    const limit = Math.min(parseInt(limitStr ?? '50', 10) || 50, 200);

    // Page through Auth (1000/page); the project is far below one page today.
    const authUsers = [];
    let pageToken: string | undefined;
    do {
      const page = await adminAuth().listUsers(1000, pageToken);
      authUsers.push(...page.users);
      pageToken = page.pageToken;
    } while (pageToken && authUsers.length < 10000);

    const [usersSnap, volsSnap] = await Promise.all([
      db().collection('users').get(),
      db().collection('volunteers').get(),
    ]);
    const mirror = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
    const volunteers = new Map(volsSnap.docs.map((d) => [d.id, d.data()]));

    let items = authUsers.map((u) => {
      const m = mirror.get(u.uid);
      const v = volunteers.get(u.uid);
      const displayName =
        (typeof m?.displayName === 'string' && m.displayName.trim()) ||
        [m?.firstName, m?.lastName].filter(Boolean).join(' ').trim() ||
        u.displayName?.trim() ||
        (typeof v?.fullName === 'string' && v.fullName.trim()) ||
        (typeof v?.name === 'string' && v.name.trim()) ||
        null;
      const createdAt =
        m?.createdAt?.toDate?.()?.toISOString?.() ??
        (u.metadata.creationTime ? new Date(u.metadata.creationTime).toISOString() : null);
      return {
        uid: u.uid,
        email: u.email ?? m?.email ?? null,
        displayName,
        role: ((u.customClaims?.role as string | undefined) ?? m?.role ?? null) as
          | string
          | null,
        disabled: m?.disabled === true || u.disabled === true,
        createdAt,
        updatedAt: m?.updatedAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    if (role && ROLES.includes(role as Role)) {
      items = items.filter((i) => i.role === role);
    }

    // Newest first (mirrors the previous orderBy createdAt desc), unknown last.
    items.sort(
      (a, b) => (b.createdAt ? Date.parse(b.createdAt) : 0) - (a.createdAt ? Date.parse(a.createdAt) : 0),
    );

    res.json({ items: items.slice(0, limit) });
  } catch (err) {
    console.error('[adminUsers] GET /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

const promoteSchema = z.object({
  role: z.enum(['beneficiary', 'businessOwner', 'volunteer', 'admin']),
});

// ── POST /api/admin/users/:uid/promote ───────────────────────────────────
router.post('/:uid/promote', async (req: Request, res: Response): Promise<void> => {
  const parsed = promoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const { role } = parsed.data;
  const targetUid = req.params.uid;
  const actorId = req.user!.uid;

  try {
    // req 23 — never strip admin off an admin target via this endpoint, and
    // never let an admin demote themselves. (Granting/keeping admin is fine.)
    if (role !== 'admin') {
      if (targetUid === actorId) {
        res.status(403).json({ error: 'cannot_modify_self' });
        return;
      }
      if (await isTargetAdmin(targetUid)) {
        res.status(403).json({ error: 'cannot_modify_admin' });
        return;
      }
    }

    const userRef = db().collection('users').doc(targetUid);
    const userSnap = await userRef.get();

    const prevRole = userSnap.exists ? (userSnap.data()!.role ?? null) : null;

    // Set custom claim
    await adminAuth().setCustomUserClaims(targetUid, { role });

    // Mirror into users/{uid}
    await userRef.set(
      {
        role,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorId,
      },
      { merge: true }
    );

    await writeAuditLog({
      actorId,
      action: 'user.promote',
      entityType: 'users',
      entityId: targetUid,
      details: { from: prevRole, to: role },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminUsers] POST /:uid/promote:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/users/:uid/demote ────────────────────────────────────
// Resets role to 'beneficiary' (the default).
router.post('/:uid/demote', async (req: Request, res: Response): Promise<void> => {
  const targetUid = req.params.uid;
  const actorId = req.user!.uid;

  try {
    // req 23 — an admin account can never be demoted, nor can an admin demote
    // their own account.
    if (targetUid === actorId) {
      res.status(403).json({ error: 'cannot_modify_self' });
      return;
    }
    if (await isTargetAdmin(targetUid)) {
      res.status(403).json({ error: 'cannot_modify_admin' });
      return;
    }

    const userRef = db().collection('users').doc(targetUid);
    const userSnap = await userRef.get();
    const prevRole = userSnap.exists ? (userSnap.data()!.role ?? null) : null;

    await adminAuth().setCustomUserClaims(targetUid, { role: 'beneficiary' });

    await userRef.set(
      {
        role: 'beneficiary',
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorId,
      },
      { merge: true }
    );

    await writeAuditLog({
      actorId,
      action: 'user.demote',
      entityType: 'users',
      entityId: targetUid,
      details: { from: prevRole, to: 'beneficiary' },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminUsers] POST /:uid/demote:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/users/:uid/disable ───────────────────────────────────
// Soft-disable: sets users/{uid}.disabled = true. Does NOT lock Firebase Auth.
router.post('/:uid/disable', async (req: Request, res: Response): Promise<void> => {
  const targetUid = req.params.uid;
  const actorId = req.user!.uid;

  try {
    // req 23 — an admin account can never be disabled, nor can an admin disable
    // their own account.
    if (targetUid === actorId) {
      res.status(403).json({ error: 'cannot_modify_self' });
      return;
    }
    if (await isTargetAdmin(targetUid)) {
      res.status(403).json({ error: 'cannot_modify_admin' });
      return;
    }

    await db()
      .collection('users')
      .doc(targetUid)
      .set(
        {
          disabled: true,
          disabledBy: actorId,
          disabledAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    await writeAuditLog({
      actorId,
      action: 'user.disable',
      entityType: 'users',
      entityId: targetUid,
      details: {},
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminUsers] POST /:uid/disable:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/users/:uid/enable ────────────────────────────────────
router.post('/:uid/enable', async (req: Request, res: Response): Promise<void> => {
  const targetUid = req.params.uid;
  const actorId = req.user!.uid;

  try {
    await db()
      .collection('users')
      .doc(targetUid)
      .set(
        {
          disabled: false,
          enabledBy: actorId,
          enabledAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    await writeAuditLog({
      actorId,
      action: 'user.enable',
      entityType: 'users',
      entityId: targetUid,
      details: {},
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminUsers] POST /:uid/enable:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
