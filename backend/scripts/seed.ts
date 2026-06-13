import 'dotenv/config';
import { Timestamp } from 'firebase-admin/firestore';
import { initializeFirebaseAdmin, db } from '../src/lib/firebaseAdmin';
import { seedOrgs } from './seedOrgs';

initializeFirebaseAdmin();
const firestore = db();

interface TaxonomyEntry {
  id: string;
  nameHe: string;
  nameEn: string;
}

// ─────────────────────────────────────────────────────────────
//  TAXONOMY — categories (read by the seed and the UI via /api/categories)
//
//  No `regions` collection is seeded: nothing reads one. The directory region
//  filter matches free text against the `region` field embedded on each
//  `answers` doc (DirectoryPage), not a managed regions taxonomy. If a managed
//  region taxonomy is ever wanted, add a public GET route + a rules read block
//  and wire the filter to it before re-seeding the collection.
// ─────────────────────────────────────────────────────────────
const CATEGORIES: TaxonomyEntry[] = [
  { id: 'employment',  nameHe: 'תעסוקה',           nameEn: 'Employment' },
  { id: 'education',   nameHe: 'השכלה',            nameEn: 'Education' },
  { id: 'legal',       nameHe: 'משפטי',            nameEn: 'Legal' },
  { id: 'housing',     nameHe: 'דיור',             nameEn: 'Housing' },
  { id: 'health',      nameHe: 'בריאות',           nameEn: 'Health' },
  { id: 'social',      nameHe: 'שירותים חברתיים',  nameEn: 'Social Services' },
  { id: 'welfare',     nameHe: 'רווחה',            nameEn: 'Welfare' },
  { id: 'absorption',  nameHe: 'קליטת עלייה',      nameEn: 'Immigration & Absorption' },
  { id: 'community',   nameHe: 'קהילה',            nameEn: 'Community' },
  { id: 'youth',       nameHe: 'נוער',             nameEn: 'Youth' },
];

// ─────────────────────────────────────────────────────────────
//  ANSWERS — community "answers" directory (UC-02).
//
//  Shape mirrors what GET /api/answers returns (answers.ts) and what
//  DirectoryPage.jsx renders. The route filters on `status === 'approved'`
//  and `orderBy('createdAt','desc')`, with optional equality filters on
//  `category`, `region`, `audience`. So every doc MUST have:
//    status: 'approved', createdAt: <Timestamp>, title, body,
//    category, orgType, region, audience, sourceName, sourceUrl.
//
//  `category` values are the NGO_AREAS filter chips in DirectoryPage:
//    education | employment | legal | social | housing
//  (every one of those is covered below). Translatable fields
//  (`title`/`body`/`region`/`audience`) use the bilingual field contract
//  `{ he, en }` so the API can pass them through and the UI renders the
//  active language. `category` stays an enum key (not translated).
//
//  `orgType` splits the catalog into 'ngo' (עמותה) vs 'partner' (שותף);
//  docs without the field count as 'ngo'. All seeds (including the
//  government-ministry ones) start as 'ngo' — the NPO reclassifies
//  partners in the admin directory UI.
// ─────────────────────────────────────────────────────────────
interface Bilingual {
  he: string;
  en: string;
}

interface AnswerSeed {
  id: string;
  title: Bilingual;
  body: Bilingual;
  category: string;
  orgType: 'ngo' | 'partner';
  region: Bilingual;
  audience: Bilingual;
  sourceName: string;
  sourceUrl: string;
}

