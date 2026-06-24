/**
 * One-time backfill: resolve `assignedVolunteerName` on legacy assigned request
 * docs (WS-5). Idempotent — skips rows whose name is already a real human name;
 * only rewrites rows where the name is missing, empty, or equal to the uid.
 *
 * Usage:
 *   cd backend
 *   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/backfillAssignedNames.ts
 *
 * Human-only step (like index/rules deploys). Safe to re-run.
 */
import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';

import { initializeFirebaseAdmin, db } from '@/lib/firebaseAdmin';
import { volunteerDisplayName } from '@/lib/displayName';
import { needsNameResolution } from '@/lib/assignedName';

async function main(): Promise<void> {
  initializeFirebaseAdmin();

  const snap = await db().collection('requests').get();
  let scanned = 0;
  let fixed = 0;
  let skipped = 0;

  // BATCHING (audit Prompt 8): accumulate the rewrites into Firestore batches
  // (max 500 ops/batch; we cap at 400 for headroom) and commit when full,
  // instead of one awaited .update() per doc. On a large requests collection the
  // per-doc round-trips would be slow and risk timing out / hitting quota.
  const BATCH_LIMIT = 400;
  let batch = db().batch();
  let pending = 0;
  const flush = async (): Promise<void> => {
    if (pending === 0) return;
    await batch.commit();
    batch = db().batch();
    pending = 0;
  };

  for (const doc of snap.docs) {
    const data = doc.data();
    const uid = (data.assignedVolunteerId as string | null | undefined) ?? null;
    if (!uid) {
      continue; // unassigned — nothing to resolve
    }
    scanned += 1;
    const storedName = (data.assignedVolunteerName as string | null | undefined) ?? null;
    if (!needsNameResolution(storedName, uid)) {
      skipped += 1;
      continue; // already a usable human name
    }
    const resolved = await volunteerDisplayName(uid);
    if (needsNameResolution(resolved, uid)) {
      console.warn(`SKIP ${doc.id} — could not resolve a name for uid ${uid}`);
      skipped += 1;
      continue;
    }
    batch.update(doc.ref, {
      assignedVolunteerName: resolved,
      updatedAt: FieldValue.serverTimestamp(),
    });
    pending += 1;
    fixed += 1;
    console.log(`OK   ${doc.id} -> ${resolved}`);
    if (pending >= BATCH_LIMIT) await flush();
  }

  await flush(); // commit the final partial batch

  console.log(`Done. assigned=${scanned} fixed=${fixed} skipped=${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('backfillAssignedNames failed:', err);
  process.exit(1);
});
