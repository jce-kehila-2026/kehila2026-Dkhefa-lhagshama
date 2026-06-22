/**
 * Scalar admin-insights KPIs (WS-10).
 *
 * Pure, deterministic aggregation over the already-loaded `requests` scan plus
 * the per-request closed-at timestamps the insights route derives from
 * `requestEvents`. `now` is injected so the "this month" window is testable,
 * mirroring `requestSort.ts`.
 *
 * Returned shape feeds the InsightsData.kpis payload consumed by the admin
 * insights KPI strip.
 */

/** Statuses that mean the request is no longer open work. */
const TERMINAL_STATUSES = new Set(['closed', 'referred', 'rejected']);

export interface KpiRequest {
  id: string;
  status?: string | null;
}

export interface ScalarKpis {
  totalRequests: number;
  openRequests: number;
  closedThisMonth: number;
  /** Integer percent (closed / total), or null when there are no requests. */
  closureRate: number | null;
}

/** True when `at` falls in the same calendar month/year as `now`. */
function isSameMonth(at: Date, now: number): boolean {
  const ref = new Date(now);
  return at.getFullYear() === ref.getFullYear() && at.getMonth() === ref.getMonth();
}

// derive the four scalar KPIs in one pass over `requests`. `closedAtById` only
// needs entries for closed requests; `now` defaults to wall-clock but is
// injectable so the "this month" window is deterministic in tests.
export function computeScalarKpis(
  requests: KpiRequest[],
  closedAtById: Map<string, Date>,
  now: number = Date.now(),
): ScalarKpis {
  const totalRequests = requests.length;

  // open = anything not terminal; closedCount feeds the lifetime closure rate.
  let openRequests = 0;
  let closedCount = 0;
  for (const r of requests) {
    const status = r.status ?? '';
    if (!TERMINAL_STATUSES.has(status)) openRequests += 1;
    if (status === 'closed') closedCount += 1;
  }

  // closed-this-month is a stricter subset: needs a closed-at timestamp that
  // lands in the current calendar month (referred/rejected are not counted).
  let closedThisMonth = 0;
  for (const r of requests) {
    if (r.status !== 'closed') continue;
    const at = closedAtById.get(r.id);
    if (at && isSameMonth(at, now)) closedThisMonth += 1;
  }

  const closureRate =
    totalRequests > 0 ? Math.round((closedCount / totalRequests) * 100) : null;

  return { totalRequests, openRequests, closedThisMonth, closureRate };
}
