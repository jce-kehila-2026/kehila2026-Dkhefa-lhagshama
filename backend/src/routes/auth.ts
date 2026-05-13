/**
 * Auth routes — sets the default `beneficiary` role on registration.
 *
 * The actual sign-up (createUserWithEmailAndPassword) happens on the client
 * via the Firebase Web SDK. After it succeeds, the client POSTs here with the
 * fresh ID token; we verify it and call `setCustomUserClaims` so the user
 * gains the `beneficiary` role.
 *
 * Volunteer / businessOwner roles are assigned by admin tooling, NOT here.
 * Admin is bootstrapped via `scripts/setAdminClaim.ts`.
 */
import { Router, type Request, type Response } from "express";

import { auth as firebaseAuth } from "@/lib/firebaseAdmin";
import { authenticate } from "@/middleware/auth";

const router = Router();

/**
 * POST /api/auth/register
 *
 * Caller must have just signed up via Firebase Auth (Email/Password). The
 * `authenticate` middleware verifies the ID token; we then promote the user
 * to `beneficiary`. Idempotent — calling again is harmless.
 */
router.post("/register", authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  try {
    // If this token already carries a privileged role, do not overwrite it.
    // Newly created self-signups usually arrive here without a role yet.
    if (req.user.role && req.user.role !== "beneficiary") {
      res.json({ ok: true, role: req.user.role, alreadyAssigned: true });
      return;
    }

    await firebaseAuth().setCustomUserClaims(req.user.uid, {
      role: "beneficiary",
    });
    res.json({ ok: true, role: "beneficiary" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[auth/register] failed:", err);
    res.status(500).json({ error: "role_assignment_failed" });
  }
});

export default router;
