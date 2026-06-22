/**
 * Volunteer self-insights handler for the Volunteer Hub insights page.
 *
 * Backs GET /api/volunteer/insights (req 14b): aggregates the authenticated
 * volunteer's own assigned requests (archived included) into chart-ready
 * series. Read-only; every field defaults sensibly so missing/legacy data
 * never throws. Collaborates with resolveRange (parses the ?range query into a
 * [sinceMs, untilMs] window) and the requestEvents collection (refines close
 * timestamps for the avg-resolution metric). Caller identity comes from the
 * auth middleware via req.user.uid. Extracted verbatim from the original
 * single-file router; mounted by the volunteerApp router with auth applied.
 */
import { type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { resolveRange } from '@/lib/insightsRange';

import { toIso } from './shared';

// GET /api/volunteer/insights — scopes to assignedVolunteerId == caller, applies
// the time window from ?range, and responds:
//   { overTime: [{date,count}], byCategory: [{category,count}],
//     byStatus: [{status,count}], avgResolutionDays: number|null, currentLoad: number }
// 500 { error: 'internal_error' } on unexpected failure.
export async function getInsights(req: Request, res: Response): Promise<void> {
  const uid = req.user!.uid;
  const { sinceMs, untilMs } = resolveRange(req.query, Date.now());
  try {
    const snap = await db()
      .collection('requests')
      .where('assignedVolunteerId', '==', uid)
      .get();

    const overTimeMap = new Map<string, number>();
    const byCategoryMap = new Map<string, number>();
    const byStatusMap = new Map<string, number>();
    let currentLoad = 0;

    // For avg resolution we collect created→closed spans. We prefer the closing
    // event's timestamp (status_changed → closed) but fall back to updatedAt.
    const closedSpansDays: number[] = [];
    const closedRequestIds: Array<{ id: string; createdAtMs: number | null; updatedAtMs: number | null }> = [];

    for (const d of snap.docs) {
      const data = d.data();

      // overTime by createdAt day (YYYY-MM-DD)
      const createdIso = toIso(data.createdAt);
      // Time-range scope: skip requests outside [sinceMs, untilMs].
      const cms = createdIso ? Date.parse(createdIso) : null;
      if (sinceMs !== null && (cms === null || cms < sinceMs)) continue;
      if (untilMs !== null && (cms === null || cms > untilMs)) continue;
      if (createdIso) {
        const day = createdIso.slice(0, 10);
        overTimeMap.set(day, (overTimeMap.get(day) ?? 0) + 1);
      }

      // byCategory
      const cat = (data.category as string | undefined) ?? 'uncategorized';
      byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + 1);

      // byStatus
      const status = (data.status as string | undefined) ?? 'unknown';
      byStatusMap.set(status, (byStatusMap.get(status) ?? 0) + 1);

      // currentLoad — in_progress assigned to me
      if (status === 'in_progress') currentLoad += 1;

      // candidate for avg resolution if it's closed
      if (status === 'closed') {
        const createdAtMs = createdIso ? Date.parse(createdIso) : null;
        const updatedIso = toIso(data.updatedAt);
        const updatedAtMs = updatedIso ? Date.parse(updatedIso) : null;
        closedRequestIds.push({ id: d.id, createdAtMs, updatedAtMs });
      }
    }

    // Try to refine close timestamps from requestEvents (status_changed→closed).
    // Single-field equality query per request keeps us index-free; the closed
    // set is small. Failures degrade gracefully to updatedAt.
    for (const c of closedRequestIds) {
      let closedAtMs: number | null = null;
      try {
        const evSnap = await db()
          .collection('requestEvents')
          .where('requestId', '==', c.id)
          .get();
        for (const e of evSnap.docs) {
          const ev = e.data();
          if (ev.type === 'status_changed' && ev.details?.to === 'closed') {
            const evIso = toIso(ev.createdAt);
            const evMs = evIso ? Date.parse(evIso) : null;
            // keep the latest close event (a request may be reopened/reclosed)
            if (evMs !== null) closedAtMs = closedAtMs === null ? evMs : Math.max(closedAtMs, evMs);
          }
        }
      } catch {
        // ignore — fall back to updatedAt below
      }
      const endMs = closedAtMs ?? c.updatedAtMs;
      if (c.createdAtMs !== null && endMs !== null && endMs >= c.createdAtMs) {
        closedSpansDays.push((endMs - c.createdAtMs) / (1000 * 60 * 60 * 24));
      }
    }

    const avgResolutionDays =
      closedSpansDays.length > 0
        ? closedSpansDays.reduce((a, b) => a + b, 0) / closedSpansDays.length
        : null;

    const overTime = [...overTimeMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const byCategory = [...byCategoryMap.entries()].map(([category, count]) => ({ category, count }));
    const byStatus = [...byStatusMap.entries()].map(([status, count]) => ({ status, count }));

    res.json({ overTime, byCategory, byStatus, avgResolutionDays, currentLoad });
  } catch (err) {
    console.error('[volunteer] GET /insights:', err);
    res.status(500).json({ error: 'internal_error' });
  }
}
