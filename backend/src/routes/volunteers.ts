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

  try {
    const docRef = await db().collection('volunteerApplications').add({
      // Who applied
      uid:       req.user.uid,
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
