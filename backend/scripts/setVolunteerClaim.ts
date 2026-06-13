/**
 * Promote a user to volunteer by setting the `role: 'volunteer'` custom claim.
 *
 * Usage:
 *   cd backend
 *   npm run set-volunteer -- you@example.com
 *
 * The user must already exist in Firebase Auth (Email/Password). After
 * running this, the user must sign out + sign in again (or call
 * `getIdToken(true)` to force-refresh) before the new role is visible
 * client-side.
 */
import 'dotenv/config';
import { FieldValue } from 'firebase-admin/firestore';

import { initializeFirebaseAdmin, auth, db } from '@/lib/firebaseAdmin';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run set-volunteer -- <email>');
    process.exit(1);
  }

  initializeFirebaseAdmin();

  let user;
  try {
    user = await auth().getUserByEmail(email);
  } catch (err) {
    console.error(`User not found for email ${email}.`);
    console.error('Make sure they have registered via the app first.');
    process.exit(2);
  }

  await auth().setCustomUserClaims(user.uid, { role: 'volunteer' });

  // Upsert volunteers/{uid} active:true (review r6) so the user is actually
  // assignable: the assign guard + admin dropdown key off this doc, not the
  // claim alone. Without it a script-promoted volunteer can never be assigned
  // (409 volunteer_inactive) and never appears in the assign dropdown.
  await db()
    .collection('volunteers')
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        active: true,
        approvedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  const updated = await auth().getUser(user.uid);
  console.log(`OK. ${email} (uid=${user.uid}) now has role:`, updated.customClaims?.role);
  console.log('NOTE: they must sign out + sign in again to see the new role.');
}

main().catch((err) => {
  console.error('set-volunteer failed:', err);
  process.exit(3);
});
