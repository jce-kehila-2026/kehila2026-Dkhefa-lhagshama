/**
 * In-memory cache of the `categories` taxonomy collection (feedback round 2).
 *
 * Category ids are needed by several validators (beneficiary request submit,
 * admin task creation, volunteer category permissions), so we read the
 * collection once and cache the id sets for a short TTL instead of hitting
 * Firestore on every request. Admin category mutations call invalidate() so
 * changes are picked up immediately.
 *
 * FAIL-OPEN contract: ONLY when the collection is genuinely EMPTY (seeding
 * hasn't run) does `isAllowedCategory` accept any input (with a console.warn)
 * — the platform must not hard-fail just because the taxonomy wasn't seeded
 * yet. Two cases deliberately do NOT fail open:
 *   - read failure: a transient Firestore error must not silently disable
 *     validation, so the value is rejected (the failure is never cached, the
 *     next call retries);
 *   - every category archived: the collection is seeded, the admin chose to
 *     retire the ids, so 'active'-scope input is rejected like any unknown id.
 */
import { db } from '@/lib/firebaseAdmin';

const TTL_MS = 60_000; // ~60s: stale-tolerant; admin mutations invalidate eagerly.

interface CacheEntry {
  activeIds: string[];
  allIds: string[];
  fetchedAt: number;
  /** True on the uncached placeholder returned when the Firestore read threw. */
  readFailed?: boolean;
}

let cache: CacheEntry | null = null;

async function load(): Promise<CacheEntry> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < TTL_MS) return cache;

  try {
    const snap = await db().collection('categories').get();
    const allIds: string[] = [];
    const activeIds: string[] = [];
    for (const d of snap.docs) {
      allIds.push(d.id);
      // Soft archive: archived categories are hidden from pickers/new input
      // but stay resolvable so historical docs keep their labels.
      if (d.data().archived !== true) activeIds.push(d.id);
    }
    cache = { activeIds, allIds, fetchedAt: now };
    return cache;
  } catch (err) {
    // Don't cache the failure — retry on the next call. isAllowedCategory
    // fails CLOSED on this placeholder (see header contract).
    // eslint-disable-next-line no-console
    console.error('[categoriesCache] read failed:', err);
    return { activeIds: [], allIds: [], fetchedAt: 0, readFailed: true };
  }
}

/** Ids of non-archived categories (what pickers / new submissions may use). */
export async function getActiveCategoryIds(): Promise<string[]> {
  return (await load()).activeIds;
}

/** Ids of ALL categories, archived included (historical/label lookups). */
export async function getAllCategoryIds(): Promise<string[]> {
  return (await load()).allIds;
}

/** Drop the cache. Called by admin category mutations so changes are immediate. */
export function invalidate(): void {
  cache = null;
}

/**
 * Shared validator used by the zod refinements. `scope`:
 *   - 'active': new input (request submit, task create, volunteer permission
 *               request) — archived categories are rejected.
 *   - 'all':    historical references (admin approving a permission that was
 *               requested before a category was archived) — archived ids pass.
 *
 * Returns true (accepts) only for valid ids — plus the single fail-open case
 * of a genuinely unseeded collection (see the header contract). Read failures
 * and an all-archived taxonomy reject.
 */
export async function isAllowedCategory(
  value: string,
  scope: 'active' | 'all' = 'active',
): Promise<boolean> {
  const { activeIds, allIds, readFailed } = await load();
  if (readFailed) {
    // eslint-disable-next-line no-console
    console.warn(
      `[categoriesCache] taxonomy read failed — rejecting category "${value}" (fail-closed; retried next call)`,
    );
    return false;
  }
  if (allIds.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[categoriesCache] taxonomy empty — accepting category "${value}" unvalidated (fail-open; run the seed)`,
    );
    return true;
  }
  // Note: an all-archived taxonomy (allIds non-empty, activeIds empty) is NOT
  // unseeded — 'active'-scope input is rejected like any unknown id.
  const ids = scope === 'all' ? allIds : activeIds;
  return ids.includes(value);
}
