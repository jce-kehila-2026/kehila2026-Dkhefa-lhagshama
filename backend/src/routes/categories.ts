/**
 * /api/categories — public read of the request-category taxonomy.
 *
 * Categories are admin-managed Firestore docs (collection `categories`) keyed
 * by slug id with bilingual labels { nameHe, nameEn } — the same per-document
 * bilingual field contract the answers catalog uses. Labels NEVER come from
 * translations.ts; the client renders nameHe/nameEn per active language.
 *
 * Only non-archived categories are returned: a soft-archived category is
 * hidden from pickers but its label stays resolvable for old data (the admin
 * router GET includes archived entries for that).
 */
import { Router, type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    const snap = await db().collection('categories').get();
    const items = snap.docs
      // `archived` is filtered IN MEMORY (not `.where()`): seeded docs created
      // before the flag existed lack the field, and skipping the extra
      // `.where()` keeps the single-field-query / no-new-index convention.
      .filter((d) => d.data().archived !== true)
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nameHe: (data.nameHe as string | undefined) ?? d.id,
          nameEn: (data.nameEn as string | undefined) ?? d.id,
        };
      })
      // Hebrew-label sort — the primary demo audience is Hebrew-speaking.
      .sort((a, b) => a.nameHe.localeCompare(b.nameHe, 'he'));

    res.json({ items });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[categories.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
