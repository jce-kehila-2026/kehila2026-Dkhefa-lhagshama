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
//  English content for the imported orgs.
//
//  The source rows are Hebrew-only, so without this an English directory
//  visitor sees Hebrew in every title/body/region/audience. The maps below
//  give faithful English equivalents. Anything not covered falls back to the
//  Hebrew string (the original behavior), so nothing ever renders blank.
// ─────────────────────────────────────────────────────────────

/** Hebrew region label → English. Unknown regions fall back to Hebrew. */
const REGION_HE_TO_EN: Record<string, string> = {
  'כל הארץ': 'Nationwide',
  ירושלים: 'Jerusalem',
  נתניה: 'Netanya',
  רחובות: 'Rehovot',
  'קריית גת': 'Kiryat Gat',
  אשדוד: 'Ashdod',
  אוניברסיטאות: 'Universities',
  'פריפריה חברתית וגאוגרפית בישראל': 'Social and geographic periphery of Israel',
};

/** Translate a Hebrew region label, falling back to the original Hebrew. */
function regionToEnglish(regionHe: string): string {
  return REGION_HE_TO_EN[regionHe] ?? regionHe;
}

/** Single Hebrew service-type token → English. */
const SERVICE_TYPE_HE_TO_EN: Record<string, string> = {
  תעסוקה: 'Employment',
  חינוך: 'Education',
  מנהיגות: 'Leadership',
  נוער: 'Youth',
  צעירים: 'Young adults',
  בריאות: 'Health',
  'בריאות נפש': 'Mental health',
  'בריאות קהילתית': 'Community health',
  זכויות: 'Rights',
  מדיניות: 'Policy',
  'זכויות דתיות': 'Religious rights',
  'סיוע משפטי': 'Legal aid',
  'סיוע משפטי וזכויות': 'Legal aid and rights',
  קהילה: 'Community',
  רווחה: 'Welfare',
  תרבות: 'Culture',
  העצמה: 'Empowerment',
};

/**
 * Translate a (possibly multi-token, comma-separated) Hebrew service-type
 * string token-by-token. Any token without a known translation keeps its
 * Hebrew form so the audience string is never lost.
 */
function serviceTypeToEnglish(serviceType: string): string {
  return serviceType
    .split(',')
    .map((token) => {
      const trimmed = token.trim();
      if (!trimmed) return trimmed;
      return SERVICE_TYPE_HE_TO_EN[trimmed] ?? trimmed;
    })
    .filter((token) => token.length > 0)
    .join(', ');
}

interface OrgTranslation {
  titleEn: string;
  bodyEn: string;
}

