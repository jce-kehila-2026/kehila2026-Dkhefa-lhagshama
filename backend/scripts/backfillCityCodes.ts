/**
 * Backfill `cityCode` on records written before the locality picker existed.
 *
 * Those records stored a free-text city NAME and no code, so two spellings of
 * one place stayed two different places to any string comparison — which is
 * what kept the volunteer matcher's same-city signal from firing. This script
 * reconciles each stored name against the official CBS locality table
 * (`src/lib/cities`) and writes the resolved `cityCode`, canonicalising the
 * display name at the same time so name and code can never disagree.
 *
 * Shapes handled: `requests`/`users`/`volunteers`/`volunteerApplications` store
 * a flat string; `businesses` stores a bilingual `{ he, en }` pair.
 *
 * SAFETY
 *   - Dry run by DEFAULT: prints exactly what would change and writes nothing.
 *     Pass --confirm to apply.
 *   - Auto-backs-up first (exportFirestore), same as seedDemoData.
 *   - Guarded to emulator/staging by scripts/lib/guard.
 *   - Never GUESSES. A name that does not match an official locality is left
 *     untouched and reported, so a typo is surfaced for a human rather than
 *     silently snapped to the nearest-looking place.
 *   - Idempotent: a doc that already has a cityCode is skipped, so re-running
 *     is a no-op.
 *
 *   cd backend && npx tsx scripts/backfillCityCodes.ts            # dry run
 *   cd backend && npx tsx scripts/backfillCityCodes.ts --confirm  # apply
 */
import 'dotenv/config';

import { initializeFirebaseAdmin, db } from '../src/lib/firebaseAdmin';
import { findCityByName, getCities } from '../src/lib/cities';
import { exportFirestore } from './exportFirestore';
import { assertSafeToRun } from './lib/guard';

/** Firestore write batches cap at 500 operations. */
const BATCH_LIMIT = 400;

/** Collections carrying a locality, and how that locality is stored. */
const TARGETS: Array<{ collection: string; shape: 'flat' | 'bilingual' }> = [
  { collection: 'requests', shape: 'flat' },
  { collection: 'users', shape: 'flat' },
  { collection: 'volunteers', shape: 'flat' },
  { collection: 'volunteerApplications', shape: 'flat' },
  { collection: 'businesses', shape: 'bilingual' },
];

/** Pull a comparable name out of either storage shape. */
function readName(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const pair = value as { he?: unknown; en?: unknown };
    if (typeof pair.he === 'string' && pair.he.trim()) return pair.he;
    if (typeof pair.en === 'string' && pair.en.trim()) return pair.en;
  }
  return '';
}

interface Report {
  scanned: number;
  updated: number;
  alreadyCoded: number;
  noCity: number;
  /** Names that matched no official locality, with how many docs hold each. */
  unresolved: Map<string, number>;
}

async function migrateCollection(
  collection: string,
  shape: 'flat' | 'bilingual',
  apply: boolean,
): Promise<Report> {
  const report: Report = {
    scanned: 0,
    updated: 0,
    alreadyCoded: 0,
    noCity: 0,
    unresolved: new Map(),
  };

  const snap = await db().collection(collection).get();
  let batch = db().batch();
  let pending = 0;

  for (const doc of snap.docs) {
    report.scanned += 1;
    const data = doc.data();

    // Idempotency: anything already coded (by the picker or a previous run) is
    // left exactly as it is.
    if (typeof data.cityCode === 'string' && data.cityCode.trim()) {
      report.alreadyCoded += 1;
      continue;
    }

    const name = readName(data.city);
    if (!name.trim()) {
      report.noCity += 1;
      continue;
    }

    const city = findCityByName(name);
    if (!city) {
      report.unresolved.set(name, (report.unresolved.get(name) ?? 0) + 1);
      continue;
    }

    report.updated += 1;
    if (!apply) continue;

    batch.update(doc.ref, {
      cityCode: city.code,
      // Canonicalise the display name off the same record we just resolved.
      city: shape === 'bilingual' ? { he: city.nameHe, en: city.nameEn } : city.nameHe,
    });
    pending += 1;

    if (pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = db().batch();
      pending = 0;
    }
  }

  if (apply && pending > 0) await batch.commit();
  return report;
}

