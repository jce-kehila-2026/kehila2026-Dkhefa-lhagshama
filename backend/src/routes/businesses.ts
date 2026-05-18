import { FieldValue } from 'firebase-admin/firestore';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { db } from '@/lib/firebaseAdmin';
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
        name: data.name,
        ownerName: data.ownerName,
        phone: data.phone,
        category: data.category,
        city: data.city,
        description: data.description,
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

router.post('/', async (req: Request, res: Response) => {
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
    const docRef = await db().collection('businesses').add({
      ...input,
      approved: false,
      status: 'pending',
      featured: false,
      rating: 0,
      reviews: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    writeAuditLog({
      actorId: 'anonymous',
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
