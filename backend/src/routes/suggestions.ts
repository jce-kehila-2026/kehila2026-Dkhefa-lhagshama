/**
 * /api/suggestions — UC-01 A1 "suggest alternatives" (simple If-Then, NO AI).
 *
 * After a beneficiary submits a request, the client surfaces up to 3 approved
 * community answers in the SAME category. Public read (no authenticate),
 * mirrors the answers.ts item shape so the UI can reuse the same renderer.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';

const router = Router();

// required `?category=<enum key>` query param; bounded to keep the firestore
// equality filter cheap.
const querySchema = z.object({
  category: z.string().trim().min(1).max(80),
});

// GET /api/suggestions?category= — public read; validates `category`, returns
// up to 3 approved same-category answers as `{ items }` (answers.ts shape).
router.get('/', async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { category } = parsed.data;

  try {
    // `category` is an enum key (not translated), so an equality filter is safe.
    const snapshot = await db()
      .collection('answers')
      .where('status', '==', 'approved')
      .where('category', '==', category)
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        // Translatable fields pass through as the bilingual `{ he, en }` contract;
        // the UI renders the active language. `category` stays an enum key.
        title: data.title ?? null,
        body: data.body ?? null,
        category: data.category ?? null,
        region: data.region ?? null,
        audience: data.audience ?? null,
        // Optional contact fields (NPO org import) — same shape as answers.ts.
        phone: data.phone ?? null,
        email: data.email ?? null,
        sourceName: data.sourceName ?? null,
        sourceUrl: data.sourceUrl ?? null,
        // Org type: 'partner' (שותף) vs 'ngo' (עמותה) — same one-liner as
        // answers.ts. Lets the suggest-card directory fallback target the
        // correct tab (pre-field docs count as 'ngo').
        orgType: data.orgType === 'partner' ? 'partner' : 'ngo',
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    res.json({ items });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[suggestions.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
