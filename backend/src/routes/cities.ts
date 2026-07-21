/**
 * /api/cities — public read of the Israeli locality list.
 *
 * Backs every city picker in the app (request form, volunteer registration,
 * business/directory registration, admin directory). Serving this from the
 * server rather than letting each client call data.gov.il keeps the payload
 * normalised in one place, avoids a cross-origin dependency in the browser,
 * and means an outage upstream degrades to the committed snapshot instead of
 * an empty dropdown. See `@/lib/cities` for the caching contract.
 */
import { Router, type Request, type Response } from 'express';

import { getCities } from '@/lib/cities';

const router = Router();

// GET /api/cities — public, no auth. Returns { items: [{ code, nameHe, nameEn }] },
// Hebrew-sorted. The list is a fixed reference table, so it is safe to cache hard
// at the CDN/browser; clients key on `code`, never on the display name.
router.get('/', (_req: Request, res: Response) => {
  try {
    const items = getCities();
    res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    res.json({ items });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[cities.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
