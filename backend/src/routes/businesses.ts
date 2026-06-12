import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
import { authenticate } from '@/middleware/auth';
import { writeAuditLog } from '@/lib/audit';

const router = Router();

const businessCategorySchema = z.enum(['food', 'services', 'health', 'education', 'beauty', 'tech']);

const createBusinessSchema = z.object({
  name: z.string().trim().min(1).max(120),
  ownerName: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(1).max(40),
  category: businessCategorySchema,
  city: z.string().trim().min(1).max(80),
  description: z.string().trim().min(10).max(1200),
  // Optional public website for the business; validated as a URL when present.
  // Scheme is restricted to http(s) — zod's .url() alone accepts javascript:
  // URLs, which would become a stored link-injection on the public directory.
  // An empty/blank string is treated as "not provided" so the form can send "".
  website: z
    .string()
    .trim()
    .max(2000)
    .url()
    .refine((value) => /^https?:\/\//i.test(value), { message: 'invalid_url_scheme' })
    .optional()
    .or(z.literal('')),
});

type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

router.get('/', async (_req: Request, res: Response) => {
  try {
    const snapshot = await db()
      .collection('businesses')
      .where('status', '==', 'approved')
      .orderBy('createdAt', 'desc')
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        // Translatable fields (`name`/`city`/`description`/`tags`) pass through as
        // the bilingual `{ he, en }` contract (tags as `{ he: [], en: [] }`); the
        // UI renders the active language. `category` stays an enum key.
        name: data.name ?? null,
        ownerName: data.ownerName ?? null,
        phone: data.phone ?? null,
        category: data.category ?? null,
        city: data.city ?? null,
        description: data.description ?? null,
        tags: data.tags ?? { he: [], en: [] },
        // Optional public website (URL string), null when not set. `category`
        // stays an enum key.
        website: data.website ?? null,
        approved: data.approved ?? false,
        featured: data.featured ?? false,
        rating: data.rating ?? 0,
        reviews: data.reviews ?? 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    res.json({ items });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[businesses.get] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/businesses — submit a new business for admin approval.
// Server-only write (Firestore rules forbid client `create` on /businesses).
// authenticate-gated: the signed-in user becomes the business `ownerId`, which
// the firestore.rules `update` rule later keys off so the owner can edit their
// own pending submission.
router.post('/', authenticate, async (req: Request, res: Response) => {
  const ownerId = req.user?.uid;
  if (!ownerId) {
    res.status(401).json({ error: 'not_authenticated' });
    return;
  }

  const parsed = createBusinessSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'validation',
      fieldErrors: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const input: CreateBusinessInput = parsed.data;

  try {
    // User-submitted businesses arrive as flat strings. Store the translatable
    // fields under the bilingual `{ he, en }` contract so they match the seeded
    // shape and the directory renderer. We don't have a translation at submit
    // time, so the same submitted string is stored in both `he` and `en` (the
    // owner/admin can refine the second language later). `tags` starts empty.
    // `website` is a single URL (not translatable). Only persist it when the
    // owner actually supplied one — an empty string means "not provided".
    const website = input.website?.trim() ? input.website.trim() : null;

    const docRef = await db().collection('businesses').add({
      name: { he: input.name, en: input.name },
      ownerName: input.ownerName,
      phone: input.phone,
      category: input.category,
      city: { he: input.city, en: input.city },
      description: { he: input.description, en: input.description },
      website,
      tags: { he: [], en: [] },
      ownerId,
      approved: false,
      status: 'pending',
      featured: false,
      rating: 0,
      reviews: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    writeAuditLog({
      actorId: ownerId,
      action: 'business.submit',
      entityType: 'businesses',
      entityId: docRef.id,
      details: {
        name: input.name,
        category: input.category,
        city: input.city,
      },
    }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[businesses.post] audit write failed:', err);
    });

    res.status(201).json({ businessId: docRef.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[businesses.post] failed:', err);
    res.status(500).json({ error: 'internal' });
  }
});

export default router;
