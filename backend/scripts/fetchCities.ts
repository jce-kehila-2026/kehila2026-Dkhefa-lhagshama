/**
 * Refresh the committed locality snapshot from data.gov.il.
 *
 * `src/lib/cities.ts` serves this snapshot as its floor and only swaps in the
 * live dataset when a fetch succeeds, so the pickers keep working offline and
 * during a demo. Re-run this whenever the official list should be re-baselined:
 *
 *   cd backend && npx tsx scripts/fetchCities.ts
 *
 * Read-only against the network; the only write is src/data/cities.json.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

import { CITIES_API_URL, normalizeCityRecords } from '../src/lib/cities';

const OUT_PATH = join(__dirname, '..', 'src', 'data', 'cities.json');

async function main() {
  console.log('[fetchCities] GET', CITIES_API_URL);
  const res = await fetch(CITIES_API_URL, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`data.gov.il responded ${res.status}`);

  const body = (await res.json()) as { success?: boolean; result?: { records?: unknown[] } };
  if (!body?.success || !Array.isArray(body.result?.records)) {
    throw new Error('unexpected payload shape');
  }

  const cities = normalizeCityRecords(body.result.records as Parameters<typeof normalizeCityRecords>[0]);
  console.log(`[fetchCities] ${body.result.records.length} records -> ${cities.length} localities`);

  writeFileSync(OUT_PATH, `${JSON.stringify(cities, null, 2)}\n`, 'utf8');
  console.log('[fetchCities] wrote', OUT_PATH);
}

main().catch((err) => {
  console.error('[fetchCities] failed:', err);
  process.exit(1);
});
