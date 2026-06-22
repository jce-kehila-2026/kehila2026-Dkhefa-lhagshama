/**
 * volunteer self-service profile: GET + PATCH /api/volunteer/me.
 *
 * the authenticated volunteer reads and updates their own `volunteers/{uid}` doc:
 * workStatus (free/working/unavailable + return date), recurring availability
 * windows, and category-permission requests (queued for admin approval). collaborates
 * with categoriesCache (taxonomy validation), lib/availability (window/return-date
 * helpers), and writeAuditLog. mounted by the volunteerApp router; req.user is set
 * upstream by auth middleware (uid is trusted, never read from the body).
 *
 * invariant: workStatus is auto-healed on read — an "unavailable" volunteer whose
 * availableAgainOn has passed flips back to "free" (and the flip is persisted), so
 * there is no separate cron and the roster/matcher never see a stale unavailable state.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { writeAuditLog } from '@/lib/audit';
import { isAllowedCategory } from '@/lib/categoriesCache';
import {
  isValidWindow,
  isReturnDatePast,
  type AvailabilityWindow,
} from '@/lib/availability';

// ── GET /api/volunteer/me ────────────────────────────────────────────────────
// The caller's volunteer profile bits. Returns defaults if no volunteers doc.
export async function getMe(req: Request, res: Response): Promise<void> {
  const uid = req.user!.uid;
  try {
    const ref = db().collection('volunteers').doc(uid);
    const snap = await ref.get();
    const data = (snap.data() as Record<string, unknown> | undefined) ?? {};

    let workStatus = (data.workStatus as string | undefined) ?? 'free';
    let availableAgainOn = (data.availableAgainOn as string | null | undefined) ?? null;

    // Auto-clear: an "unavailable" volunteer whose return date has passed flips
    // back to free on read (no separate cron). Persist the flip so the admin
    // roster + matcher see the same fresh state.
    if (workStatus === 'unavailable' && isReturnDatePast(availableAgainOn, Date.now())) {
      workStatus = 'free';
      availableAgainOn = null;
      try {
        await ref.set(
          { workStatus: 'free', availableAgainOn: null, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      } catch (e) {
        console.error('[volunteer] GET /me auto-clear:', e);
      }
    }

    res.json({
      workStatus,
      approvedCategories: (data.approvedCategories as string[] | undefined) ?? [],
      requestedCategories: (data.requestedCategories as unknown[] | undefined) ?? [],
      availabilityWindows: (data.availabilityWindows as AvailabilityWindow[] | undefined) ?? [],
      availableAgainOn,
    });
  } catch (err) {
    console.error('[volunteer] GET /me:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}

// ── PATCH /api/volunteer/me ──────────────────────────────────────────────────
// Body: { workStatus?, requestCategory?: { category, note? } }. At least one.
const patchMeSchema = z
  .object({
    workStatus: z.enum(['free', 'working', 'unavailable']).optional(),
    requestCategory: z
      .object({
        category: z.string().trim().min(1).max(80),
        note: z.string().trim().max(2000).optional(),
      })
      .optional(),
    availabilityWindows: z
      .array(
        z.object({
          day: z.number().int().min(0).max(6),
          start: z.string(),
          end: z.string(),
        }),
      )
      .max(40)
      .optional(),
    availableAgainOn: z
      .union([
        z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'availableAgainOn must be YYYY-MM-DD'),
        z.null(),
      ])
      .optional(),
  })
  .refine(
    (d) =>
      d.workStatus !== undefined ||
      d.requestCategory !== undefined ||
      d.availabilityWindows !== undefined ||
      d.availableAgainOn !== undefined,
    { message: 'at least one field is required' },
  )
  .superRefine(async (d, ctx) => {
    // A volunteer may only request permission for an ACTIVE id from the
    // admin-managed taxonomy (no more free text). Fail-open if the taxonomy
    // is unseeded — see lib/categoriesCache.
    if (d.requestCategory && !(await isAllowedCategory(d.requestCategory.category, 'active'))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestCategory', 'category'],
        message: 'unknown category',
      });
    }
  });

export async function patchMe(req: Request, res: Response): Promise<void> {
  // safeParseAsync: the schema's superRefine awaits the category taxonomy.
  const parsed = await patchMeSchema.safeParseAsync(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const uid = req.user!.uid;
  const { workStatus, requestCategory, availabilityWindows, availableAgainOn } = parsed.data;
  const ref = db().collection('volunteers').doc(uid);

  // Reject any structurally-bad window (bad HH:MM, end<=start) before writing.
  if (availabilityWindows) {
    const bad = availabilityWindows.find((w) => !isValidWindow(w));
    if (bad) {
      res.status(400).json({ error: 'invalid_input', details: { availabilityWindows: 'invalid window' } });
      return;
    }
  }

  try {
    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (workStatus) update.workStatus = workStatus;
    if (availabilityWindows !== undefined) update.availabilityWindows = availabilityWindows;
    if (availableAgainOn !== undefined) update.availableAgainOn = availableAgainOn;
    // When the volunteer is no longer unavailable, drop any stale return date.
    if (workStatus && workStatus !== 'unavailable') update.availableAgainOn = null;
    if (requestCategory) {
      // arrayUnion appends without clobbering, and merge:true handles a thin doc.
      update.requestedCategories = FieldValue.arrayUnion({
        category: requestCategory.category,
        note: requestCategory.note ?? '',
        requestedAt: new Date().toISOString(),
        status: 'pending',
      });
    }
    await ref.set(update, { merge: true });

    await writeAuditLog({
      actorId: uid,
      action: 'volunteer.update_me',
      entityType: 'volunteers',
      entityId: uid,
      details: {
        workStatus: workStatus ?? null,
        requestedCategory: requestCategory?.category ?? null,
        availabilityWindowsCount: availabilityWindows?.length ?? null,
        availableAgainOn: availableAgainOn ?? null,
      },
    });

    // Read back the freshest bits so the client reflects committed state.
    const snap = await ref.get();
    const data = (snap.data() as Record<string, unknown> | undefined) ?? {};
    res.json({
      workStatus: (data.workStatus as string | undefined) ?? 'free',
      approvedCategories: (data.approvedCategories as string[] | undefined) ?? [],
      requestedCategories: (data.requestedCategories as unknown[] | undefined) ?? [],
      availabilityWindows: (data.availabilityWindows as AvailabilityWindow[] | undefined) ?? [],
      availableAgainOn: (data.availableAgainOn as string | null | undefined) ?? null,
    });
  } catch (err) {
    console.error('[volunteer] PATCH /me:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}
