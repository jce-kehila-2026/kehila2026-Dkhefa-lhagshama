/**
 * Transparent, rule-based volunteer matcher (WS-6, upgraded). Mirrors
 * lib/requestSort.ts: a pure function over plain data, fully unit-tested, with
 * `now` injected for determinism. NO AI — weighted If-Then signals, each
 * emitting a localizable reason the admin UI renders as a chip:
 *
 *   1. Category fit  — request.category ∈ approvedCategories (strong) OR
 *                      ∈ areas (weaker, fuzzy). Highest weight.
 *   2. Workload      — fewer open assigned requests ranks higher; a volunteer
 *                      at/over the capacity ceiling is pushed firmly down.
 *   3. Availability  — workStatus free > working > unavailable; plus a boost
 *                      when a recurring window falls before the deadline.
 *   4. Language      — request.preferredLanguage ∈ languages.
 *   5. Proximity     — same city as the request gets a boost.
 *   6. Track record  — a high average rating ON THIS CATEGORY boosts the match.
 *
 * Urgency scales the time-sensitive signals (availability + workload): when a
 * request is urgent, who can act now and who has room matters more.
 *
 * The raw `score` stays for ordering/debugging, but every candidate also carries
 * a normalized `matchPercent` (0-100) — the share of the *ideal* match for this
 * specific request — which is what the admin UI shows. Tunable constants live in
 * WEIGHTS so the ranking stays explainable.
 */

import { windowsCoverBefore } from './availability';

export type PreferredLanguage = 'he' | 'am' | 'en';

export interface AvailabilityWindow {
  day: number; // 0-6 (Sun-Sat)
  start: string; // "HH:MM"
  end: string; // "HH:MM"
}

export interface MatchRequest {
  category?: string | null;
  preferredLanguage?: PreferredLanguage | null;
  /** ISO date string or null. */
  deadline?: string | null;
  /** Drives the urgency factor over the time-sensitive signals. */
  urgency?: 'low' | 'medium' | 'high' | string | null;
  /** Requester city — enables the proximity signal. */
  city?: string | null;
}

export interface MatchVolunteer {
  uid: string;
  name: string;
  languages: string[];
  areas: string[];
  approvedCategories: string[];
  workStatus: 'free' | 'working' | 'unavailable' | string;
  /** Count of the volunteer's currently-open assigned requests. */
  openLoad: number;
  availabilityWindows: AvailabilityWindow[];
  /** Volunteer city — compared to the request city for the proximity signal. */
  city?: string | null;
  /** Average rating (1-5) restricted to requests IN THIS CATEGORY, or null. */
  avgRating?: number | null;
  /** How many category-specific ratings `avgRating` is based on. */
  ratingCount?: number;
}

/** A single localizable reason emitted by a contributing signal. */
export type MatchReason =
  | { key: 'sameCategory' }
  | { key: 'relatedArea' }
  | { key: 'speaksLanguage'; lang: string }
  | { key: 'currentlyFree' }
  | { key: 'lowLoad'; count: number }
  | { key: 'availableBeforeDeadline' }
  | { key: 'nearby' }
  | { key: 'highlyRated'; rating: number }
  | { key: 'atCapacity'; count: number };

export interface ScoredVolunteer extends MatchVolunteer {
  score: number;
  /** 0-100 — `score` as a share of the best achievable score for this request. */
  matchPercent: number;
  reasons: MatchReason[];
}

// Tunable weights — higher = stronger pull. Category dominates by design.
export const WEIGHTS = {
  sameCategory: 100,
  relatedArea: 45,
  language: 30,
  workStatusFree: 20,
  workStatusWorking: 8,
  availableBeforeDeadline: 12,
  // Workload is subtractive: each open task costs this many points (so a
  // lighter volunteer outranks a busier one when every other signal ties).
  loadPenalty: 6,
  // Same-city proximity boost.
  sameCity: 18,
  // Track record: points per rating-star above 3.0, capped. 5★ → +20, 4★ → +10,
  // ≤3★ → 0 (we boost good histories, never penalize for a low/absent one).
  ratingPerStar: 10,
  ratingMax: 20,
  // A volunteer at/above this many open tasks is "at capacity": a steep flat
  // penalty so they sink below anyone with room, whatever else they offer.
  capacityCeiling: 5,
  atCapacityPenalty: 60,
} as const;

// Urgency multiplier over the time-sensitive signals (free status, deadline
// coverage, workload penalty). Unknown/absent urgency is neutral (1).
const URGENCY_FACTOR: Record<string, number> = { high: 1.5, medium: 1, low: 0.7 };

function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

