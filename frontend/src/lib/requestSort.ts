/**
 * Canonical request prioritization (req 19) — frontend mirror of
 * `backend/src/lib/requestSort.ts`. Keep the two in sync.
 *
 * Order, top→bottom:
 *   1. urgency           — high → medium → low
 *   2. deadline pressure — least time left first (no deadline last)
 *   3. previously taken  — dropped-then-returned requests float up
 */

export const URGENCY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

export interface SortableRequest {
  urgency?: string | null;
  deadline?: string | null;
  wasPreviouslyTaken?: boolean;
}

function urgencyRank(u?: string | null): number {
  if (u && u in URGENCY_RANK) return URGENCY_RANK[u];
  return 3;
}

function deadlineMs(deadline: string | null | undefined, now: number): number {
  if (!deadline) return Number.POSITIVE_INFINITY;
  const t = Date.parse(deadline);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t - now;
}

export function compareRequestPriority(
  a: SortableRequest,
  b: SortableRequest,
  now: number = Date.now(),
): number {
  const ua = urgencyRank(a.urgency);
  const ub = urgencyRank(b.urgency);
  if (ua !== ub) return ua - ub;

  const da = deadlineMs(a.deadline, now);
  const db = deadlineMs(b.deadline, now);
  if (da !== db) return da - db;

  const pa = a.wasPreviouslyTaken ? 0 : 1;
  const pb = b.wasPreviouslyTaken ? 0 : 1;
  return pa - pb;
}

export function sortByPriority<T extends SortableRequest>(
  items: T[],
  now: number = Date.now(),
): T[] {
  return [...items].sort((a, b) => compareRequestPriority(a, b, now));
}
