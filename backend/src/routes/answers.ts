import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';

const router = Router();

const querySchema = z.object({
  category: z.string().trim().min(1).max(80).optional(),
  region: z.string().trim().min(1).max(80).optional(),
  audience: z.string().trim().min(1).max(80).optional(),
});

router.get('/', async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { category, region, audience } = parsed.data;

  try {
    let query = db()
      .collection('answers')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc');

    if (category) query = query.where('category', '==', category);
    if (region) query = query.where('region', '==', region);
    if (audience) query = query.where('audience', '==', audience);

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title ?? null,
        body: data.body ?? null,
        category: data.category ?? null,
        region: data.region ?? null,
        audience: data.audience ?? null,
        sourceName: data.sourceName ?? null,
        sourceUrl: data.sourceUrl ?? null,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    res.json({ items });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[answers.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