/** Category-restricted rating boost: points per star above 3.0, capped. */
function ratingBoost(v: MatchVolunteer): number {
  if (typeof v.avgRating !== 'number' || (v.ratingCount ?? 0) <= 0) return 0;
  return Math.min(
    WEIGHTS.ratingMax,
    Math.max(0, Math.round((v.avgRating - 3) * WEIGHTS.ratingPerStar)),
  );
}

/**
 * The best score any volunteer could reach for THIS request — used to turn the
 * raw score into a 0-100 percentage. Only signals the request actually enables
 * count (no preferredLanguage ⇒ language can never fire ⇒ excluded), so the
 * percentage reflects a realistic ceiling rather than an unreachable one.
 */
function maxScoreFor(request: MatchRequest, urgencyFactor: number): number {
  let max = 0;
  if (norm(request.category)) max += WEIGHTS.sameCategory;
  max += WEIGHTS.workStatusFree * urgencyFactor;
  if (request.deadline) max += WEIGHTS.availableBeforeDeadline * urgencyFactor;
  if (norm(request.preferredLanguage)) max += WEIGHTS.language;
  if (norm(request.city)) max += WEIGHTS.sameCity;
  max += WEIGHTS.ratingMax;
  // Guard against a degenerate request (no category/city/lang/deadline): the
  // free-status term keeps this strictly positive, so the division is safe.
  return max > 0 ? max : 1;
}

/**
 * Score every candidate against the request and return them best-first.
 * Ties break by openLoad ascending, then name ascending (locale-naive), so the
 * order is deterministic. `now` is injected so the day-aware availability boost
 * is deterministic/testable (default: current time — mirrors requestSort.ts).
 */
export function scoreVolunteers(
  request: MatchRequest,
  volunteers: MatchVolunteer[],
  now: number = Date.now(),
): ScoredVolunteer[] {
  const cat = norm(request.category);
  const wantLang = norm(request.preferredLanguage);
  const reqCity = norm(request.city);
  const uf = URGENCY_FACTOR[norm(request.urgency)] ?? 1;
  const maxScore = maxScoreFor(request, uf);

  const scored = volunteers.map((v): ScoredVolunteer => {
    let score = 0;
    const reasons: MatchReason[] = [];

    // 1. Category fit (strong exact, weaker fuzzy area).
    const approved = v.approvedCategories.map(norm);
    const areas = v.areas.map(norm);
    if (cat && approved.includes(cat)) {
      score += WEIGHTS.sameCategory;
      reasons.push({ key: 'sameCategory' });
    } else if (cat && areas.includes(cat)) {
      score += WEIGHTS.relatedArea;
      reasons.push({ key: 'relatedArea' });
    }

    // 2. Workload — subtract a penalty per open task (urgency-scaled). Emit the
    // idle chip only for a genuinely free volunteer; flag at-capacity ones.
    score -= v.openLoad * WEIGHTS.loadPenalty * uf;
    if (v.openLoad === 0) {
      reasons.push({ key: 'lowLoad', count: v.openLoad });
    }
    if (v.openLoad >= WEIGHTS.capacityCeiling) {
      score -= WEIGHTS.atCapacityPenalty;
      reasons.push({ key: 'atCapacity', count: v.openLoad });
    }

    // 3. Availability — work status tier (urgency-scaled).
    if (v.workStatus === 'free') {
      score += WEIGHTS.workStatusFree * uf;
      reasons.push({ key: 'currentlyFree' });
    } else if (v.workStatus === 'working') {
      score += WEIGHTS.workStatusWorking * uf;
    }
    // 3b. Day-aware recurring window before the deadline (WS-7).
    if (windowsCoverBefore(v.availabilityWindows, request.deadline, now)) {
      score += WEIGHTS.availableBeforeDeadline * uf;
      reasons.push({ key: 'availableBeforeDeadline' });
    }

    // 4. Language.
    if (wantLang && v.languages.map(norm).includes(wantLang)) {
      score += WEIGHTS.language;
      reasons.push({ key: 'speaksLanguage', lang: wantLang });
    }

    // 5. Proximity — same city as the requester.
    if (reqCity && norm(v.city) === reqCity) {
      score += WEIGHTS.sameCity;
      reasons.push({ key: 'nearby' });
    }

    // 6. Track record — category-specific average rating.
    const rb = ratingBoost(v);
    if (rb > 0) score += rb;
    if (typeof v.avgRating === 'number' && (v.ratingCount ?? 0) > 0 && v.avgRating >= 4) {
      reasons.push({ key: 'highlyRated', rating: Math.round(v.avgRating * 10) / 10 });
    }

    const matchPercent = Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));
    return { ...v, score, matchPercent, reasons };
  });

  return scored.sort((a, b) =>
    b.score !== a.score
      ? b.score - a.score
      : a.openLoad !== b.openLoad
        ? a.openLoad - b.openLoad
        : a.name.localeCompare(b.name),
  );
}
