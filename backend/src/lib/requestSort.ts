/**
 * Canonical request prioritization (req 19).
 *
 * Volunteer-facing lists (the available pool and a volunteer's assigned list)
 * are ordered top→bottom by:
 *   1. urgency           — high → medium → low
 *   2. deadline pressure — least time left to the deadline first (no deadline last)
 *   3. previously taken  — requests a volunteer dropped earlier float up
 *
 * This is the single source of truth — clients receive the order server-side
 * (e.g. GET /api/admin/requests?sort=priority); there is no frontend copy.
 */

export const URGENCY_RANK: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export interface SortableRequest {
  urgency?: string | null;
  /** ISO date string or null. */
  deadline?: string | null;
  wasPreviouslyTaken?: boolean;
}

/** Lower urgency rank = more urgent. Unknown urgency sorts after low. */
function urgencyRank(u?: string | null): number {
  if (u && u in URGENCY_RANK) return URGENCY_RANK[u];
  return 3;
}

/** Milliseconds until the deadline; requests without a deadline sort last. */
function deadlineMs(deadline: string | null | undefined, now: number): number {
  if (!deadline) return Number.POSITIVE_INFINITY;
  const t = Date.parse(deadline);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t - now;
}

/**
 * Comparator for {@link Array.prototype.sort}. `now` is injected so the order is
 * deterministic/testable (default: current time).
 */
export function compareRequestPriority(
  a: SortableRequest,
  b: SortableRequest,
  now: number = Date.now(),
): number {
  // 1. urgency (high first)
  const ua = urgencyRank(a.urgency);
  const ub = urgencyRank(b.urgency);
  if (ua !== ub) return ua - ub;

  // 2. least time left to deadline first (no-deadline last)
  const da = deadlineMs(a.deadline, now);
  const db = deadlineMs(b.deadline, now);
  if (da !== db) return da - db;

  // 3. tie-break: a request this volunteer took before (then dropped) floats
  //    above one they never touched, so it resurfaces near the top of the pool
  const pa = a.wasPreviouslyTaken ? 0 : 1;
  const pb = b.wasPreviouslyTaken ? 0 : 1;
  return pa - pb;
}

/** Returns a new array sorted by {@link compareRequestPriority}. */
export function sortByPriority<T extends SortableRequest>(
  items: T[],
  now: number = Date.now(),
): T[] {
  return [...items].sort((a, b) => compareRequestPriority(a, b, now));
}
