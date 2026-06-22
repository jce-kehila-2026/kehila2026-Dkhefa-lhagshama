/**
 * Insights time-range parsing for the admin dashboard. Turns the
 * `?range=`/`?from=`/`?to=` query params on the insights/stats endpoints into
 * epoch-ms bounds that callers use to filter Firestore aggregates by time.
 * `null` on a bound means "unbounded" (no lower/upper limit, include everything).
 * Everything here is pure with an injectable `nowMs`, so it is deterministic and
 * unit-testable without touching the clock.
 */
const DAY_MS = 86_400_000;

const PRESET_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
};

// accepted values for `?range=`; `custom` is the from/to branch, `all` is unbounded
export const INSIGHTS_RANGES = ['7d', '30d', '90d', '12m', 'all', 'custom'] as const;
export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

// lower bound (epoch ms) for a preset; null for 'all' or any unknown value.
// the `days ?` guard intentionally collapses both no-such-preset and 'all' to null.
export function rangeToSinceMs(range: string, nowMs: number): number | null {
  const days = PRESET_DAYS[range];
  return days ? nowMs - days * DAY_MS : null;
}

/**
 * Resolve a request's `?range=` preset OR a custom `?from=YYYY-MM-DD&to=YYYY-MM-DD`
 * window into inclusive [sinceMs, untilMs] bounds (either may be null = unbounded).
 * A custom range (at least one valid from/to) takes precedence over a preset.
 */
export function resolveRange(
  q: { range?: unknown; from?: unknown; to?: unknown },
  nowMs: number,
): { sinceMs: number | null; untilMs: number | null } {
  // anchor the date-only inputs to UTC day edges (start-of-day / end-of-day) so
  // bounds are stable regardless of server timezone; NaN means absent/unparseable.
  const from = typeof q.from === 'string' ? Date.parse(`${q.from}T00:00:00Z`) : NaN;
  const to = typeof q.to === 'string' ? Date.parse(`${q.to}T23:59:59.999Z`) : NaN;
  // any one valid endpoint selects the custom branch; the missing side stays null (open-ended)
  if (!Number.isNaN(from) || !Number.isNaN(to)) {
    return {
      sinceMs: Number.isNaN(from) ? null : from,
      untilMs: Number.isNaN(to) ? null : to,
    };
  }
  return { sinceMs: rangeToSinceMs(String(q.range ?? 'all'), nowMs), untilMs: null };
}
