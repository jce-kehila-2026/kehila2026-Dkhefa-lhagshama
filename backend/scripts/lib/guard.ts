/**
 * Shared safety guard for the DB scripts in backend/scripts/ (audit HIGH).
 *
 * BIG PICTURE
 * -----------
 * Every script here runs with the Admin SDK against whatever project the
 * service-account key resolves to. `seedDemoData.ts` was correctly fenced
 * (`--confirm` + a "must be staging" assert + an auto-backup), but `seed.ts` and
 * `seedOrgs.ts` had NO guard at all — one wrong `GOOGLE_APPLICATION_CREDENTIALS`
 * and `npm run seed` would silently overwrite real `categories`/`answers`/
 * `businesses` taxonomy on production. This module centralizes the guard so all
 * three scripts share one well-tested gate (DRY), and closes the prod-clobber
 * hole on the two upsert seeds.
 *
 * Two safety levels:
 *   - destructive:true  (seedDemoData wipes collections): require `--confirm`
 *     AND a project id containing "staging". No override — wiping the wrong
 *     project is unrecoverable.
 *   - destructive:false (seed/seedOrgs only UPSERT, never delete): run only
 *     against the Firestore emulator OR a "staging" project; any other project
 *     id is refused unless the operator passes `--allow-nonstaging` (so a
 *     deliberate dev project still works, but an accidental prod key does not).
 */
import * as fs from 'fs';
import * as path from 'path';

/**
 * Resolve the Firebase project id the Admin SDK will actually write to, by
 * reading `project_id` from the service-account key
 * (GOOGLE_APPLICATION_CREDENTIALS, else backend/serviceAccountKey.json), with an
 * env fallback. This is the project the script is ABOUT to mutate — the value we
 * gate on.
 */
export function resolveProjectId(): string {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : path.join(__dirname, '..', '..', 'serviceAccountKey.json');
  try {
    return JSON.parse(fs.readFileSync(credPath, 'utf8')).project_id ?? '';
  } catch {
    return process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT ?? '';
  }
}

interface GuardOptions {
  /** Human-readable description of what the script does (for the log line). */
  action: string;
  /** True only for scripts that DELETE data (seedDemoData). Defaults to false. */
  destructive?: boolean;
}

/**
 * Refuse to run unless it is safe for the resolved project. Exits the process
 * (code 1) with an explanatory message when the gate fails — call it before any
 * write.
 */
export function assertSafeToRun({ action, destructive = false }: GuardOptions): void {
  const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const projectId = resolveProjectId();
  const isStaging = projectId.includes('staging');

  if (destructive) {
    // Wipes data: the strict gate. `--confirm` + staging only, no override.
    if (!process.argv.includes('--confirm')) {
      console.error(`Refusing to run "${action}" without --confirm. This wipes data.`);
      console.error('Usage: add --confirm to the command.');
      process.exit(1);
    }
    if (!isStaging) {
      console.error(`Refusing to run "${action}": project "${projectId}" is not a staging project.`);
      process.exit(1);
    }
    console.log(`Guard OK (${action}) — project: ${projectId}`);
    return;
  }

  // Non-destructive upsert: emulator or staging is always fine; any other
  // project requires an explicit acknowledgement so an accidental prod key is
  // caught.
  if (usingEmulator) {
    console.log(`Guard OK (${action}) — Firestore emulator (${process.env.FIRESTORE_EMULATOR_HOST}).`);
    return;
  }
  if (isStaging) {
    console.log(`Guard OK (${action}) — project: ${projectId}`);
    return;
  }
  if (process.argv.includes('--allow-nonstaging')) {
    console.warn(`Guard OVERRIDE (${action}) — writing to non-staging project "${projectId}" (--allow-nonstaging).`);
    return;
  }
  console.error(`Refusing to run "${action}": project "${projectId}" is not staging/emulator.`);
  console.error('If this is a deliberate dev project, re-run with --allow-nonstaging.');
  process.exit(1);
}