/**
 * Volunteer roster docs never carried a locality: the approval flow did not
 * copy `city` off the application (fixed alongside the picker, but existing
 * rows predate it). The matcher reads the volunteer's city for its same-city
 * signal, so without this the signal cannot fire for any current volunteer no
 * matter how well the request side is coded. Inherit from the volunteer's own
 * `users` profile, which is where their city was actually captured.
 */
async function inheritVolunteerCityFromProfile(apply: boolean) {
  const [volunteers, users] = await Promise.all([
    db().collection('volunteers').get(),
    db().collection('users').get(),
  ]);
  const profileById = new Map(users.docs.map((d) => [d.id, d.data()]));

  let filled = 0;
  let noProfileCity = 0;
  let batch = db().batch();
  let pending = 0;

  for (const doc of volunteers.docs) {
    const data = doc.data();
    const hasCity = typeof data.city === 'string' && data.city.trim();
    if (hasCity || (typeof data.cityCode === 'string' && data.cityCode.trim())) continue;

    // Roster docs key on uid, which may live in the field or be the doc id.
    const uid = (data.uid as string | undefined) ?? doc.id;
    const profile = profileById.get(uid);
    const city = profile ? findCityByName(readName(profile.city)) : undefined;
    if (!city) {
      noProfileCity += 1;
      continue;
    }

    filled += 1;
    if (!apply) continue;

    batch.update(doc.ref, { city: city.nameHe, cityCode: city.code });
    pending += 1;
    if (pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = db().batch();
      pending = 0;
    }
  }

  if (apply && pending > 0) await batch.commit();
  console.log(
    `volunteers (from profile)  ${apply ? 'filled' : 'to fill'} ${String(filled).padStart(4)} | ` +
      `no usable profile city ${String(noProfileCity).padStart(4)}`,
  );
  return filled;
}

async function main() {
  const apply = process.argv.includes('--confirm');

  initializeFirebaseAdmin();
  // Non-destructive: this only adds a field and canonicalises a name it just
  // derived — it never deletes. The emulator/staging gate still applies.
  assertSafeToRun({ action: 'backfillCityCodes', destructive: false });

  console.log(`\nLocality table: ${getCities().length} official localities`);
  console.log(apply ? 'MODE: APPLY (writing)\n' : 'MODE: DRY RUN (no writes — pass --confirm to apply)\n');

  if (apply) {
    const backupPath = await exportFirestore();
    console.log(`Backup written: ${backupPath}\n`);
  }

  const unresolvedAll = new Map<string, number>();
  let totalUpdated = 0;

  for (const { collection, shape } of TARGETS) {
    const r = await migrateCollection(collection, shape, apply);
    totalUpdated += r.updated;
    for (const [name, count] of r.unresolved) {
      unresolvedAll.set(name, (unresolvedAll.get(name) ?? 0) + count);
    }
    console.log(
      `${collection.padEnd(22)} scanned ${String(r.scanned).padStart(4)} | ` +
        `${apply ? 'updated' : 'to update'} ${String(r.updated).padStart(4)} | ` +
        `already coded ${String(r.alreadyCoded).padStart(4)} | ` +
        `no city ${String(r.noCity).padStart(4)} | ` +
        `unresolved ${String([...r.unresolved.values()].reduce((a, b) => a + b, 0)).padStart(4)}`,
    );
  }

  // Runs after the name->code pass so a volunteer who already had a city keeps it.
  totalUpdated += await inheritVolunteerCityFromProfile(apply);

  console.log(`\nTotal ${apply ? 'updated' : 'to update'}: ${totalUpdated}`);

  if (unresolvedAll.size > 0) {
    console.log('\nUnresolved names (left untouched — fix by hand or re-pick in the UI):');
    for (const [name, count] of [...unresolvedAll.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(count).padStart(3)}x  ${JSON.stringify(name)}`);
    }
  }

  if (!apply) console.log('\nNothing was written. Re-run with --confirm to apply.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfillCityCodes] failed:', err);
    process.exit(1);
  });
