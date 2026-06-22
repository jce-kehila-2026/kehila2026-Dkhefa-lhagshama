/**
 * /api/volunteers — UC Volunteer Signup (#70).
 *
 * POST /api/volunteers/apply
 *   Authenticated endpoint. Any signed-in user may apply to become a volunteer.
 *   Creates a `volunteerApplications/{appId}` document with status `pending`;
 *   an admin reviews it via UC-05 and may promote the user's role to `volunteer`.
 *
 * The client never writes to /volunteerApplications directly — Firestore rules
 * set `allow create, update, delete: if false` for that collection.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { authenticate } from '@/middleware/auth';

const router = Router();

// ── Schema ────────────────────────────────────────────────────────────────────

const AVAILABILITY_OPTIONS = ['2-4', '4-8', '8+'] as const;

const applySchema = z.object({
  // Personal / contact
  firstName:    z.string().trim().min(1).max(80),
  lastName:     z.string().trim().min(1).max(80),
  phone:        z.string().trim().min(1).max(40),
  email:        z.string().trim().email().max(120),
  city:         z.string().trim().min(1).max(80),

  // Volunteering specifics
  profession:   z.string().trim().max(120).optional().default(''),
  areasOfHelp:  z
    .array(z.string().trim().min(1).max(80))
    .min(1, 'At least one area of help is required')
    .max(10),
  languages:    z
    .array(z.string().trim().min(1).max(40))
    .min(1, 'At least one language is required')
    .max(10),
  availability: z.enum(AVAILABILITY_OPTIONS, {
    errorMap: () => ({ message: "availability must be one of '2-4', '4-8', '8+'" }),
  }),

  // Free-text motivation note (optional)
  motivation:   z.string().trim().max(2000).optional().default(''),

  // Consent — must be true.
  consent: z.literal(true, {
    errorMap: () => ({ message: 'consent must be true' }),
  }),
});

type ApplyInput = z.infer<typeof applySchema>;

// ── POST /api/volunteers/apply ────────────────────────────────────────────────

// auth required; validates the apply form (applySchema), rejects already-approved
// volunteers and duplicate pending applications. responds 201 { appId } on create,
// 400 { error, fieldErrors } on bad input, 409 on duplicate/already-volunteer.
router.post('/apply', authenticate, async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const parsed = applySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const input: ApplyInput = parsed.data;

  // An already-approved volunteer must not re-enter the admin queue: they hold no
  // pending application, so the pending-only guard below would let them create a
  // fresh one. Reject up front on the role claim.
  if (req.user.role === 'volunteer') {
    res.status(409).json({ error: 'already_volunteer' });
    return;
  }

  try {
    const uid = req.user.uid;
    const applicationsRef = db().collection('volunteerApplications');
    const docRef = applicationsRef.doc(); // pre-allocated id for the new doc

    // Guard against duplicate submissions: one open (pending) application per
    // user. Without this an authenticated user can POST the form repeatedly and
    // flood the admin queue with rows for the same person, and approving one
    // leaves the rest stranded as pending forever (approve keys off the doc id,
    // not the uid). The check + create run inside a transaction so two concurrent
    // POSTs (double-submit / retry) cannot both observe "no pending app" and each
    // create a row — the second commit aborts and retries against the now-present
    // pending doc, returning 409.
    const created = await db().runTransaction(async (tx) => {
      const existing = await tx.get(
        applicationsRef
          .where('uid', '==', uid)
          .where('status', '==', 'pending')
          .limit(1)
      );
      if (!existing.empty) return false;

      tx.set(docRef, {
        // Who applied
        uid,
        email:     input.email,
        firstName: input.firstName,
        lastName:  input.lastName,
        phone:     input.phone,
        city:      input.city,

        // Volunteer-specific fields
        profession:   input.profession,
        areasOfHelp:  input.areasOfHelp,
        languages:    input.languages,
        availability: input.availability,
        motivation:   input.motivation,

        // Lifecycle
        status:     'pending', // pending | approved | rejected
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: '',

        // Timestamps
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!created) {
      res.status(409).json({ error: 'already_applied' });
      return;
    }

    // Audit log — fire-and-forget.
    writeAuditLog({
      actorId:    req.user.uid,
      action:     'volunteer.apply',
      entityType: 'volunteerApplications',
      entityId:   docRef.id,
      details: {
        areasOfHelp:  input.areasOfHelp,
        availability: input.availability,
        languages:    input.languages,
      },
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[volunteers.apply] audit write failed:', err);
    });

    res.status(201).json({ appId: docRef.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[volunteers.apply] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
