/**
 * Repair seeded ID numbers that the app itself would now reject.
 *
 * The demo seed generated `300000000 + i`, which lands on a checksum-valid
 * Israeli ID only about one time in ten, so most seeded requests carried a
 * number that could never have been submitted through the form. Now that the
 * checksum is enforced server-side (lib/israeliId), that inconsistency is
 * visible: a reviewer opening those records sees identity numbers the platform
 * would refuse.
 *
 * Each repaired record gets its own checksum-valid number, allocated from a
 * counter and checked against the numbers already in use. Simply recomputing
 * the check digit in place is NOT enough: the seed's values differ only in
 * their last digit or two, so overwriting that digit collapses several
 * distinct beneficiaries onto one identity number.
 *
 * SCOPE: demo/seed data only. It rewrites something that looks like identity
 * data, which is acceptable precisely because these are synthetic records on a
 * staging project — hence the emulator/staging guard, the dry-run default and
 * the automatic backup. Do not point it at real identities.
 *
 *   cd backend && npx tsx scripts/backfillIdChecksum.ts            # dry run
 *   cd backend && npx tsx scripts/backfillIdChecksum.ts --confirm  # apply
 */
import 'dotenv/config';

import { initializeFirebaseAdmin, db } from '../src/lib/firebaseAdmin';
import { isValidIsraeliId, completeIsraeliId } from '../src/lib/israeliId';
import { exportFirestore } from './exportFirestore';
import { assertSafeToRun } from './lib/guard';

const BATCH_LIMIT = 400;

async function main() {
  const apply = process.argv.includes('--confirm');

  initializeFirebaseAdmin();
  assertSafeToRun({ action: 'backfillIdChecksum', destructive: false });

  console.log(apply ? '\nMODE: APPLY (writing)\n' : '\nMODE: DRY RUN (no writes — pass --confirm to apply)\n');
  if (apply) {
    const backupPath = await exportFirestore();
    console.log(`Backup written: ${backupPath}\n`);
  }

  const snap = await db().collection('requests').get();

  // Numbers already in use — a freshly allocated one must not collide with a
  // record we are leaving untouched, nor with another record we repair.
  const taken = new Set<string>();
  for (const doc of snap.docs) {
    const existing = String(doc.data().idNumber ?? '').replace(/\D/g, '');
    if (existing && isValidIsraeliId(existing)) taken.add(existing);
  }

  // Allocator: walk 8-digit prefixes from a fixed base, complete the check
  // digit, and take the first result nobody holds. Mirrors how the seed now
  // builds its identities, so repaired and re-seeded data look alike.
  let nextPrefix = 30000000;
  const allocate = (): string => {
    for (;;) {
      const candidate = completeIsraeliId(String(nextPrefix));
      nextPrefix += 1;
      if (!taken.has(candidate)) {
        taken.add(candidate);
        return candidate;
      }
    }
  };

  let batch = db().batch();
  let pending = 0;
  let fixed = 0;
  let alreadyValid = 0;
  let skipped = 0;
  const samples: string[] = [];

  for (const doc of snap.docs) {
    const data = doc.data();
    // Only Israeli-ID rows carry a checksummed number; passport / "no document"
    // rows hold free-form or empty values and must be left alone.
    if (data.idType && data.idType !== 'israeli_id') { skipped += 1; continue; }

    const current = String(data.idNumber ?? '').trim();
    if (!current) { skipped += 1; continue; }
    if (isValidIsraeliId(current)) { alreadyValid += 1; continue; }

    const digits = current.replace(/\D/g, '');
    // Anything that is not a 9-digit number is not a check-digit problem —
    // report it rather than inventing a number from a malformed value.
    if (digits.length !== 9) {
      samples.push(`${data.displayId ?? doc.id}: ${JSON.stringify(current)} (not 9 digits — left alone)`);
      skipped += 1;
      continue;
    }

    const repaired = allocate();
    fixed += 1;
    if (samples.length < 8) samples.push(`${data.displayId ?? doc.id}: ${current} -> ${repaired}`);

    if (!apply) continue;
    batch.update(doc.ref, { idNumber: repaired });
    pending += 1;
    if (pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = db().batch();
      pending = 0;
    }
  }

  if (apply && pending > 0) await batch.commit();

  console.log(`requests scanned : ${snap.size}`);
  console.log(`already valid    : ${alreadyValid}`);
  console.log(`not applicable   : ${skipped}`);
  console.log(`${apply ? 'repaired       ' : 'to repair      '} : ${fixed}`);
  if (samples.length) {
    console.log('\nsamples:');
    for (const s of samples) console.log(`  ${s}`);
  }
  if (!apply) console.log('\nNothing was written. Re-run with --confirm to apply.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backfillIdChecksum] failed:', err);
    process.exit(1);
  });
