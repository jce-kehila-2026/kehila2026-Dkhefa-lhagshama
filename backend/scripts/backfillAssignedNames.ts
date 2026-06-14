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
    await doc.ref.update({
      assignedVolunteerName: resolved,
      updatedAt: FieldValue.serverTimestamp(),
    });
    fixed += 1;
    console.log(`OK   ${doc.id} -> ${resolved}`);
  }

  console.log(`Done. assigned=${scanned} fixed=${fixed} skipped=${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('backfillAssignedNames failed:', err);
  process.exit(1);
});
