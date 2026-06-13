/**
 * Admin directory management — full CRUD over the two directory catalogs
 * (`answers` = partner organizations / עמותות+שותפים, `businesses` = community
 * businesses). Mounted at /api/admin/directory.
 *
 * Unlike the approval queue (routes/admin.ts), which only flips `status` on
 * pending docs, these routes let an admin list ALL docs regardless of status,
 * create new entries (born `approved` — admin-created content is trusted),
 * edit content fields, and hard-delete. All writes go through the Admin SDK
 * (Firestore rules keep client create/delete denied) and every mutation writes
 * an `auditLogs` entry in the same style as admin.ts approve/reject.
 */
import { Router, type Request, type Response } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';
import { writeAuditLog } from '@/lib/audit';
import { isAllowedCategory } from '@/lib/categoriesCache';

const router = Router();

// All routes require a verified admin token (same gate as routes/admin.ts).
router.use(authenticate, requireRole('admin'));

// ── Shared schemas ────────────────────────────────────────────────────────────

const statusSchema = z.enum(['pending', 'approved', 'rejected', 'needs_changes']);

// Bilingual `{ he, en }` field contract (matches the seeded directory shape).
const requiredBilingualSchema = z.object({
  he: z.string().trim().min(1).max(2000),
  en: z.string().trim().min(1).max(2000),
});

const optionalBilingualSchema = z.object({
  he: z.string().trim().max(2000),
  en: z.string().trim().max(2000),
});

// http(s)-only URL — same scheme check as the businesses.ts `website` field:
// zod's .url() alone accepts javascript: URLs, which would become a stored
// link-injection on the public directory. Empty string means "not provided".
const httpUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), { message: 'invalid_url_scheme' })
  .optional()
  .or(z.literal(''));

// Admin list size: ?limit= default 100, capped at 500 (same parseInt pattern
// as adminUsers/adminRequests).
function parseLimit(req: Request): number {
  const { limit: limitStr } = req.query as Record<string, string | undefined>;
  return Math.min(parseInt(limitStr ?? '100', 10) || 100, 500);
}

// ISO strings (or null) sort lexicographically, so this is a plain desc sort.
function byCreatedAtDesc(a: { createdAt: string | null }, b: { createdAt: string | null }): number {
  return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
}

// ── ANSWERS (partner organizations) ──────────────────────────────────────────

const orgTypeSchema = z.enum(['ngo', 'partner']);

const answerFieldsSchema = z.object({
  title: requiredBilingualSchema,
  body: optionalBilingualSchema,
  category: z.string().trim().min(1).max(80),
  orgType: orgTypeSchema,
  region: optionalBilingualSchema,
  audience: optionalBilingualSchema,
  // Optional contact fields (NPO org import). Phone is a free string (covers
  // local formats + short codes like '3362*'); email is validated. Empty string
  // means "clear the value".
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  sourceName: z.string().trim().max(160),
  sourceUrl: httpUrlSchema,
});

// A directory answer's category drives the public NGO-area filter chips and
// label resolution; a category with no `categories/{id}` doc resolves only to
// its raw id and never appears under any chip. So — like every other
// category-bearing write (requests.ts, adminRequests.ts, volunteerApp.ts) —
// reject a category that is not in the taxonomy. Async (the id set lives in
// Firestore, cached ~60s), so the handlers use safeParseAsync.
//
// `scope` differs by operation (review r6, finding 2):
//   - create: 'active' — a NEW org must use a live, non-archived category.
//   - update: 'all'    — an EXISTING org may keep an archived category. The
//       admin edit form always resends `category` even when only an unrelated
//       field changed, so validating against 'active' would 400 (and strand)
//       any org whose category was later soft-archived. 'all' mirrors the
//       categoriesCache scope used elsewhere for historical references.
async function rejectUnknownCategory(
  category: string | undefined,
  ctx: z.RefinementCtx,
  scope: 'active' | 'all',
): Promise<void> {
  if (category === undefined) return; // partial update without a category change
  if (!(await isAllowedCategory(category, scope))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['category'],
      message: 'unknown category',
    });
  }
}

const createAnswerSchema = answerFieldsSchema
  .extend({
    body: optionalBilingualSchema.default({ he: '', en: '' }),
    region: optionalBilingualSchema.optional(),
    audience: optionalBilingualSchema.optional(),
    sourceName: z.string().trim().max(160).optional(),
  })
  .superRefine((data, ctx) => rejectUnknownCategory(data.category, ctx, 'active'));

