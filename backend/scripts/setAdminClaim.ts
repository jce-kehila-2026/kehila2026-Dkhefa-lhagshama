/**
 * Promote a user to admin by setting the `role: 'admin'` custom claim.
 *
 * Usage:
 *   cd backend
 *   npm run set-admin -- you@example.com
 *
 * The user must already exist in Firebase Auth (Email/Password). After
 * running this, the user must sign out + sign in again (or call
 * `getIdToken(true)` to force-refresh) before the new role is visible
 * client-side.
 */
import 'dotenv/config';

import { initializeFirebaseAdmin, auth } from '@/lib/firebaseAdmin';

async function main(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npm run set-admin -- <email>');
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

  await auth().setCustomUserClaims(user.uid, { role: 'admin' });

  // Verify
  const updated = await auth().getUser(user.uid);
  console.log(`OK. ${email} (uid=${user.uid}) now has role:`, updated.customClaims?.role);
  console.log('NOTE: they must sign out + sign in again to see the new role.');
}

main().catch((err) => {
  console.error('set-admin failed:', err);
  process.exit(3);
});
