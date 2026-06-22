/**
 * GET /api/admin/requests/:id/candidates — ranked volunteer-matching (WS-6).
 *
 * Extracted verbatim from the original single-file router.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { scoreVolunteers, type MatchVolunteer } from '@/lib/matchVolunteers';

// ── GET /api/admin/requests/:id/candidates ────────────────────────────────
// Ranked volunteer-matching surface (WS-6). Loads the active roster + the
// request, computes each volunteer's open assigned-load from one full request
// scan (mirrors the in-memory architecture used elsewhere in this file), then
// runs the transparent scorer. Admin-gated by the router-level requireRole.
const OPEN_LOAD_STATUSES = new Set(['pending', 'in_progress', 'awaiting_review']);

export async function listCandidates(req: Request, res: Response): Promise<void> {
  try {
    const reqSnap = await db().collection('requests').doc(req.params.id).get();
    if (!reqSnap.exists) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const reqData = reqSnap.data()!;

    const [volSnap, allReqSnap, ratingsSnap] = await Promise.all([
      db().collection('volunteers').where('active', '==', true).limit(200).get(),
      db().collection('requests').get(),
      db().collection('ratings').get(),
    ]);

    // Open-load per volunteer + a requestId→category index (the latter joins the
    // ratings, whose doc id IS the requestId, back to a category).
    const loadByUid = new Map<string, number>();
    const reqCategoryById = new Map<string, string>();
    for (const d of allReqSnap.docs) {
      const dd = d.data();
      reqCategoryById.set(d.id, String(dd.category ?? '').trim().toLowerCase());
      const uid = dd.assignedVolunteerId as string | undefined;
      if (uid && OPEN_LOAD_STATUSES.has(dd.status as string)) {
        loadByUid.set(uid, (loadByUid.get(uid) ?? 0) + 1);
      }
    }

    // Category-specific rating aggregate per volunteer: average stars across the
    // volunteer's ratings whose request shares THIS request's category. Purely a
    // rule-based "track record on this kind of work" signal — no AI.
    const cat = String(reqData.category ?? '').trim().toLowerCase();
    const ratingAgg = new Map<string, { sum: number; count: number }>();
    if (cat) {
      for (const r of ratingsSnap.docs) {
        const rd = r.data();
        const vId = rd.volunteerId as string | undefined;
        const stars = typeof rd.stars === 'number' ? rd.stars : null;
        if (!vId || stars === null) continue;
        if (reqCategoryById.get(r.id) !== cat) continue; // rating doc id === requestId
        const agg = ratingAgg.get(vId) ?? { sum: 0, count: 0 };
        agg.sum += stars;
        agg.count += 1;
        ratingAgg.set(vId, agg);
      }
    }

    const volunteers: MatchVolunteer[] = volSnap.docs.map((d) => {
      const v = d.data();
      const agg = ratingAgg.get(d.id);
      return {
        uid: d.id,
        name: (v.fullName as string | undefined) || (v.name as string | undefined) || d.id,
        languages: (v.languages as string[] | undefined) ?? [],
        areas: (v.areas as string[] | undefined) ?? [],
        approvedCategories: (v.approvedCategories as string[] | undefined) ?? [],
        workStatus: (v.workStatus as string | undefined) ?? 'free',
        openLoad: loadByUid.get(d.id) ?? 0,
        availabilityWindows:
          (v.availabilityWindows as MatchVolunteer['availabilityWindows'] | undefined) ?? [],
        city: (v.city as string | undefined) ?? null,
        avgRating: agg && agg.count > 0 ? agg.sum / agg.count : null,
        ratingCount: agg?.count ?? 0,
      };
    });

    const ranked = scoreVolunteers(
      {
        category: (reqData.category as string | undefined) ?? null,
        preferredLanguage:
          (reqData.preferredLanguage as 'he' | 'am' | 'en' | null | undefined) ?? null,
        deadline: (reqData.deadline as string | null | undefined) ?? null,
        urgency: (reqData.urgency as 'low' | 'medium' | 'high' | null | undefined) ?? null,
        city: (reqData.city as string | undefined) ?? null,
      },
      volunteers,
    );

    // Mark which candidates already claimed this pooled request (req 22) so the
    // UI can merge them into the ranking instead of showing a separate list.
    const claimedUids = new Set(
      ((reqData.claims as Array<{ volunteerId?: string }> | undefined) ?? [])
        .map((c) => c.volunteerId)
        .filter(Boolean) as string[],
    );

    const candidates = ranked.map((c) => ({
      uid: c.uid,
      name: c.name,
      score: c.score,
      matchPercent: c.matchPercent,
      reasons: c.reasons,
      workStatus: c.workStatus,
      openLoad: c.openLoad,
      languages: c.languages,
      city: c.city ?? null,
      avgRating: c.avgRating ?? null,
      ratingCount: c.ratingCount ?? 0,
      hasClaimed: claimedUids.has(c.uid),
    }));

    res.json({ candidates });
  } catch (err) {
    console.error('[adminRequests] GET /:id/candidates:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}