const ANSWERS: AnswerSeed[] = [
  {
    id: 'answer-rashi-scholarships',
    title: { he: 'מלגות קרן ראשי לסטודנטים', en: 'Rashi Foundation Scholarships' },
    body: {
      he: 'מלגות לימוד לסטודנטים ממוצא אתיופי, הכשרות מקצועיות וליווי קריירה אישי.',
      en: 'Tuition scholarships for students of Ethiopian origin, professional training and personal career mentoring.',
    },
    category: 'education',
    orgType: 'ngo',
    region: { he: 'מרכז', en: 'Center' },
    audience: { he: 'סטודנטים', en: 'Students' },
    sourceName: 'קרן ראשי | Rashi Foundation',
    sourceUrl: 'https://www.rashi.org.il',
  },
  {
    id: 'answer-fidel-hebrew',
    title: { he: 'תכנית פידל ללימודי עברית', en: 'Fidel Hebrew Learning Program' },
    body: {
      he: 'שיעורי עברית, אוריינות והכנה לבחינות לבני הקהילה האתיופית בכל הגילים.',
      en: 'Hebrew classes, literacy and exam preparation for Ethiopian-Israeli community members of all ages.',
    },
    category: 'education',
    orgType: 'ngo',
    region: { he: 'ירושלים', en: 'Jerusalem' },
    audience: { he: 'עולים חדשים', en: 'New immigrants' },
    sourceName: 'עמותת פידל | Fidel Association',
    sourceUrl: 'https://www.fidel.org.il',
  },
  {
    id: 'answer-tech-careers',
    title: { he: 'מסלול הייטק לקהילה', en: 'Community Tech Careers Track' },
    body: {
      he: 'הכשרת תוכנה, השמה במשרות הייטק וליווי מעסיקים לבוגרי הקהילה.',
      en: 'Software bootcamps, placement in tech jobs and employer mentoring for community graduates.',
    },
    category: 'employment',
    orgType: 'ngo',
    region: { he: 'תל אביב', en: 'Tel Aviv' },
    audience: { he: 'מחפשי עבודה', en: 'Job seekers' },
    sourceName: 'טק-קריירה | Tech-Career',
    sourceUrl: 'https://www.techcareer.org.il',
  },
  {
    id: 'answer-employment-center',
    title: { he: 'מרכז הכוון תעסוקתי', en: 'Employment Guidance Center' },
    body: {
      he: 'ייעוץ קריירה, כתיבת קורות חיים, הכנה לראיונות והכשרות מקצועיות.',
      en: 'Career counseling, CV writing, interview preparation and vocational training.',
    },
    category: 'employment',
    orgType: 'ngo',
    region: { he: 'חיפה', en: 'Haifa' },
    audience: { he: 'מבוגרים', en: 'Adults' },
    sourceName: 'משרד העבודה | Ministry of Labor',
    sourceUrl: 'https://www.gov.il/he/departments/employment',
  },
  {
    id: 'answer-legal-aid',
    title: { he: 'סיוע משפטי חינם', en: 'Free Legal Aid Clinic' },
    body: {
      he: 'ייצוג משפטי ללא תשלום, הגנה על זכויות מהגרים וייעוץ בנושאי מעמד ועבודה.',
      en: 'Free legal representation, protection of immigrant rights and counseling on status and labor matters.',
    },
    category: 'legal',
    orgType: 'ngo',
    region: { he: 'מרכז', en: 'Center' },
    audience: { he: 'כלל הקהילה', en: 'General public' },
    sourceName: 'איגוד לזכויות אדם | Human Rights Association',
    sourceUrl: 'https://www.humanrights.org.il',
  },
  {
    id: 'answer-rights-bureaucracy',
    title: { he: 'מימוש זכויות מול הרשויות', en: 'Rights & Bureaucracy Support' },
    body: {
      he: 'מרכזי סיוע לאזרחים בקשיים מול הבירוקרטיה הממשלתית ומיצוי זכויות.',
      en: 'Support centers helping citizens navigate government bureaucracy and realize their rights.',
    },
    category: 'legal',
    orgType: 'ngo',
    region: { he: 'דרום', en: 'South' },
    audience: { he: 'משפחות', en: 'Families' },
    sourceName: 'ידיד | Yedid',
    sourceUrl: 'https://www.yedid.org.il',
  },
  {
    id: 'answer-jdc-welfare',
    title: { he: 'ג׳וינט ישראל — שירותים חברתיים', en: 'JDC Israel Social Services' },
    body: {
      he: 'סיוע לאוכלוסיות נזקקות: קשישים, ילדים, אנשים עם מוגבלויות ומשפחות במצוקה.',
      en: 'Aid for vulnerable populations: elderly, children, people with disabilities and families in distress.',
    },
    category: 'social',
    orgType: 'ngo',
    region: { he: 'צפון', en: 'North' },
    audience: { he: 'קשישים', en: 'Elderly' },
    sourceName: 'ג׳וינט ישראל | JDC Israel',
    sourceUrl: 'https://www.jdc.org.il',
  },
  {
    id: 'answer-family-support',
    title: { he: 'קבוצות תמיכה למשפחות', en: 'Family Support Groups' },
    body: {
      he: 'קבוצות תמיכה, ייעוץ הורי וליווי רגשי לנשים ולמשפחות בקהילה.',
      en: 'Support groups, parental guidance and emotional accompaniment for women and families in the community.',
    },
    category: 'social',
    orgType: 'ngo',
    region: { he: 'נגב', en: 'Negev' },
    audience: { he: 'נשים', en: 'Women' },
    sourceName: 'דחיפה להגשמה | Push for Fulfillment',
    sourceUrl: 'https://www.pushforfulfillment.org.il',
  },
  {
    id: 'answer-housing-emergency',
    title: { he: 'סיוע בדיור ועזרה ראשונה', en: 'Housing & Emergency Aid' },
    body: {
      he: 'סיוע בדיור, מזון חירום ושירותים לעולים חדשים ולמשפחות במשבר.',
      en: 'Housing assistance, emergency food and services for new immigrants and families in crisis.',
    },
    category: 'housing',
    orgType: 'ngo',
    region: { he: 'שרון', en: 'Sharon' },
    audience: { he: 'משפחות במשבר', en: 'Families in crisis' },
    sourceName: 'עמותת בית | Beit Association',
    sourceUrl: 'https://www.beit.org.il',
  },
  {
    id: 'answer-public-housing',
    title: { he: 'זכאות לדיור ציבורי', en: 'Public Housing Eligibility' },
    body: {
      he: 'ליווי בהגשת בקשות לדיור ציבורי, סבסוד שכר דירה ומימוש זכויות מול משרד השיכון.',
      en: 'Guidance on public housing applications, rent subsidies and exercising rights with the Housing Ministry.',
    },
    category: 'housing',
    orgType: 'ngo',
    region: { he: 'ירושלים', en: 'Jerusalem' },
    audience: { he: 'עולים חדשים', en: 'New immigrants' },
    sourceName: 'משרד הבינוי והשיכון | Ministry of Housing',
    sourceUrl: 'https://www.gov.il/he/departments/ministry_of_construction_and_housing',
  },
];

