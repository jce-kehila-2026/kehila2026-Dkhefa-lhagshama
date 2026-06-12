/**
 * In-memory cache of the `categories` taxonomy collection (feedback round 2).
 *
 * Category ids are needed by several validators (beneficiary request submit,
 * admin task creation, volunteer category permissions), so we read the
 * collection once and cache the id sets for a short TTL instead of hitting
 * Firestore on every request. Admin category mutations call invalidate() so
 * changes are picked up immediately.
 *
 * FAIL-OPEN contract: if the collection is EMPTY (seeding hasn't run) or the
 * read fails, the getters return [] and callers must ACCEPT the input (with a
 * console.warn) rather than reject everything — the platform must not
 * hard-fail just because the taxonomy wasn't seeded yet. `isAllowedCategory`
 * below centralizes that fallback for the zod refinements.
 */
import { db } from '@/lib/firebaseAdmin';

const TTL_MS = 60_000; // ~60s: stale-tolerant; admin mutations invalidate eagerly.

interface CacheEntry {
  activeIds: string[];
  allIds: string[];
  fetchedAt: number;
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
    // Fail open (see header): a Firestore hiccup must not turn every
    // category-validated endpoint into a 500/400 storm. Don't cache the
    // failure — retry on the next call.
    // eslint-disable-next-line no-console
    console.error('[categoriesCache] read failed — failing open:', err);
    return { activeIds: [], allIds: [], fetchedAt: 0 };
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
 * Returns true (accepts) when the taxonomy is empty/unreadable, per the
 * fail-open contract above.
 */
export async function isAllowedCategory(
  value: string,
  scope: 'active' | 'all' = 'active',
): Promise<boolean> {
  const ids = scope === 'all' ? await getAllCategoryIds() : await getActiveCategoryIds();
  if (ids.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[categoriesCache] taxonomy empty — accepting category "${value}" unvalidated (fail-open; run the seed)`,
    );
    return true;
  }
  return ids.includes(value);
}