// ─────────────────────────────────────────────────────────────
//  Per-org English title + body, keyed by the deterministic slug
//  (slugifyOrgName). Titles use the orgs' OFFICIAL English names; bodies are
//  faithful, factual translations of the Hebrew activity description (no
//  embellishment). The duplicate `טנא בריאות` source row collapses to the same
//  slug, so one entry covers both. regionEn / audienceEn are derived
//  generically from the maps above, so they are NOT repeated here.
// ─────────────────────────────────────────────────────────────
const TRANSLATIONS: Record<string, OrgTranslation> = {
  'org-עולים-ביחד': {
    titleEn: 'Olim Beyahad',
    bodyEn:
      'Leadership development and integration of young Ethiopian-Israelis into academia and quality employment',
  },
  'org-הפרויקט-הלאומי-לקהילה-האתיופית-ENP': {
    titleEn: 'Ethiopian National Project (ENP)',
    bodyEn: 'Educational programs, mentoring, dropout prevention and empowerment',
  },
  'org-טנא-בריאות': {
    titleEn: 'Tene Briut',
    // Body taken from the fuller of the two duplicate source rows.
    bodyEn: 'Medical translation, health promotion, workshops and patient support',
  },
  'org-אגודת-יהודי-אתיופיה': {
    titleEn: 'Israeli Association for Ethiopian Jews (IAEJ)',
    bodyEn: 'Combating discrimination, public representation and policy change',
  },
  'org-מרכז-קהילתי-יוצאי-אתיופיה-ירושלים': {
    titleEn: 'Ethiopian Community Center - Jerusalem',
    bodyEn: 'Activity groups, family support and social assistance',
  },
  'org-מרכז-צעירים-יוצאי-אתיופיה-נתניה': {
    titleEn: 'Ethiopian Youth Center - Netanya',
    bodyEn: 'Employment guidance, career workshops and mentoring',
  },
  'org-מרכז-מורשת-יהדות-אתיופיה-רחובות': {
    titleEn: 'Ethiopian Jewry Heritage Center - Rehovot',
    bodyEn: 'Heritage preservation, cultural education and community activity',
  },
  'org-עמותת-פידל': {
    titleEn: 'Fidel Association',
    bodyEn: 'Supporting children and youth within the education system',
  },
  'org-מרכז-קהילתי-יוצאי-אתיופיה-קריית-גת': {
    titleEn: 'Ethiopian Community Center - Kiryat Gat',
    bodyEn: 'Family support, community activity and activity groups',
  },
  'org-נטל-סיוע-נפשי': {
    titleEn: 'NATAL - Israel Trauma and Resiliency Center',
    bodyEn:
      'Psychological support for trauma victims, including Ethiopian-Israelis',
  },
  'org-עמותת-עתים': {
    titleEn: 'ITIM',
    bodyEn:
      'Assistance with the Rabbinate, conversion, marriage and religious discrimination',
  },
  'org-האגודה-לזכויות-האזרח': {
    titleEn: 'Association for Civil Rights in Israel (ACRI)',
    bodyEn: 'Legal representation and the struggle against institutional discrimination',
  },
  'org-קליניקות-משפטיות-אוניברסיטאות': {
    titleEn: 'University Legal Clinics',
    bodyEn: 'Free legal advice and representation, social rights',
  },
  'org-מרכז-קהילתי-בריאות-ירושלים': {
    titleEn: 'Community Health Center - Jerusalem',
    bodyEn: 'Health education and connection to health services',
  },
  'org-מרכז-סיוע-משפטי-קהילתי-אשדוד': {
    titleEn: 'Community Legal Aid Center - Ashdod',
    bodyEn: 'Rights advice, employment, housing',
  },
  'org-עמותת-הנני': {
    titleEn: 'Hineni Association',
    bodyEn:
      'Community and educational development among disadvantaged populations, and the Ethiopian community in particular; mentoring of children and youth, family support, parent empowerment, community work in the periphery and reducing social gaps',
  },
  'org-עמותת-טבקה': {
    titleEn: 'Tebeka',
    bodyEn:
      'A leading association fighting discrimination and racism against Ethiopian-Israelis; individual legal aid (employment, education, housing, police violence), support for victims of racism, public petitions, policy change, advocacy and rights training',
  },
};

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

  const id = slugifyOrgName(name);
  // English content keyed by slug. Missing entry → fall back to the Hebrew
  // string (original behavior) so a partially-translated map never renders
  // blank. region/audience English are derived generically from the maps.
  const translation = TRANSLATIONS[id];
  const titleEn = translation?.titleEn ?? name;
  const bodyEn = translation?.bodyEn ?? description;
  const regionEn = region ? regionToEnglish(region) : region;
  const audienceEn = serviceType ? serviceTypeToEnglish(serviceType) : serviceType;

  return {
    id,
    doc: {
      title: { he: name, en: titleEn },
      body: { he: description, en: bodyEn },
      category: categoryForServiceType(serviceType),
      orgType: orgTypeForName(name),
      region: { he: region, en: regionEn },
      // Preserve the original multi-service Hebrew string so nothing is lost;
      // the English side is the same tokens translated one-by-one.
      audience: { he: serviceType, en: audienceEn },
      phone: cleanPhone(org.phone),
      // Two source rows (Hineni, Tebeka) carry their email in the `website`
      // column with a placeholder phone, so fall back to a website that is
      // actually an email address — otherwise these orgs lose all contact info.
      email: cleanEmail(org.email) ?? cleanEmail(org.website),
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
  // Audit HIGH: gate standalone runs (npm run seed:orgs) so an accidental
  // production key cannot clobber the real `answers` directory. Upsert-only, so
  // emulator/staging run freely; any other project needs --allow-nonstaging.
  // (Only runs here, the standalone path — not when imported by seed.ts, which
  // applies its own guard.)
  const { assertSafeToRun } = await import('./lib/guard');
  assertSafeToRun({ action: 'seed NPO organizations' });
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