// ─────────────────────────────────────────────────────────────
//  BUSINESSES — community-owned businesses directory (UC-03).
//
//  Shape mirrors GET /api/businesses (businesses.ts) + DirectoryPage.jsx.
//  Route filters on `status === 'approved'` and orders by `createdAt desc`.
//  Each doc MUST carry: status:'approved', approved:true, createdAt:<Timestamp>,
//  name, ownerName, phone, category, city, description, tags, featured, rating, reviews.
//
//  `category` spans every business filter chip in DirectoryPage:
//    food | services | health | education | beauty | tech
//  Translatable fields use the bilingual `{ he, en }` contract; `tags` is
//  `{ he: string[], en: string[] }`. `category` stays an enum key.
// ─────────────────────────────────────────────────────────────
interface BilingualTags {
  he: string[];
  en: string[];
}

interface BusinessSeed {
  id: string;
  name: Bilingual;
  ownerName: string;
  phone: string;
  category: string;
  city: Bilingual;
  description: Bilingual;
  tags: BilingualTags;
  featured: boolean;
  rating: number;
  reviews: number;
}

const BUSINESSES: BusinessSeed[] = [
  {
    id: 'biz-star-of-addis',
    name: { he: 'מסעדת כוכב אדיס', en: 'Star of Addis' },
    ownerName: 'אלמז טספאי | Almaz Tesfaye',
    phone: '03-555-1234',
    category: 'food',
    city: { he: 'תל אביב', en: 'Tel Aviv' },
    description: {
      he: 'מסעדה אתיופית מסורתית. אינג׳רה, תבשילים מסורתיים ואירוח חם ואותנטי.',
      en: 'Traditional Ethiopian restaurant. Injera, traditional stews and warm, authentic hospitality.',
    },
    tags: { he: ['מסעדה', 'אינג׳רה', 'אתיופי'], en: ['restaurant', 'injera', 'ethiopian'] },
    featured: true,
    rating: 0,
    reviews: 0,
  },
  {
    id: 'biz-jimma-cafe',
    name: { he: 'בית קפה ג׳ימה', en: 'Jimma Café' },
    ownerName: 'דניאל ברహנו | Daniel Berhanu',
    phone: '03-555-2468',
    category: 'food',
    city: { he: 'תל אביב', en: 'Tel Aviv' },
    description: {
      he: 'קפה אתיופי מסורתי עם טקס קפה, עוגות ביתיות ואווירה נעימה.',
      en: 'Traditional Ethiopian coffee with a coffee ceremony, homemade cakes and a pleasant atmosphere.',
    },
    tags: { he: ['קפה', 'טקס קפה', 'מאפים'], en: ['coffee', 'ceremony', 'bakery'] },
    featured: false,
    rating: 0,
    reviews: 0,
  },
  {
    id: 'biz-shlomo-barber',
    name: { he: 'מספרת שלמה', en: 'Shlomo\'s Barber' },
    ownerName: 'שלמה מקוריה | Shlomo Makuria',
    phone: '04-555-5678',
    category: 'services',
    city: { he: 'חיפה', en: 'Haifa' },
    description: {
      he: 'מספרה מקצועית לכל סוגי השיער. ניסיון של 15 שנה בשיער מתולתל ואפרו.',
      en: 'Professional barbershop for all hair types. 15 years of experience with curly and afro hair.',
    },
    tags: { he: ['מספרה', 'תספורת', 'שיער'], en: ['barber', 'haircut', 'hair'] },
    featured: false,
    rating: 0,
    reviews: 0,
  },
  {
    id: 'biz-alamo-renovations',
    name: { he: 'שיפוצניק אלעמו', en: 'Alamo Renovations' },
    ownerName: 'אלעמו דסטה | Alamo Desta',
    phone: '08-555-1357',
    category: 'services',
    city: { he: 'אשדוד', en: 'Ashdod' },
    description: {
      he: 'שיפוצים, אינסטלציה ועבודות בנייה. אמין, מקצועי ומחיר הוגן.',
      en: 'Renovations, plumbing and construction work. Reliable, professional and fair priced.',
    },
    tags: { he: ['שיפוצים', 'אינסטלציה', 'בנייה'], en: ['renovations', 'plumbing', 'construction'] },
    featured: false,
    rating: 0,
    reviews: 0,
  },
  {
    id: 'biz-dr-lama-clinic',
    name: { he: 'מרפאת ד"ר לאמה', en: 'Dr. Lama Clinic' },
    ownerName: 'ד"ר לאמה אבבה | Dr. Lama Abebe',
    phone: '02-555-9012',
    category: 'health',
    city: { he: 'ירושלים', en: 'Jerusalem' },
    description: {
      he: 'רפואת משפחה ורפואה כללית. שפות: עברית, אמהרית ואנגלית.',
      en: 'Family medicine and general practice. Languages: Hebrew, Amharic and English.',
    },
    tags: { he: ['רופא', 'מרפאה', 'אמהרית'], en: ['doctor', 'clinic', 'amharic'] },
    featured: true,
    rating: 0,
    reviews: 0,
  },
  {
    id: 'biz-tena-physio',
    name: { he: 'קליניקת פיזיותרפיה טנה', en: 'Tena Physiotherapy' },
    ownerName: 'מולא גרמה | Mulu Germa',
    phone: '04-555-7788',
    category: 'health',
    city: { he: 'חיפה', en: 'Haifa' },
    description: {
      he: 'פיזיותרפיה ושיקום, טיפול בכאבי גב וספורט. ליווי אישי בעברית ואמהרית.',
      en: 'Physiotherapy and rehabilitation, back-pain and sports treatment. Personal care in Hebrew and Amharic.',
    },
    tags: { he: ['פיזיותרפיה', 'שיקום', 'ספורט'], en: ['physiotherapy', 'rehab', 'sports'] },
    featured: false,
    rating: 0,
    reviews: 0,
  },
  {
    id: 'biz-ethiopian-art-academy',
    name: { he: 'אקדמיה לאמנות אתיופית', en: 'Ethiopian Art Academy' },
    ownerName: 'תגיסט וונדה | Tigist Wonde',
    phone: '03-555-3456',
    category: 'education',
    city: { he: 'ראשון לציון', en: 'Rishon LeZion' },
    description: {
      he: 'שיעורי ציור, מוסיקה אתיופית, ריקוד ועיצוב לילדים ומבוגרים.',
      en: 'Drawing, Ethiopian music, dance and design classes for children and adults.',
    },
    tags: { he: ['אמנות', 'מוסיקה', 'ריקוד'], en: ['art', 'music', 'dance'] },
    featured: false,
    rating: 0,
    reviews: 0,
  },
  {
    id: 'biz-bridge-tutoring',
    name: { he: 'מרכז למידה גשר', en: 'Bridge Tutoring Center' },
    ownerName: 'יוסף מנגיסטו | Yosef Mengistu',
    phone: '09-555-4422',
    category: 'education',
    city: { he: 'נתניה', en: 'Netanya' },
    description: {
      he: 'שיעורים פרטיים, הכנה לבגרויות וחניכה לתלמידים מהקהילה.',
      en: 'Private lessons, matriculation-exam prep and mentoring for community students.',
    },
    tags: { he: ['שיעורים פרטיים', 'בגרויות', 'חינוך'], en: ['tutoring', 'matriculation', 'education'] },
    featured: false,
    rating: 0,
    reviews: 0,
  },
  {
    id: 'biz-wisa-beauty',
    name: { he: 'סטודיו יופי ויסה', en: 'Wisa Beauty Studio' },
    ownerName: 'ויסה אסרס | Wisa Asres',
    phone: '04-555-3691',
    category: 'beauty',
    city: { he: 'חיפה', en: 'Haifa' },
    description: {
      he: 'טיפולי שיער ועור מותאמים לגווני עור כהים. ניסיון מקצועי בקוסמטיקה לעור אתיופי.',
      en: 'Hair and skin treatments tailored for darker skin tones. Professional experience with Ethiopian-skin cosmetics.',
    },
    tags: { he: ['יופי', 'קוסמטיקה', 'עור'], en: ['beauty', 'cosmetics', 'skincare'] },
    featured: false,
    rating: 0,
    reviews: 0,
  },
  {
    id: 'biz-addis-digital',
    name: { he: 'אדיס דיגיטל', en: 'Addis Digital' },
    ownerName: 'אמנואל גברהיות | Emanuel Gebrehiwot',
    phone: '03-555-9911',
    category: 'tech',
    city: { he: 'תל אביב', en: 'Tel Aviv' },
    description: {
      he: 'בניית אתרים, אפליקציות ושיווק דיגיטלי לעסקים קטנים בקהילה.',
      en: 'Website and app development plus digital marketing for small community businesses.',
    },
    tags: { he: ['אתרים', 'אפליקציות', 'שיווק'], en: ['websites', 'apps', 'marketing'] },
    featured: true,
    rating: 0,
    reviews: 0,
  },
];

