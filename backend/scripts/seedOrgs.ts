/**
 * seedOrgs.ts — import the NPO's 18 real Ethiopian-community organizations into
 * the `answers` collection (UC-02 directory).
 *
 * Source: scripts/data/ethiopian-orgs.source.json (handed over by the NPO,
 * derived from `ארגונים_לעדה_האתיופית_מסווג.xlsx`). Each org becomes an
 * approved `answers` doc shaped exactly like the hand-written ANSWERS seeds in
 * seed.ts, so the public GET /api/answers + DirectoryPage render them with no
 * special-casing.
 *
 * IDEMPOTENT: each doc id is a deterministic slug of the org name, so re-running
 * upserts in place (no duplicates). `createdAt`/`createdBy` are preserved on
 * update — they are only written on first insert. The source lists `טנא בריאות`
 * twice; both map to the same slug, so only one doc results.
 *
 * Run standalone:  npm run seed:orgs   (ts-node, same as `npm run seed`)
 * Also imported + called by scripts/seed.ts so a fresh full seed includes them.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import orgsSource from './data/ethiopian-orgs.source.json';

// ─────────────────────────────────────────────────────────────
//  Source row shape (ethiopian-orgs.source.json).
// ─────────────────────────────────────────────────────────────
interface OrgSource {
  name: string;
  serviceType: string;
  description: string | null;
  level: string | null;
  region: string | null;
  manager: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

const ORGS = orgsSource as OrgSource[];

// ─────────────────────────────────────────────────────────────
//  Service-type → managed taxonomy id.
//
//  Only the PRIMARY (first, comma-separated) service token is mapped; the full
//  original serviceType string is preserved verbatim in `audience` so nothing
//  is lost. Ids must exist in seed.ts CATEGORIES:
//    employment | education | legal | housing | health | social | welfare |
//    absorption | community | youth.
//  Unknown tokens fall back to 'social'.
// ─────────────────────────────────────────────────────────────
const SERVICE_TYPE_TO_CATEGORY: Record<string, string> = {
  תעסוקה: 'employment',
  צעירים: 'youth',
  מנהיגות: 'youth',
  חינוך: 'education',
  תרבות: 'education',
  נוער: 'youth',
  בריאות: 'health',
  'בריאות נפש': 'health',
  'בריאות קהילתית': 'health',
  זכויות: 'legal',
  מדיניות: 'legal',
  'זכויות דתיות': 'legal',
  'סיוע משפטי': 'legal',
  'סיוע משפטי וזכויות': 'legal',
  קהילה: 'community',
  רווחה: 'welfare',
  העצמה: 'welfare',
};

const FALLBACK_CATEGORY = 'social';

/** Map the first comma-separated service token to a taxonomy id. */
function categoryForServiceType(serviceType: string): string {
  const primary = serviceType.split(',')[0]?.trim() ?? '';
  return SERVICE_TYPE_TO_CATEGORY[primary] ?? FALLBACK_CATEGORY;
}

// ─────────────────────────────────────────────────────────────
//  Partner classification.
//
//  Most imported orgs are local service NGOs (orgType 'ngo'). A few are
//  national/advocacy bodies that belong in the public partners (שותפים) tab
//  rather than the NGO list, so the partners directory is never permanently
//  empty. Matched by exact org name; everything else stays 'ngo'.
// ─────────────────────────────────────────────────────────────
const PARTNER_NAMES = new Set<string>([
  'הפרויקט הלאומי לקהילה האתיופית (ENP)',
  'עמותת טבקה',
  'האגודה לזכויות האזרח',
]);

/** Partner bodies go in the שותפים tab; all other orgs are plain NGOs. */
function orgTypeForName(name: string): 'ngo' | 'partner' {
  return PARTNER_NAMES.has(name) ? 'partner' : 'ngo';
}

