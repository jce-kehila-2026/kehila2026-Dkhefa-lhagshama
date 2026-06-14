/**
 * Transparent, rule-based volunteer matcher (WS-6). Mirrors lib/requestSort.ts:
 * a pure function over plain data, fully unit-tested, with `now` injected for
 * determinism. NO AI — four weighted If-Then signals, each emitting a
 * localizable reason the admin UI renders as a chip:
 *
 *   1. Category fit  — request.category ∈ approvedCategories (strong) OR
 *                      ∈ areas (weaker, fuzzy). Highest weight.
 *   2. Workload      — fewer open assigned requests ranks higher.
 *   3. Availability  — workStatus free > working > unavailable; plus a boost
 *                      when a recurring window falls before the deadline.
 *   4. Language      — request.preferredLanguage ∈ languages.
 *
 * Tunable constants live in WEIGHTS so the ranking stays explainable.
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
}

/** A single localizable reason emitted by a contributing signal. */
export type MatchReason =
  | { key: 'sameCategory' }
  | { key: 'relatedArea' }
  | { key: 'speaksLanguage'; lang: string }
  | { key: 'currentlyFree' }
  | { key: 'lowLoad'; count: number }
  | { key: 'availableBeforeDeadline' };

export interface ScoredVolunteer extends MatchVolunteer {
  score: number;
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
} as const;

function norm(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

/**
 * Score every candidate against the request and return them best-first.
 * Ties break by name ascending (locale-naive) so the order is deterministic.
 * `now` is injected so the day-aware availability boost is deterministic/testable
 * (default: current time — mirrors requestSort.ts's injected clock).
 */
export function scoreVolunteers(
  request: MatchRequest,
  volunteers: MatchVolunteer[],
  now: number = Date.now(),
): ScoredVolunteer[] {
  const cat = norm(request.category);
  const wantLang = norm(request.preferredLanguage);

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

    // 2. Workload — subtract a penalty per open task.
    score -= v.openLoad * WEIGHTS.loadPenalty;
    reasons.push({ key: 'lowLoad', count: v.openLoad });

    // 3. Availability — work status tier.
    if (v.workStatus === 'free') {
      score += WEIGHTS.workStatusFree;
      reasons.push({ key: 'currentlyFree' });
    } else if (v.workStatus === 'working') {
      score += WEIGHTS.workStatusWorking;
    }
    // 3b. Day-aware recurring window before the deadline (WS-7).
    if (windowsCoverBefore(v.availabilityWindows, request.deadline, now)) {
      score += WEIGHTS.availableBeforeDeadline;
      reasons.push({ key: 'availableBeforeDeadline' });
    }

    // 4. Language.
    if (wantLang && v.languages.map(norm).includes(wantLang)) {
      score += WEIGHTS.language;
      reasons.push({ key: 'speaksLanguage', lang: wantLang });
    }

    return { ...v, score, reasons };
  });

  return scored.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name),
  );
}
