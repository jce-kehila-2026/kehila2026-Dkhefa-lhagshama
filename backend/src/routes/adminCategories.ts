/**
 * /api/admin/categories — admin-managed category taxonomy (feedback round 2).
 *
 * Endpoints:
 *   GET    /api/admin/categories     — all categories, archived included
 *   POST   /api/admin/categories     — create { nameHe, nameEn, id? }
 *   PATCH  /api/admin/categories/:id — edit labels / archived flag
 *   DELETE /api/admin/categories/:id — hard delete (only when unused)
 *
 * Doc ids are slugs (a-z0-9-). POST derives the id from nameEn when omitted;
 * an id collision is a 409 `category_exists` (never silently overwritten).
 *
 * Deleting is blocked with 409 `category_in_use` while any request or answer
 * still references the id — soft-archive instead (`archived: true` hides the
 * category from pickers but keeps label resolution for historical docs).
 *
 * Every mutation writes an audit log entry and invalidates the in-memory
 * categories cache so validators see the change immediately.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';
import { writeAuditLog } from '@/lib/audit';
import { invalidate as invalidateCategoriesCache } from '@/lib/categoriesCache';

const router = Router();

// All routes require a verified admin token
router.use(authenticate, requireRole('admin'));

const SLUG_RE = /^[a-z0-9-]+$/;

/** Slugify an English label: lowercase, a-z0-9- only, trim stray dashes. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── GET /api/admin/categories ───────────────────────────────────────────────
// Everything, archived included, so the admin screen can manage the full set.
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db().collection('categories').get();
    const items = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nameHe: (data.nameHe as string | undefined) ?? d.id,
          nameEn: (data.nameEn as string | undefined) ?? d.id,
          archived: data.archived === true,
        };
      })
      .sort((a, b) => a.nameHe.localeCompare(b.nameHe, 'he'));

    res.json({ items });
  } catch (err) {
    console.error('[adminCategories] GET /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── POST /api/admin/categories ──────────────────────────────────────────────
const createSchema = z.object({
  nameHe: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  // Optional explicit slug id; defaults to slugify(nameEn).
  id: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(SLUG_RE, 'id must be a lowercase slug (a-z, 0-9, dashes)')
    .optional(),
});

router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const { nameHe, nameEn } = parsed.data;
  const id = parsed.data.id ?? slugify(nameEn);
  if (!id) {
    // nameEn was all non-latin characters (e.g. Hebrew-only) — the caller must
    // supply an explicit slug id in that case.
    res.status(400).json({
      error: 'invalid_input',
      details: { id: 'could not derive a slug from nameEn; provide an explicit id' },
    });
    return;
  }
  const actorId = req.user!.uid;

  try {
    // `create()` throws ALREADY_EXISTS (gRPC code 6) if the slug is taken.
    await db().collection('categories').doc(id).create({
      nameHe,
      nameEn,
      archived: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    invalidateCategoriesCache();

    await writeAuditLog({
      actorId,
      action: 'category.create',
      entityType: 'categories',
      entityId: id,
      details: { nameHe, nameEn },
    });

    res.status(201).json({ id, nameHe, nameEn, archived: false });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 6) {
      res.status(409).json({ error: 'category_exists' });
      return;
    }
    console.error('[adminCategories] POST /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── PATCH /api/admin/categories/:id ─────────────────────────────────────────
// Edit labels and/or the soft-archive flag. At least one field required.
const patchSchema = z
  .object({
    nameHe: z.string().trim().min(1).max(80).optional(),
    nameEn: z.string().trim().min(1).max(80).optional(),
    archived: z.boolean().optional(),
  })
  .refine(
    (d) => d.nameHe !== undefined || d.nameEn !== undefined || d.archived !== undefined,
    { message: 'nameHe, nameEn or archived is required' },
  );

router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }
  const id = req.params.id;
  const actorId = req.user!.uid;

  try {
    const ref = db().collection('categories').doc(id);
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
    if (parsed.data.nameHe !== undefined) update.nameHe = parsed.data.nameHe;
    if (parsed.data.nameEn !== undefined) update.nameEn = parsed.data.nameEn;
    if (parsed.data.archived !== undefined) update.archived = parsed.data.archived;
    await ref.update(update);

    invalidateCategoriesCache();

    await writeAuditLog({
      actorId,
      action: 'category.update',
      entityType: 'categories',
      entityId: id,
      details: {
        nameHe: parsed.data.nameHe ?? null,
        nameEn: parsed.data.nameEn ?? null,
        archived: parsed.data.archived ?? null,
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminCategories] PATCH /:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

// ── DELETE /api/admin/categories/:id ────────────────────────────────────────
// Hard delete, allowed only when nothing references the id. Usage is checked
// with two single-field equality queries (limit 1) — no composite index.
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const id = req.params.id;
  const actorId = req.user!.uid;

  try {
    const ref = db().collection('categories').doc(id);
    if (!(await ref.get()).exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    const [requestUse, answerUse] = await Promise.all([
      db().collection('requests').where('category', '==', id).limit(1).get(),
      db().collection('answers').where('category', '==', id).limit(1).get(),
    ]);
    if (!requestUse.empty || !answerUse.empty) {
      // Deleting would orphan labels on historical docs — archive instead.
      res.status(409).json({ error: 'category_in_use' });
      return;
    }

    await ref.delete();

    invalidateCategoriesCache();

    await writeAuditLog({
      actorId,
      action: 'category.delete',
      entityType: 'categories',
      entityId: id,
      details: {},
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[adminCategories] DELETE /:id:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