// ─────────────────────────────────────────────────────────────
//  Deterministic doc id (slug) — so re-running upserts, never duplicates.
//  Keeps Hebrew letters (Firestore doc ids allow them), collapses whitespace
//  and strips characters that are illegal in a doc id ('/' and control chars).
// ─────────────────────────────────────────────────────────────
function slugifyOrgName(name: string): string {
  const cleaned = name
    .trim()
    // Strip chars that are illegal/noisy in a Firestore doc id: '/', '\\',
    // '?', '#', '%', '.', quotes and parens. Hyphen is escaped so it is a
    // literal, never a range operator.
    .replace(/[\\/?#%.()"'\u201c\u201d\u2013\u2014-]/g, '')
    .replace(/\s+/g, '-');
  return `org-${cleaned}`;
}

// ─────────────────────────────────────────────────────────────
//  Field cleaners.
// ─────────────────────────────────────────────────────────────

/** Keep a phone only if present and not a placeholder (e.g. `03-XXXXXXX`). */
function cleanPhone(phone: string | null): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;
  if (/x{2,}/i.test(trimmed)) return null; // placeholder like 03-XXXXXXX
  return trimmed;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Keep an email only if present and looks valid. */
function cleanEmail(email: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  return EMAIL_RE.test(trimmed) ? trimmed : null;
}

/**
 * Keep a website only if it is an http(s) URL. The source has two rows where an
 * email address sits in the `website` field (e.g. `info@hineni.org.il`); those
 * are NOT valid links, so we drop them from `sourceUrl` rather than render a
 * broken/`mailto`-shaped link on the public card.
 */
function cleanWebsite(website: string | null): string | null {
  if (!website) return null;
  const trimmed = website.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

interface Bilingual {
  he: string;
  en: string;
}

/** The persisted `answers` payload for one org (id excluded — it's the doc id). */
export interface OrgAnswerDoc {
  title: Bilingual;
  body: Bilingual;
  category: string;
  orgType: 'ngo' | 'partner';
  region: Bilingual;
  audience: Bilingual;
  phone: string | null;
  email: string | null;
  sourceUrl: string | null;
}

/** Transform a source row into the `{ id, doc }` pair written to `answers`. */
export function orgToAnswer(org: OrgSource): { id: string; doc: OrgAnswerDoc } {
  const name = org.name.trim();
  const description = org.description?.trim() ?? '';
  const region = org.region?.trim() ?? '';
  const serviceType = org.serviceType?.trim() ?? '';

  return {
    id: slugifyOrgName(name),
    doc: {
      title: { he: name, en: name },
      body: { he: description, en: description },
      category: categoryForServiceType(serviceType),
      orgType: orgTypeForName(name),
      region: { he: region, en: region },
      // Preserve the original multi-service Hebrew string so nothing is lost.
      audience: { he: serviceType, en: serviceType },
      phone: cleanPhone(org.phone),
      email: cleanEmail(org.email),
      sourceUrl: cleanWebsite(org.website),
    },
  };
}

/**
 * Upsert all 18 orgs into `answers`. Idempotent: keyed by slug, and
 * `createdAt`/`createdBy` are only set on first insert (preserved on update).
 * Returns the number of distinct docs written (dedupes the duplicate row).
 *
 * Shared by both `npm run seed:orgs` (standalone) and `seed.ts` (full seed).
 */
export async function seedOrgs(firestore: Firestore): Promise<number> {
  // Build by slug first so the duplicate `טנא בריאות` row collapses to one doc.
  const bySlug = new Map<string, OrgAnswerDoc>();
  for (const org of ORGS) {
    const { id, doc } = orgToAnswer(org);
    bySlug.set(id, doc); // later duplicate overwrites — same content, one doc
  }

  // Look up which docs already exist so we only stamp createdAt/createdBy once.
  const ids = [...bySlug.keys()];
  const existing = await Promise.all(
    ids.map((id) => firestore.collection('answers').doc(id).get()),
  );
  const existsById = new Map(ids.map((id, i) => [id, existing[i].exists]));

  const batch = firestore.batch();
  for (const [id, doc] of bySlug) {
    const ref = firestore.collection('answers').doc(id);
    const base: Record<string, unknown> = {
      ...doc,
      status: 'approved',
      updatedAt: FieldValue.serverTimestamp(),
    };
    // First insert only: stamp authorship/creation. Preserved on re-run.
    if (!existsById.get(id)) {
      base.createdBy = 'seed';
      base.createdAt = FieldValue.serverTimestamp();
    }
    batch.set(ref, base, { merge: true });
  }
  await batch.commit();
  return bySlug.size;
}

// ─────────────────────────────────────────────────────────────
//  Standalone entrypoint — `npm run seed:orgs`.
//  Only runs when this file is the main module (not when imported by seed.ts).
// ─────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // Lazy import so importing this module (from seed.ts) does NOT re-init the
  // Admin SDK or load dotenv twice.
  await import('dotenv/config');
  const { initializeFirebaseAdmin, db } = await import('../src/lib/firebaseAdmin');
  initializeFirebaseAdmin();
  const count = await seedOrgs(db());
  console.log(`  ✓ answers: ${count} NPO organizations upserted`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('seedOrgs failed:', err);
    process.exit(1);
  });
}
