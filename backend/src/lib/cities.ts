/**
 * cities.ts — the canonical list of Israeli localities, served to every city
 * picker in the app.
 *
 * Source of truth is the government open-data locality table (CKAN dataset
 * 5c78e9fa on data.gov.il), whose records carry the CBS locality code
 * (`סמל_ישוב`), the Hebrew name (`שם_ישוב`) and a Latin transliteration
 * (`שם_ישוב_לועזי`). We key on the CODE, not the name: a name typed or spelled
 * two ways ("תל אביב" vs "תל אביב - יפו") is two different places to a string
 * comparison, which is exactly what silently broke the matcher's same-city
 * signal. The code is stable and language-independent.
 *
 * Availability: a committed snapshot (`@/data/cities.json`) is the floor, so
 * the pickers work offline and a demo never depends on data.gov.il being up.
 * On first request we try the live API in the background and swap the cache in
 * only if it returns a sane, larger-than-trivial list. Refresh is best-effort:
 * any failure just keeps the snapshot.
 */
import snapshot from '@/data/cities.json';

/** One locality, as served to clients. `code` is the durable key. */
export interface City {
  /** CBS locality code (`סמל_ישוב`), e.g. "5000" for Tel Aviv - Yafo. */
  code: string;
  /** Official Hebrew name, trimmed. */
  nameHe: string;
  /** Latin transliteration in title case; falls back to the Hebrew name. */
  nameEn: string;
}

/** Raw CKAN record shape (Hebrew field names, values padded with spaces). */
interface RawCityRecord {
  'סמל_ישוב'?: unknown;
  'שם_ישוב'?: unknown;
  'שם_ישוב_לועזי'?: unknown;
}

export const CITIES_RESOURCE_ID = '5c78e9fa-c2e2-4771-93ff-7f400a12f7ba';
export const CITIES_API_URL =
  `https://data.gov.il/api/3/action/datastore_search?resource_id=${CITIES_RESOURCE_ID}&limit=32000`;

/**
 * The dataset ships Latin names in ALL CAPS ("BE'ER SHEVA", "TEL AVIV - YAFO").
 * Lower-case them and capitalise each word so the English UI reads normally.
 * Word boundaries include spaces and hyphens; apostrophes stay inside a word
 * so "BE'ER" becomes "Be'er" and not "Be'Er".
 */
export function titleCaseLatin(value: string): string {
  return value
    .toLocaleLowerCase('en')
    .replace(/(^|[\s\-/])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('en'));
}

/**
 * Normalise raw CKAN records into `City`s: trim the padded fields, drop rows
 * missing a code or Hebrew name, fall back to the Hebrew name when the Latin
 * one is blank (4 localities have none), de-duplicate by code, and sort by
 * Hebrew name — the demo audience is Hebrew-speaking.
 */
export function normalizeCityRecords(records: RawCityRecord[]): City[] {
  const byCode = new Map<string, City>();

  for (const record of records) {
    const code = String(record['סמל_ישוב'] ?? '').trim();
    const nameHe = String(record['שם_ישוב'] ?? '').trim();
    if (!code || !nameHe) continue;

    const latin = String(record['שם_ישוב_לועזי'] ?? '').trim();
    byCode.set(code, { code, nameHe, nameEn: latin ? titleCaseLatin(latin) : nameHe });
  }

  return [...byCode.values()].sort((a, b) => a.nameHe.localeCompare(b.nameHe, 'he'));
}

// ── Cache ──────────────────────────────────────────────────────────────────

const SNAPSHOT: City[] = snapshot as City[];
/** A live response below this size means something is wrong; keep the snapshot. */
const MIN_PLAUSIBLE_COUNT = 500;
const REFRESH_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

let cache: City[] = SNAPSHOT;
let lastRefreshAt = 0;
let inFlight: Promise<void> | null = null;

/** Pull the live dataset. Throws on transport, HTTP, or shape failure. */
async function fetchLiveCities(): Promise<City[]> {
  const res = await fetch(CITIES_API_URL, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`data.gov.il responded ${res.status}`);

  const body = (await res.json()) as { success?: boolean; result?: { records?: RawCityRecord[] } };
  if (!body?.success || !Array.isArray(body.result?.records)) throw new Error('unexpected payload shape');

  const cities = normalizeCityRecords(body.result.records);
  if (cities.length < MIN_PLAUSIBLE_COUNT) {
    throw new Error(`implausible city count ${cities.length}`);
  }
  return cities;
}