async function seedTaxonomy(
  collectionName: string,
  entries: TaxonomyEntry[],
  extraFields: Record<string, unknown> = {},
): Promise<void> {
  const batch = firestore.batch();
  for (const entry of entries) {
    const ref = firestore.collection(collectionName).doc(entry.id);
    batch.set(
      ref,
      { nameHe: entry.nameHe, nameEn: entry.nameEn, ...extraFields },
      { merge: true },
    );
  }
  await batch.commit();
  console.log(`  ✓ ${collectionName}: ${entries.length} documents seeded`);
}

async function seedAnswers(): Promise<void> {
  const batch = firestore.batch();
  const base = Date.now();
  ANSWERS.forEach((answer, i) => {
    const { id, ...data } = answer;
    const ref = firestore.collection('answers').doc(id);
    // Stagger createdAt so the `orderBy('createdAt','desc')` query is stable and
    // deterministic across re-seeds (earlier array items appear first / newest).
    const createdAt = Timestamp.fromMillis(base - i * 60_000);
    batch.set(
      ref,
      { ...data, status: 'approved', createdAt, updatedAt: createdAt },
      { merge: true },
    );
  });
  await batch.commit();
  console.log(`  ✓ answers: ${ANSWERS.length} approved documents seeded`);
}

async function seedBusinesses(): Promise<void> {
  const batch = firestore.batch();
  const base = Date.now();
  BUSINESSES.forEach((biz, i) => {
    const { id, ...data } = biz;
    const ref = firestore.collection('businesses').doc(id);
    const createdAt = Timestamp.fromMillis(base - i * 60_000);
    batch.set(
      ref,
      {
        ...data,
        // No review-submission feature exists, so seeded businesses must NOT
        // ship fabricated social proof. Force rating/reviews to 0 (the public
        // card hides the rating block until reviews > 0) regardless of any
        // legacy literal still on the seed object.
        rating: 0,
        reviews: 0,
        approved: true,
        status: 'approved',
        ownerId: `seed-owner-${id}`,
        createdAt,
        updatedAt: createdAt,
      },
      { merge: true },
    );
  });
  await batch.commit();
  console.log(`  ✓ businesses: ${BUSINESSES.length} approved documents seeded`);
}

async function main(): Promise<void> {
  console.log('Seeding Firestore taxonomy + directories...');
  // Categories carry an explicit soft-archive flag (admin-managed taxonomy,
  // feedback round 2). NOTE: re-seeding resets `archived: false` on the 10
  // seeded ids — an admin who archived one of them will see it active again.
  await seedTaxonomy('categories', CATEGORIES, { archived: false });
  await seedAnswers();
  // The 18 real NPO organizations (idempotent upsert by slug) — shares the
  // transform/upsert logic in seedOrgs.ts so a fresh full seed and the
  // standalone `npm run seed:orgs` never duplicate.
  const orgCount = await seedOrgs(firestore);
  console.log(`  ✓ answers: ${orgCount} NPO organizations upserted`);
  await seedBusinesses();
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
