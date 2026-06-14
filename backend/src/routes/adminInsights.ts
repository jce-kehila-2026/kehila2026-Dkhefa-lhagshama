/**
 * /api/admin/insights — Admin analytics aggregation (Note 7).
 *
 * Computes the InsightsData payload on request from `requests` + `requestEvents`
 * (the per-transition timestamp trail). Replaces the dead mock charts in the
 * admin dashboard. Admin-only.
 *
 *   GET /api/admin/insights
 *     {
 *       overTime:    [{ date: 'YYYY-MM-DD', count }],   // requests created/day
 *       byCategory:  [{ category, count }],
 *       byStatus:    [{ status, count }],               // current status
 *       avgResolutionDays: number | null,               // mean created→closed
 *       perVolunteer: [{ uid, name, count }]            // assigned-request load
 *     }
 *
 * Archived requests ARE included (Note 6: archived counts toward stats).
 */
import { Router, type Request, type Response } from 'express';

import { db } from '@/lib/firebaseAdmin';
import { authenticate, requireRole } from '@/middleware/auth';
import { computeScalarKpis, type KpiRequest } from '@/lib/insightsKpis';

const router = Router();
router.use(authenticate, requireRole('admin'));

interface RequestDoc {
  category?: string;
  status?: string;
  assignedVolunteerId?: string | null;
  handler?: string | null;
  age?: number | null; // beneficiary age captured at submit (req 24)
  createdAt?: { toDate?: () => Date };
}

// Age buckets for the insights breakdown (req 24). Order matters for display.
const AGE_BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '0-17', min: 0, max: 17 },
  { label: '18-25', min: 18, max: 25 },
  { label: '26-40', min: 26, max: 40 },
  { label: '41-60', min: 41, max: 60 },
  { label: '60+', min: 61, max: Infinity },
];

// Accept only sane ages; ignore null/0/out-of-range values (req 24).
const MIN_VALID_AGE = 1;
const MAX_VALID_AGE = 120;

function toDate(ts: { toDate?: () => Date } | undefined | null): Date | null {
  const d = ts?.toDate?.();
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── GET /api/admin/insights ───────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    // 1) All requests — small NGO dataset, a single read is fine.
    const reqSnap = await db().collection('requests').get();

    const overTimeMap = new Map<string, number>();
    const byCategoryMap = new Map<string, number>();
    const byStatusMap = new Map<string, number>();
    const perVolunteerMap = new Map<string, number>();
    const createdAtById = new Map<string, Date>();
    const validAges: number[] = []; // beneficiary ages for ageStats (req 24)
    const kpiRequests: KpiRequest[] = []; // WS-10 scalar KPIs over the same scan

    for (const doc of reqSnap.docs) {
      const data = doc.data() as RequestDoc;
      kpiRequests.push({ id: doc.id, status: data.status });

      // Age insights (req 24): only count finite, in-range ages.
      const age = typeof data.age === 'number' ? data.age : null;
      if (age !== null && Number.isFinite(age) && age >= MIN_VALID_AGE && age <= MAX_VALID_AGE) {
        validAges.push(age);
      }

      const created = toDate(data.createdAt);
      if (created) {
        const key = dayKey(created);
        overTimeMap.set(key, (overTimeMap.get(key) ?? 0) + 1);
        createdAtById.set(doc.id, created);
      }

      if (data.category) {
        byCategoryMap.set(data.category, (byCategoryMap.get(data.category) ?? 0) + 1);
      }

      if (data.status) {
        byStatusMap.set(data.status, (byStatusMap.get(data.status) ?? 0) + 1);
      }

      const vol = data.assignedVolunteerId ?? data.handler ?? null;
      if (vol) {
        perVolunteerMap.set(vol, (perVolunteerMap.get(vol) ?? 0) + 1);
      }
    }

    // 2) avgResolutionDays — mean (closed_at − created_at) over requests that
    //    have a status_changed → closed event. Derived from requestEvents.
    const eventsSnap = await db()
      .collection('requestEvents')
      .where('type', '==', 'status_changed')
      .get();

    // For each request, the earliest event whose details.to === 'closed'.
    const closedAtById = new Map<string, Date>();
    for (const e of eventsSnap.docs) {
      const ev = e.data() as {
        requestId?: string;
        details?: { to?: string };
        createdAt?: { toDate?: () => Date };
      };
      if (ev.details?.to !== 'closed' || !ev.requestId) continue;
      const at = toDate(ev.createdAt);
      if (!at) continue;
      const existing = closedAtById.get(ev.requestId);
      if (!existing || at < existing) {
        closedAtById.set(ev.requestId, at);
      }
    }

    // WS-10 — scalar KPI strip values, derived from the same request scan and
    // the closed-at timestamps already resolved from requestEvents above.
    const kpis = computeScalarKpis(kpiRequests, closedAtById, Date.now());

    const durationsDays: number[] = [];
    for (const [id, closedAt] of closedAtById) {
      const created = createdAtById.get(id);
      if (!created) continue;
      const ms = closedAt.getTime() - created.getTime();
      if (ms >= 0) durationsDays.push(ms / (1000 * 60 * 60 * 24));
    }
    const avgResolutionDays =
      durationsDays.length > 0
        ? Number(
            (durationsDays.reduce((a, b) => a + b, 0) / durationsDays.length).toFixed(1),
          )
        : null;

    // 3) Resolve volunteer display names from the `volunteers` collection
    //    (best-effort; falls back to the uid).
    const volunteerIds = [...perVolunteerMap.keys()];
    const nameByUid = new Map<string, string>();
    await Promise.all(
      volunteerIds.map(async (uid) => {
        try {
          const vSnap = await db().collection('volunteers').doc(uid).get();
          const v = vSnap.exists ? (vSnap.data() as { name?: string; fullName?: string }) : null;
          nameByUid.set(uid, v?.name ?? v?.fullName ?? uid);
        } catch {
          nameByUid.set(uid, uid);
        }
      }),
    );

    const overTime = [...overTimeMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const byCategory = [...byCategoryMap.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const byStatus = [...byStatusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const perVolunteer = [...perVolunteerMap.entries()]
      .map(([uid, count]) => ({ uid, name: nameByUid.get(uid) ?? uid, count }))
      .sort((a, b) => b.count - a.count);

    // 4) ageStats (req 24): average age + fixed-range buckets over valid ages.
    const averageAge =
      validAges.length > 0
        ? Number((validAges.reduce((a, b) => a + b, 0) / validAges.length).toFixed(1))
        : null;
    const ageBuckets = AGE_BUCKETS.map((b) => ({
      label: b.label,
      count: validAges.filter((a) => a >= b.min && a <= b.max).length,
    }));
    const ageStats = { averageAge, buckets: ageBuckets };

    res.json({ overTime, byCategory, byStatus, avgResolutionDays, perVolunteer, ageStats, kpis });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[adminInsights] GET /:', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

export default router;
