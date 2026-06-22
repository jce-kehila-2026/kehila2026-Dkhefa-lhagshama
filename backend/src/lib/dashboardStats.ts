/**
 * Pure helpers for the admin dashboard stats route (WS-4). No Firestore access
 * here — the route supplies already-fetched counts. Mirrors requestSort.ts:
 * pure, deterministic, unit-tested.
 */

/** Pre-fetched request counts the route hands in; both optional so a missing
 *  Firestore aggregate degrades to 0 rather than NaN. */
export interface RawCounts {
  closedRequests?: number;
  referredRequests?: number;
}

/** "Helped" = requests brought to a positive close + those referred out. */
export function helpedCount(c: RawCounts): number {
  return (c.closedRequests ?? 0) + (c.referredRequests ?? 0);
}

/**
 * The UTC instant of the most recent local midnight, given `now` and the
 * timezone offset in minutes as returned by Date.prototype.getTimezoneOffset()
 * (i.e. minutes to ADD to local to get UTC; +03:00 yields -180). Used to count
 * "today's new requests" against a local-day boundary.
 */
export function localMidnightUtc(now: Date, offsetMinutes: number): Date {
  // Shift to local wall-clock, zero the time-of-day, shift back to UTC.
  const localMs = now.getTime() - offsetMinutes * 60_000;
  const local = new Date(localMs);
  const localMidnightMs = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    0, 0, 0, 0,
  );
  return new Date(localMidnightMs + offsetMinutes * 60_000);
}