/**
 * Refresh the cache from the live dataset, at most once per TTL and never more
 * than one request at a time. Best-effort: on any failure the current cache
 * (snapshot or previous live list) is left untouched.
 */
function refreshInBackground(): void {
  if (inFlight || Date.now() - lastRefreshAt < REFRESH_TTL_MS) return;

  inFlight = fetchLiveCities()
    .then((cities) => {
      cache = cities;
      lastRefreshAt = Date.now();
    })
    .catch((err) => {
      // Keep serving the snapshot; a stale-but-correct list beats an empty picker.
      // eslint-disable-next-line no-console
      console.warn('[cities] live refresh failed, serving snapshot:', (err as Error).message);
      lastRefreshAt = Date.now();
    })
    .finally(() => {
      inFlight = null;
    });
}

/** Every known locality. Returns immediately; refreshes the cache off the hot path. */
export function getCities(): City[] {
  refreshInBackground();
  return cache;
}

/** Look up one locality by its CBS code, or undefined if the code is unknown. */
export function getCityByCode(code: string): City | undefined {
  const wanted = code.trim();
  return getCities().find((c) => c.code === wanted);
}

/**
 * Fold a name for comparison: lowercase, drop the punctuation that varies
 * between spellings, collapse whitespace. Mirrors the client picker's folding
 * so "בני-ברק", "בני ברק" and "BENE BERAQ" all reconcile to one locality.
 */
export function foldCityName(value: string): string {
  return value
    .toLocaleLowerCase('he')
    // Apostrophes and geresh vanish INSIDE a word: "Be'er Sheva" and the
    // apostrophe-less "beer sheva" people actually type must fold alike.
    .replace(/['"׳״]/g, '')
    // Separators become a SPACE rather than nothing, so a hyphenated spelling
    // still reads as two words: "בני-ברק" -> "בני ברק", not "בניברק".
    .replace(/[-()./\\,]/g, ' ')
    // Hebrew ktiv male/haser: people write "קריית גת", the official table uses
    // "קרית גת". Collapsing a double yod reconciles the two spellings.
    .replace(/יי/g, 'י')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reverse lookup for records written before the picker existed, which stored a
 * free-text name and no code. Matches the Hebrew name or the Latin
 * transliteration. Returns undefined when the name is not an official locality
 * (a typo, or a place off the list), so callers can distinguish "resolved" from
 * "leave it alone" rather than guessing.
 */
export function findCityByName(name: string | null | undefined): City | undefined {
  const wanted = foldCityName(name ?? '');
  if (!wanted) return undefined;

  const cities = getCities();
  const exact = cities.find(
    (c) => foldCityName(c.nameHe) === wanted || foldCityName(c.nameEn) === wanted,
  );
  if (exact) return exact;

  // Several official names carry a second locality after a dash — "תל אביב - יפו",
  // "Tel Aviv - Yafo" — while people write just the first part. Match on that
  // leading segment, but ONLY when exactly one locality claims it: an ambiguous
  // prefix must stay unresolved rather than be assigned to a coin-flip winner.
  const head = (full: string): string => foldCityName(full.split(/\s+-\s+/)[0] ?? '');
  const candidates = cities.filter((c) => head(c.nameHe) === wanted || head(c.nameEn) === wanted);
  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Decide what a document should store for a locality. The display name is
 * ALWAYS derived from the code here rather than trusted from the request body,
 * so `city` and `cityCode` can never disagree on a record we wrote.
 *
 * An unknown or absent code falls back to the caller-supplied free-text name
 * with a null code — that path exists only for legacy clients and old data;
 * every current picker submits a code.
 */
export function resolveCityFields(
  code: string | undefined | null,
  fallbackName: string | undefined | null,
): { city: string; cityCode: string | null } {
  const city = code ? getCityByCode(code) : undefined;
  if (city) return { city: city.nameHe, cityCode: city.code };
  return { city: (fallbackName ?? '').trim(), cityCode: null };
}

/**
 * Same as `resolveCityFields` for the collections that store a locality as a
 * `{ he, en }` pair (businesses, directory entries). A resolved code yields a
 * genuinely bilingual value instead of the same string duplicated into both
 * slots, which is what free-text entry produced.
 */
export function resolveBilingualCity(
  code: string | undefined | null,
  fallbackName: string | undefined | null,
): { city: { he: string; en: string }; cityCode: string | null } {
  const city = code ? getCityByCode(code) : undefined;
  if (city) return { city: { he: city.nameHe, en: city.nameEn }, cityCode: city.code };
  const name = (fallbackName ?? '').trim();
  return { city: { he: name, en: name }, cityCode: null };
}