const updateAnswerSchema = answerFieldsSchema
  .extend({ status: statusSchema })
  .partial()
  .superRefine((data, ctx) => rejectUnknownCategory(data.category, ctx, 'all'));

// GET /api/admin/directory/answers — ALL answers regardless of status.
// Whole-collection get + in-memory sort/limit (project convention: no new
// composite indexes; the collection is directory-sized).
router.get('/answers', async (req: Request, res: Response): Promise<void> => {
  const limit = parseLimit(req);

  try {
    const snapshot = await db().collection('answers').get();
    const items = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title ?? null,
          body: data.body ?? null,
          category: data.category ?? null,
          region: data.region ?? null,
          audience: data.audience ?? null,
          phone: data.phone ?? null,
          email: data.email ?? null,
          sourceName: data.sourceName ?? null,
          sourceUrl: data.sourceUrl ?? null,
          // Absent orgType counts as 'ngo' (pre-field docs).
          orgType: data.orgType === 'partner' ? 'partner' : 'ngo',
          status: data.status ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        };
      })
      .sort(byCreatedAtDesc)
      .slice(0, limit);

    res.json({ items });
  } catch (err) {
    console.error('[adminDirectory] GET /answers:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/admin/directory/answers — create a partner organization entry.
// Born `approved`: admin-created content is trusted, no approval round-trip.
router.post('/answers', async (req: Request, res: Response): Promise<void> => {
  const parsed = await createAnswerSchema.safeParseAsync(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const input = parsed.data;
  const actorId = req.user!.uid;

  try {
    const sourceUrl = input.sourceUrl?.trim() ? input.sourceUrl.trim() : null;
    const phone = input.phone?.trim() ? input.phone.trim() : null;
    const email = input.email?.trim() ? input.email.trim() : null;

    const docRef = await db().collection('answers').add({
      title: input.title,
      body: input.body,
      category: input.category,
      orgType: input.orgType,
      region: input.region ?? null,
      audience: input.audience ?? null,
      phone,
      email,
      sourceName: input.sourceName ?? null,
      sourceUrl,
      status: 'approved',
      createdBy: actorId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      actorId,
      action: 'directory_create',
      entityType: 'answers',
      entityId: docRef.id,
      // Changed keys only — no content/PII dump in the audit trail.
      details: { fields: Object.keys(input) },
    });

    res.status(201).json({ id: docRef.id });
  } catch (err) {
    console.error('[adminDirectory] POST /answers:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /api/admin/directory/answers/:id — partial content/status update.
router.patch('/answers/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = await updateAnswerSchema.safeParseAsync(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const input = parsed.data;
  const actorId = req.user!.uid;

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) updates.body = input.body;
  if (input.category !== undefined) updates.category = input.category;
  if (input.orgType !== undefined) updates.orgType = input.orgType;
  if (input.region !== undefined) updates.region = input.region;
  if (input.audience !== undefined) updates.audience = input.audience;
  if (input.phone !== undefined) {
    updates.phone = input.phone.trim() ? input.phone.trim() : null;
  }
  if (input.email !== undefined) {
    updates.email = input.email.trim() ? input.email.trim() : null;
  }
  if (input.sourceName !== undefined) updates.sourceName = input.sourceName;
  if (input.sourceUrl !== undefined) {
    updates.sourceUrl = input.sourceUrl.trim() ? input.sourceUrl.trim() : null;
  }
  if (input.status !== undefined) updates.status = input.status;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'no_fields' });
    return;
  }

  try {
    const ref = db().collection('answers').doc(req.params.id);
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });

    await writeAuditLog({
      actorId,
      action: 'directory_update',
      entityType: 'answers',
      entityId: req.params.id,
      details: { fields: Object.keys(updates) },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminDirectory] PATCH /answers/:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /api/admin/directory/answers/:id — hard delete.
router.delete('/answers/:id', async (req: Request, res: Response): Promise<void> => {
  const actorId = req.user!.uid;

  try {
    const ref = db().collection('answers').doc(req.params.id);
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await ref.delete();

    await writeAuditLog({
      actorId,
      action: 'directory_delete',
      entityType: 'answers',
      entityId: req.params.id,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminDirectory] DELETE /answers/:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── BUSINESSES (community businesses) ────────────────────────────────────────

// Mirrors the public submit schema in businesses.ts: flat strings that get
// stored under the bilingual `{ he, en }` contract with the same value in both
// languages (no translation at create/edit time; refine later if needed).
const businessCategorySchema = z.enum(['food', 'services', 'health', 'education', 'beauty', 'tech']);

const tagsSchema = z.array(z.string().trim().min(1).max(40)).max(12);

const businessFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  ownerName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(40),
  category: businessCategorySchema,
  city: z.string().trim().min(1).max(80),
  description: z.string().trim().min(10).max(1200),
  website: httpUrlSchema,
  tags: tagsSchema,
});

const createBusinessSchema = businessFieldsSchema.extend({ tags: tagsSchema.optional() });

const updateBusinessSchema = businessFieldsSchema.extend({ status: statusSchema }).partial();

// GET /api/admin/directory/businesses — ALL businesses regardless of status.
router.get('/businesses', async (req: Request, res: Response): Promise<void> => {
  const limit = parseLimit(req);

  try {
    const snapshot = await db().collection('businesses').get();
    const items = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        // ownerId / createdBy stay internal (same F8 choice as admin.ts /pending).
        return {
          id: doc.id,
          name: data.name ?? null,
          ownerName: data.ownerName ?? null,
          phone: data.phone ?? null,
          category: data.category ?? null,
          city: data.city ?? null,
          description: data.description ?? null,
          website: data.website ?? null,
          tags: data.tags ?? { he: [], en: [] },
          featured: data.featured ?? false,
          rating: data.rating ?? 0,
          reviews: data.reviews ?? 0,
          status: data.status ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
        };
      })
      .sort(byCreatedAtDesc)
      .slice(0, limit);

    res.json({ items });
  } catch (err) {
    console.error('[adminDirectory] GET /businesses:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// POST /api/admin/directory/businesses — create a business entry.
// Born `approved`; `ownerId: null` (admin-created, no owner-edit path).
router.post('/businesses', async (req: Request, res: Response): Promise<void> => {
  const parsed = createBusinessSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const input = parsed.data;
  const actorId = req.user!.uid;

  try {
    const website = input.website?.trim() ? input.website.trim() : null;
    const tags = input.tags ?? [];

    const docRef = await db().collection('businesses').add({
      name: { he: input.name, en: input.name },
      ownerName: input.ownerName,
      phone: input.phone,
      category: input.category,
      city: { he: input.city, en: input.city },
      description: { he: input.description, en: input.description },
      website,
      tags: { he: tags, en: tags },
      ownerId: null,
      createdBy: actorId,
      approved: true,
      status: 'approved',
      featured: false,
      rating: 0,
      reviews: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      actorId,
      action: 'directory_create',
      entityType: 'businesses',
      entityId: docRef.id,
      details: { fields: Object.keys(input) },
    });

    res.status(201).json({ id: docRef.id });
  } catch (err) {
    console.error('[adminDirectory] POST /businesses:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// PATCH /api/admin/directory/businesses/:id — partial content/status update.
// Bilingual fields are mirrored (he = en = submitted string), same as the
// public submit path — editing them overwrites both languages.
router.patch('/businesses/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = updateBusinessSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const input = parsed.data;
  const actorId = req.user!.uid;

  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = { he: input.name, en: input.name };
  if (input.ownerName !== undefined) updates.ownerName = input.ownerName;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.category !== undefined) updates.category = input.category;
  if (input.city !== undefined) updates.city = { he: input.city, en: input.city };
  if (input.description !== undefined) {
    updates.description = { he: input.description, en: input.description };
  }
  if (input.website !== undefined) {
    updates.website = input.website.trim() ? input.website.trim() : null;
  }
  if (input.tags !== undefined) updates.tags = { he: input.tags, en: input.tags };
  if (input.status !== undefined) {
    updates.status = input.status;
    // Keep the legacy boolean in sync with the status enum (seed + public GET
    // both carry it).
    updates.approved = input.status === 'approved';
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: 'no_fields' });
    return;
  }

  try {
    const ref = db().collection('businesses').doc(req.params.id);
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });

    await writeAuditLog({
      actorId,
      action: 'directory_update',
      entityType: 'businesses',
      entityId: req.params.id,
      details: { fields: Object.keys(updates) },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminDirectory] PATCH /businesses/:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// DELETE /api/admin/directory/businesses/:id — hard delete.
router.delete('/businesses/:id', async (req: Request, res: Response): Promise<void> => {
  const actorId = req.user!.uid;

  try {
    const ref = db().collection('businesses').doc(req.params.id);
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    await ref.delete();

    await writeAuditLog({
      actorId,
      action: 'directory_delete',
      entityType: 'businesses',
      entityId: req.params.id,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminDirectory] DELETE /businesses/:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
