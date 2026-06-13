/**
 * Bulk-assign roles in one command.
 *
 * Usage:
 *   cd backend
 *   npm run set-roles -- admin@example.com:admin volunteer@example.com:volunteer
 *
 * Each argument is `<email>:<role>` where role ∈ beneficiary | businessOwner | volunteer | admin.
 * Users must already exist in Firebase Auth. Each user must sign out + sign in
 * again to see their new role.
 */
import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';

import { initializeFirebaseAdmin, auth, db } from '@/lib/firebaseAdmin';

const VALID_ROLES = ['beneficiary', 'businessOwner', 'volunteer', 'admin'] as const;
type Role = (typeof VALID_ROLES)[number];

function isRole(value: string): value is Role {
  return (VALID_ROLES as readonly string[]).includes(value);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run set-roles -- <email>:<role> [<email>:<role> ...]');
    console.error(`Roles: ${VALID_ROLES.join(' | ')}`);
    process.exit(1);
  }

  const pairs: Array<{ email: string; role: Role }> = [];
  for (const arg of args) {
    const idx = arg.lastIndexOf(':');
    if (idx === -1) {
      console.error(`Bad argument "${arg}" — expected <email>:<role>.`);
      process.exit(1);
    }
    const email = arg.slice(0, idx);
    const role = arg.slice(idx + 1);
    if (!email || !isRole(role)) {
      console.error(`Bad argument "${arg}" — role must be one of ${VALID_ROLES.join(', ')}.`);
      process.exit(1);
    }
    pairs.push({ email, role });
  }

  initializeFirebaseAdmin();

  let failures = 0;
  for (const { email, role } of pairs) {
    try {
      const user = await auth().getUserByEmail(email);
      await auth().setCustomUserClaims(user.uid, { role });

      // Keep volunteers/{uid}.active in sync with the role (review r6). The
      // assign guard + admin dropdown key off this doc, not the claim — so a
      // volunteer set here must get active:true to be assignable, and a user
      // moved OFF volunteer must have any existing doc deactivated so a former
      // volunteer can't still be assigned (PII exposure).
      const volRef = db().collection('volunteers').doc(user.uid);
      if (role === 'volunteer') {
        await volRef.set(
          { uid: user.uid, active: true, approvedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
      } else if ((await volRef.get()).exists) {
        await volRef.update({ active: false, deactivatedAt: FieldValue.serverTimestamp() });
      }

      console.log(`OK  ${email} → ${role}`);
    } catch (err) {
      failures += 1;
      console.error(`FAIL ${email} → ${role}:`, (err as Error).message);
    }
  }

  console.log('NOTE: each user must sign out + sign in again to see the new role.');
  process.exit(failures === 0 ? 0 : 2);
}

main().catch((err) => {
  console.error('set-roles failed:', err);
  process.exit(3);
});
